from __future__ import annotations

from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError, NotFoundError
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import delete, select
from ..helpers.query_helper import dt_iso, paginate
from ..helpers.keycloak_helper import KeycloakHelper
from iam_core.models import Application
from iam_core.models.enum import ApplicationType, SyncStatus
from ..schemas import (
    ApplicationCreatePayload,
    ApplicationData,
    ApplicationDeletePayload,
    ApplicationIdPayload,
    ApplicationUpdatePayload,
)


class ApplicationsService(BaseService):
    def _to_data(self, app: Application) -> ApplicationData:
        return ApplicationData(
            id=app.id,
            application_mnemonic=app.application_mnemonic,
            application_type=app.application_type,
            application_description=app.application_description,
            application_url=app.application_url,
            api_url=app.api_url,
            icon_base64=app.icon_base64,
            width=app.width,
            order=app.order,
            is_self_registered=bool(app.is_self_registered),
            client_status=app.client_status,
            client_error=app.client_error,
            group_status=app.group_status,
            group_error=app.group_error,
            active=bool(app.active),
            created_at=dt_iso(app.created_at),
            updated_at=dt_iso(app.updated_at),
        )

    async def get_applications(
        self, page: int, page_size: int, application_type: str | None = None
    ) -> tuple[list[ApplicationData], int]:
        async_session = get_async_session_maker()
        async with async_session() as session:
            stmt = select(Application).where(
                Application.application_type == (application_type or ApplicationType.STAFF.value)
            )
            stmt = stmt.order_by(
                Application.created_at.desc().nullslast(),
                Application.id.desc(),
            )
            rows, total = await paginate(session, stmt, page=page, page_size=page_size)
            return [self._to_data(r) for r in rows], total

    async def get_application(self, payload: ApplicationIdPayload) -> ApplicationData:
        async_session = get_async_session_maker()
        async with async_session() as session:
            app = await session.get(Application, payload.id)
            if app is None:
                raise NotFoundError(message="Application not found")
            return self._to_data(app)

    async def create_application(self, payload: ApplicationCreatePayload) -> ApplicationData:
        mnemonic = payload.application_mnemonic.strip()
        if not mnemonic:
            raise BadRequestError(message="application_mnemonic is required")
        application_type = (payload.application_type or ApplicationType.STAFF.value).strip()
        if application_type not in {ApplicationType.STAFF.value, ApplicationType.AGENT.value}:
            raise BadRequestError(message="application_type must be staff or agent")
        is_agent = application_type == ApplicationType.AGENT.value

        async_session = get_async_session_maker()
        async with async_session() as session:
            existing = (
                (
                    await session.execute(
                        select(Application).where(Application.application_mnemonic == mnemonic)
                    )
                )
                .scalars()
                .first()
            )
            if existing is not None:
                raise BadRequestError(message=f"Application '{mnemonic}' already exists")

            app = Application(
                application_mnemonic=mnemonic,
                application_type=application_type,
                application_description=payload.application_description,
                application_url=payload.application_url,
                api_url=payload.api_url,
                icon_base64=payload.icon_base64,
                order=payload.order,
                width=payload.width,
                is_self_registered=is_agent,
                active=True,
                client_status=SyncStatus.PENDING.value,
                group_status=SyncStatus.PENDING.value if is_agent else SyncStatus.SYNCED.value,
            )
            session.add(app)
            await session.commit()
            await session.refresh(app)
            return self._to_data(app)

    async def update_application(self, payload: ApplicationUpdatePayload) -> ApplicationData:
        async_session = get_async_session_maker()
        async with async_session() as session:
            app = await session.get(Application, payload.id)
            if app is None:
                raise NotFoundError(message="Application not found")
            if app.is_self_registered:
                raise BadRequestError(
                    message="Self-registered applications cannot be edited from the staff UI"
                )
            for field in (
                "application_description",
                "application_url",
                "api_url",
                "icon_base64",
                "order",
                "width",
            ):
                value = getattr(payload, field)
                if value is not None:
                    setattr(app, field, value)
            await session.commit()
            await session.refresh(app)
            return self._to_data(app)

    async def delete_application(
        self, payload: ApplicationDeletePayload, auth_token: str = ""
    ) -> ApplicationData:
        async_session = get_async_session_maker()
        async with async_session() as session:
            app = await session.get(Application, payload.id)
            if app is None:
                raise NotFoundError(message="Application not found")
            if app.is_self_registered:
                raise BadRequestError(
                    message="Self-registered applications cannot be deleted from the staff UI"
                )
            app_data = self._to_data(app)

            # Delete Keycloak client before database commit
            if auth_token:
                try:
                    kc_helper = KeycloakHelper(auth_token)
                    await kc_helper.delete_client(app_data.application_mnemonic)
                    # If client not found in Keycloak, still proceed with IAM delete (Keycloak is source of truth)
                except Exception as e:
                    await session.rollback()
                    raise BadRequestError(message=f"Failed to delete Keycloak client: {e}")

            # Delete related roles and permissions
            from iam_core.models import Role, ApplicationPermission, RolePermission

            # Get all roles for this application
            roles = (await session.execute(select(Role).where(Role.application_id == app.id))).scalars().all()
            role_ids = [r.id for r in roles]

            # Get all permissions for this application
            perms = (
                (
                    await session.execute(
                        select(ApplicationPermission).where(ApplicationPermission.application_id == app.id)
                    )
                )
                .scalars()
                .all()
            )
            perm_ids = [p.id for p in perms]

            # Delete role-permission mappings
            if role_ids:
                await session.execute(delete(RolePermission).where(RolePermission.role_id.in_(role_ids)))
            if perm_ids:
                await session.execute(
                    delete(RolePermission).where(RolePermission.permission_id.in_(perm_ids))
                )

            # Delete roles
            if role_ids:
                await session.execute(delete(Role).where(Role.id.in_(role_ids)))

            # Delete permissions
            if perm_ids:
                await session.execute(
                    delete(ApplicationPermission).where(ApplicationPermission.id.in_(perm_ids))
                )

            # Delete the application
            await session.delete(app)
            await session.commit()
        return app_data
