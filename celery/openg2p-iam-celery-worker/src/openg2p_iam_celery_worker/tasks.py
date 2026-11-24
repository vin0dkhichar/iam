from __future__ import annotations

import asyncio

import httpx
from openg2p_fastapi_common.context import get_async_session_maker
from sqlalchemy import delete, select
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from iam_core.helpers.keycloak_admin import KeycloakAdmin, KeycloakAdminError
from iam_core.helpers.keycloak_admin_config import ProvisioningSettings
from iam_core.helpers.agency import AGENT_APP_CLIENT, AGENT_PORTAL_CLIENT
from iam_core.models.application import Application
from iam_core.models.data_policy import DataPolicy
from iam_core.models.application_permission import ApplicationPermission
from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
from iam_core.models.role import Role
from iam_core.models.role_permission import RolePermission
from iam_core.models.user import User
from iam_core.services.user_role_assignment import assign_client_roles

from .app import celery_app

_loop: asyncio.AbstractEventLoop | None = None


def _run(coro):
    """Reuse one loop per process so the async DB pool stays on the same loop."""
    global _loop
    if _loop is None or _loop.is_closed():
        _loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_loop)
    return _loop.run_until_complete(coro)


def keycloak_realm(realm: str, settings: ProvisioningSettings) -> str:
    if realm == ApplicationType.STAFF.value:
        return settings.staff_realm
    if realm == ApplicationType.AGENT.value:
        return settings.agent_realm
    if realm == ApplicationType.BENEFICIARY.value:
        return settings.beneficiary_realm
    raise BadRequestError(message="realm must be staff, agent, or beneficiary")


async def _delete_application(session, admin: KeycloakAdmin, application: Application) -> None:
    realm = keycloak_realm(application.application_type, admin._settings)
    try:
        async with httpx.AsyncClient(timeout=20) as http:
            client_uuid = await admin.find_client_uuid(http, realm, application.application_mnemonic)
            if client_uuid:
                await admin.delete_client(http, realm, client_uuid)
            if application.application_type == ApplicationType.AGENT.value:
                group_id = await admin.find_group_id(
                    http, admin._settings.agent_realm, application.application_mnemonic
                )
                if group_id:
                    await admin.delete_group(http, admin._settings.agent_realm, group_id)
    except KeycloakAdminError as exc:
        application.client_status = SyncStatus.FAILED.value
        application.client_error = str(exc)
        await session.flush()
        return
    role_ids = list(
        (await session.scalars(select(Role.id).where(Role.application_id == application.id))).all()
    )
    permission_ids = list(
        (
            await session.scalars(
                select(ApplicationPermission.id).where(ApplicationPermission.application_id == application.id)
            )
        ).all()
    )
    if role_ids:
        await session.execute(delete(RolePermission).where(RolePermission.role_id.in_(role_ids)))
        await session.execute(delete(Role).where(Role.id.in_(role_ids)))
    if permission_ids:
        await session.execute(delete(RolePermission).where(RolePermission.permission_id.in_(permission_ids)))
        await session.execute(
            delete(ApplicationPermission).where(ApplicationPermission.id.in_(permission_ids))
        )
    await session.execute(delete(DataPolicy).where(DataPolicy.application_id == application.id))
    await session.delete(application)
    await session.flush()


async def _delete_role(session, admin: KeycloakAdmin, role: Role) -> None:
    application = await session.get(Application, role.application_id)
    if application is not None:
        realm = keycloak_realm(application.application_type, admin._settings)
        try:
            async with httpx.AsyncClient(timeout=20) as http:
                client_uuid = await admin.find_client_uuid(http, realm, application.application_mnemonic)
                if client_uuid:
                    await admin.delete_client_role(http, realm, client_uuid, role.role_mnemonic)
        except KeycloakAdminError as exc:
            role.sync_status = SyncStatus.FAILED.value
            role.sync_error = str(exc)
            await session.flush()
            return
    await session.execute(delete(RolePermission).where(RolePermission.role_id == role.id))
    if application is not None:
        await session.execute(
            delete(DataPolicy).where(
                DataPolicy.application_id == application.id,
                DataPolicy.policy_mnemonic == role.role_mnemonic,
            )
        )
    await session.delete(role)
    await session.flush()


async def provision_application_client(session, admin: KeycloakAdmin, application: Application) -> None:
    if application.client_error == SyncAction.DELETE.value:
        await _delete_application(session, admin, application)
        return
    realm = keycloak_realm(application.application_type, admin._settings)
    name = application.application_description or application.application_mnemonic
    client_id = application.application_mnemonic
    try:
        async with httpx.AsyncClient(timeout=20) as http:
            await admin.create_client(http, realm, client_id, name)
    except KeycloakAdminError as exc:
        application.client_status = SyncStatus.FAILED.value
        application.client_error = str(exc)
        await session.flush()
        return
    application.client_status = SyncStatus.SYNCED.value
    application.client_error = None
    await session.flush()


async def provision_agency_group(session, admin: KeycloakAdmin, agency: Application) -> None:
    realm = admin._settings.agent_realm
    try:
        async with httpx.AsyncClient(timeout=20) as http:
            await admin.create_group(http, realm, agency.application_mnemonic)
    except KeycloakAdminError as exc:
        agency.group_status = SyncStatus.FAILED.value
        agency.group_error = str(exc)
        await session.flush()
        return
    agency.group_status = SyncStatus.SYNCED.value
    agency.group_error = None
    await session.flush()


