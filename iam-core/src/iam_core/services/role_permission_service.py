"""Resolve active role mnemonics to permission mnemonics, keyed by client."""

from collections import defaultdict

from openg2p_fastapi_common.errors.http_exceptions import BadRequestError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from iam_core.models.application_permission import ApplicationPermission
from iam_core.models.application import Application
from iam_core.models.role import Role
from iam_core.models.role_permission import RolePermission


async def permissions_for_client_roles(
    session: AsyncSession,
    clients: list[tuple[str, list[str]]],
) -> dict[str, list[str]]:
    """Map each token client to the permissions of its roles.

    Input:  ``[(client_id, [role, …]), …]``
    Output: ``{client_id: [permission, …], …}``

    A client that is not an application, such as ``realm-management`` or
    ``account``, is ignored. When the client is an application and a role from
    the token is not stored for it, that is an error. A role name matches only
    that application.
    """
    pairs = [
        (client_id, list(role_mnemonics))
        for client_id, role_mnemonics in clients
        if client_id and role_mnemonics
    ]
    if not pairs:
        return {}

    applications = (
        (
            await session.execute(
                select(Application).where(
                    Application.application_mnemonic.in_([client_id for client_id, _ in pairs])
                )
            )
        )
        .scalars()
        .all()
    )
    by_mnemonic = {application.application_mnemonic: application for application in applications}
    known = [
        (by_mnemonic[client_id], role_mnemonics)
        for client_id, role_mnemonics in pairs
        if client_id in by_mnemonic
    ]
    if not known:
        return {}

    roles = (
        (
            await session.execute(
                select(Role).where(
                    Role.application_id.in_([application.id for application, _ in known]),
                    Role.active == True,  # noqa: E712
                )
            )
        )
        .scalars()
        .all()
    )
    roles_by_application: dict[int, dict[str, Role]] = defaultdict(dict)
    for role in roles:
        roles_by_application[role.application_id][role.role_mnemonic] = role

    missing: list[str] = []
    role_id_to_client: dict[int, str] = {}
    result: dict[str, list[str]] = {
        application.application_mnemonic: [] for application, _ in known
    }
    for application, role_mnemonics in known:
        stored = roles_by_application.get(application.id, {})
        for role_mnemonic in role_mnemonics:
            role = stored.get(role_mnemonic)
            if role is None:
                missing.append(f"{application.application_mnemonic}: {role_mnemonic}")
            else:
                role_id_to_client[role.id] = application.application_mnemonic
    if missing:
        raise BadRequestError(
            message="Role is not defined for this application: " + ", ".join(sorted(missing))
        )
    if not role_id_to_client:
        return result

    role_permission_rows = (
        (
            await session.execute(
                select(RolePermission.role_id, RolePermission.permission_id).where(
                    RolePermission.role_id.in_(list(role_id_to_client)),
                    RolePermission.active == True,  # noqa: E712
                )
            )
        )
        .all()
    )
    if not role_permission_rows:
        return result

    permission_ids = sorted({permission_id for _, permission_id in role_permission_rows})
    mnemonics_by_id = {
        permission_id: mnemonic
        for permission_id, mnemonic in (
            await session.execute(
                select(ApplicationPermission.id, ApplicationPermission.permission_mnemonic).where(
                    ApplicationPermission.id.in_(permission_ids),
                    ApplicationPermission.active == True,  # noqa: E712
                )
            )
        ).all()
    }

    by_client: dict[str, set[str]] = defaultdict(set)
    for role_id, permission_id in role_permission_rows:
        client_id = role_id_to_client.get(role_id)
        mnemonic = mnemonics_by_id.get(permission_id)
        if client_id and mnemonic:
            by_client[client_id].add(mnemonic)

    for client_id, mnemonics in by_client.items():
        result[client_id] = sorted(mnemonics)
    return result
