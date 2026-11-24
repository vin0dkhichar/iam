"""Save users. Keycloak provisioning is done by the Celery worker."""

from __future__ import annotations

import re

from openg2p_fastapi_common.errors.http_exceptions import BadRequestError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from iam_core.helpers.agency import (
    AGENCY_ADMIN_ROLE,
    AGENT_PORTAL_CLIENT,
    merge_agency_client_roles,
    with_inherited_agc_roles,
)
from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
from iam_core.models.user import User

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(email: str) -> str:
    cleaned = email.strip().lower()
    if not _EMAIL.match(cleaned):
        raise BadRequestError(message="A valid email is required")
    return cleaned


def _agency_client_roles(user: User, agency_id: str) -> list[str]:
    for entry in user.keycloak_clients or []:
        if entry.get("client_id") == agency_id:
            return [role for role in (entry.get("roles") or []) if role]
    return []


class UserService:
    async def create_user(
        self,
        session: AsyncSession,
        *,
        realm: str,
        email: str,
        first_name: str,
        last_name: str,
        agency_id: str | None = None,
        keycloak_clients: list | None = None,
        sync_action: str = SyncAction.CREATE.value,
    ) -> User:
        if realm not in {item.value for item in ApplicationType}:
            raise BadRequestError(message="realm must be staff, agent, or beneficiary")
        if not first_name.strip() or not last_name.strip():
            raise BadRequestError(message="First name and last name are required")
        cleaned_email = _normalize_email(email)
        if realm == ApplicationType.AGENT.value and not agency_id:
            raise BadRequestError(message="An agent user requires an agency")
        if realm != ApplicationType.AGENT.value and agency_id:
            raise BadRequestError(message="Only an agent user belongs to an agency")

        existing = await session.scalar(
            select(User).where(
                User.realm == realm,
                func.lower(User.email) == cleaned_email,
            )
        )
        if existing is not None:
            raise BadRequestError(message="A user with this email already exists")

        user = User(
            realm=realm,
            email=cleaned_email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            agency_id=agency_id,
            keycloak_clients=keycloak_clients,
            sync_action=sync_action,
            sync_status=SyncStatus.PENDING.value,
            active=True,
        )
        session.add(user)
        await session.flush()
        return user

    @staticmethod
    def _has_agency_admin_role(user: User) -> bool:
        for entry in user.keycloak_clients or []:
            if entry.get("client_id") != AGENT_PORTAL_CLIENT:
                continue
            if AGENCY_ADMIN_ROLE in (entry.get("roles") or []):
                return True
        return False

    async def list_for_agency(
        self,
        session: AsyncSession,
        agency_id: str,
        *,
        page: int = 1,
        page_size: int = 10,
        agency_admins_only: bool = False,
    ) -> tuple[list[User], int]:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        filters = (
            User.realm == ApplicationType.AGENT.value,
            User.agency_id == agency_id,
            User.active.is_(True),
        )
        if agency_admins_only:
            # JSON shape varies by driver; filter in Python so staff UI only shows
            # users with AGENCY_ADMIN on agent-portal (not every agency agent).
            rows = list(
                await session.scalars(select(User).where(*filters).order_by(User.email.asc()))
            )
            admins = [user for user in rows if self._has_agency_admin_role(user)]
            total = len(admins)
            start = (page - 1) * page_size
            return admins[start : start + page_size], total

        total = int(await session.scalar(select(func.count()).select_from(User).where(*filters)) or 0)
        rows = await session.scalars(
            select(User)
            .where(*filters)
            .order_by(User.email.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list(rows), total

    async def refresh_inherited_agc_roles(
        self,
        session: AsyncSession,
        *,
        agency_id: str,
        agc_roles: list[str],
    ) -> None:
        """Rewrite AGC_ on every active agency user and queue Keycloak UPDATE_ROLES."""
        users = (
            await session.scalars(
                select(User).where(
                    User.realm == ApplicationType.AGENT.value,
                    User.agency_id == agency_id,
                    User.active.is_(True),
                )
            )
        ).all()
        for user in users:
            if user.sync_action == SyncAction.DELETE.value:
                continue
            roles = with_inherited_agc_roles(_agency_client_roles(user, agency_id), agc_roles)
            user.keycloak_clients = merge_agency_client_roles(user.keycloak_clients, agency_id, roles)
            if (
                user.sync_action == SyncAction.CREATE.value
                and user.sync_status in {SyncStatus.PENDING.value, SyncStatus.SYNCING.value}
                and not user.keycloak_user_id
            ):
                # CREATE provision will apply the updated keycloak_clients.
                continue
            user.sync_action = SyncAction.UPDATE_ROLES.value
            user.sync_status = SyncStatus.PENDING.value