async def _apply_client_roles(admin: KeycloakAdmin, user: User) -> None:
    """Push each client_id's roles to Keycloak (replace, including empty clears)."""
    realm = keycloak_realm(user.realm, admin._settings)
    for entry in user.keycloak_clients or []:
        client_id = entry.get("client_id")
        if not client_id:
            continue
        await assign_client_roles(
            realm=realm,
            client_id=client_id,
            keycloak_user_id=user.keycloak_user_id,
            role_names=entry.get("roles") or [],
        )


async def provision_user(session, admin: KeycloakAdmin, user: User) -> None:
    if user.sync_action == SyncAction.DELETE.value:
        if user.keycloak_user_id:
            async with httpx.AsyncClient(timeout=20) as http:
                await admin.delete_user(
                    http, keycloak_realm(user.realm, admin._settings), user.keycloak_user_id
                )
        await session.delete(user)
        await session.flush()
        return

    if user.sync_action == SyncAction.UPDATE_ROLES.value:
        if not user.keycloak_user_id:
            user.sync_status = SyncStatus.FAILED.value
            user.sync_error = "User is not in Keycloak yet"
            await session.flush()
            return
        await _apply_client_roles(admin, user)
        user.sync_status = SyncStatus.SYNCED.value
        user.sync_error = None
        await session.flush()
        return

    if user.agency_id:
        agency = await session.scalar(
            select(Application).where(Application.application_mnemonic == user.agency_id)
        )
        if agency is None or agency.group_status != SyncStatus.SYNCED.value:
            user.sync_status = SyncStatus.PENDING.value
            user.sync_error = "Waiting for the agency group"
            await session.flush()
            return

    realm = keycloak_realm(user.realm, admin._settings)
    keycloak_id = user.keycloak_user_id
    async with httpx.AsyncClient(timeout=20) as http:
        group_id = None
        if user.agency_id:
            group_id = await admin.find_group_id(http, realm, user.agency_id)
            if not group_id:
                user.sync_status = SyncStatus.PENDING.value
                user.sync_error = "Waiting for the agency group"
                await session.flush()
                return
        keycloak_id = keycloak_id or await admin.find_user_id(http, realm, user.email)
        if not keycloak_id:
            keycloak_id = await admin.create_user(
                http,
                realm,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                agency_id=user.agency_id,
            )
        user.keycloak_user_id = keycloak_id
        if group_id:
            # Groups claim on both agent OIDC clients so web + mobile tokens carry agency.
            await admin.ensure_groups_claim(http, realm, AGENT_PORTAL_CLIENT)
            await admin.ensure_groups_claim(http, realm, AGENT_APP_CLIENT)
            await admin.join_group(http, realm, keycloak_id, group_id)
        # Password email is off for now. The user is only created in Keycloak.
        # await admin.send_password_email(http, realm, keycloak_id)
    await _apply_client_roles(admin, user)
    user.sync_status = SyncStatus.SYNCED.value
    user.sync_error = None
    await session.flush()


async def provision_role(session, admin: KeycloakAdmin, role: Role) -> None:
    if role.sync_error == SyncAction.DELETE.value:
        await _delete_role(session, admin, role)
        return
    application = await session.get(Application, role.application_id)
    if application is None:
        role.sync_status = SyncStatus.FAILED.value
        role.sync_error = "Application does not exist"
        await session.flush()
        return
    realm = keycloak_realm(application.application_type, admin._settings)
    try:
        async with httpx.AsyncClient(timeout=20) as http:
            client_uuid = await admin.find_client_uuid(http, realm, application.application_mnemonic)
            if not client_uuid:
                raise KeycloakAdminError(f"Keycloak client not found: {application.application_mnemonic}")
            await admin.create_client_role(http, realm, client_uuid, role.role_mnemonic)
    except KeycloakAdminError as exc:
        role.sync_status = SyncStatus.FAILED.value
        role.sync_error = str(exc)
        await session.flush()
        return
    role.sync_status = SyncStatus.SYNCED.value
    role.sync_error = None
    await session.flush()


async def _provision_application(application_id: int) -> None:
    admin = KeycloakAdmin()
    session_maker = get_async_session_maker()
    async with session_maker() as session:
        application = await session.get(Application, application_id)
        if application is None:
            return
        await provision_application_client(session, admin, application)
        await session.commit()


async def _provision_agency_group(application_id: int) -> None:
    admin = KeycloakAdmin()
    session_maker = get_async_session_maker()
    async with session_maker() as session:
        agency = await session.get(Application, application_id)
        if agency is None:
            return
        await provision_agency_group(session, admin, agency)
        await session.commit()


async def _provision_role(role_id: int) -> None:
    admin = KeycloakAdmin()
    session_maker = get_async_session_maker()
    async with session_maker() as session:
        role = await session.get(Role, role_id)
        if role is None:
            return
        await provision_role(session, admin, role)
        await session.commit()


async def _provision_one_user(user_id: str) -> None:
    admin = KeycloakAdmin()
    session_maker = get_async_session_maker()
    async with session_maker() as session:
        user = await session.get(User, user_id)
        if user is None:
            return
        try:
            await provision_user(session, admin, user)
            await session.commit()
        except KeycloakAdminError as exc:
            user.sync_status = SyncStatus.FAILED.value
            user.sync_error = str(exc)
            await session.commit()


@celery_app.task(name="iam.provision_application")
def provision_application_task(application_id: int) -> None:
    _run(_provision_application(application_id))


@celery_app.task(name="iam.provision_agency_group")
def provision_agency_group_task(application_id: int) -> None:
    _run(_provision_agency_group(application_id))


@celery_app.task(name="iam.provision_role")
def provision_role_task(role_id: int) -> None:
    _run(_provision_role(role_id))


@celery_app.task(name="iam.provision_user")
def provision_user_task(user_id: str) -> None:
    _run(_provision_one_user(user_id))
