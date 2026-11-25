from __future__ import annotations

from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError, NotFoundError
from openg2p_fastapi_common.service import BaseService
from sqlalchemy import select
from ..helpers.query_helper import dt_iso, paginate
from iam_core.models import Application
from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
from ..schemas import (
    ApplicationCreatePayload,
    ApplicationData,
    ApplicationDeletePayload,
    ApplicationIdPayload,
    ApplicationSetActivePayload,
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
            is_registry=bool(app.is_registry),
            staff_api_url=app.staff_api_url,
            agent_api_url=app.agent_api_url,
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
        self,
        page: int,
        page_size: int,
        application_type: str | None = None,
        is_registry: bool | None = None,
    ) -> tuple[list[ApplicationData], int]:
        async_session = get_async_session_maker()
        async with async_session() as session:
            resolved_type = application_type or ApplicationType.STAFF.value
            stmt = select(Application).where(Application.application_type == resolved_type)
            # Agencies: include inactive so Active/Inactive soft-delete toggle works both ways.
            # Staff applications: active-only list (status column removed from UI).
            if resolved_type != ApplicationType.AGENT.value:
                stmt = stmt.where(Application.active.is_(True))
            if is_registry is not None:
                stmt = stmt.where(Application.is_registry.is_(is_registry))
            # stmt = select(Application).where(
            #     Application.application_type == (application_type or ApplicationType.STAFF.value),
            #     Application.active.is_(True),
            # )
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
            # Allow inactive agencies so soft-deleted rows remain openable from the list.
            if not app.active and app.application_type != ApplicationType.AGENT.value:
                raise NotFoundError(message="Application not found")
            # if app is None or not app.active:
            #     raise NotFoundError(message="Application not found")
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
                is_registry=bool(payload.is_registry) if not is_agent else False,
                staff_api_url=payload.staff_api_url,
                agent_api_url=payload.agent_api_url,
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
                "is_registry",
                "staff_api_url",
                "agent_api_url",
                # "icon_base64",  # icon changes disabled from staff UI
                "order",
                "width",
            ):
                value = getattr(payload, field)
                if value is not None:
                    setattr(app, field, value)
            await session.commit()
            await session.refresh(app)
            return self._to_data(app)

    async def set_application_active(self, payload: ApplicationSetActivePayload) -> ApplicationData:
        """Soft-delete / restore by flipping active only — no Keycloak sync.

        Prefer /agencies/set_active for agencies; this remains as a shared helper.
        """
        async_session = get_async_session_maker()
        async with async_session() as session:
            app = await session.get(Application, payload.id)
            if app is None:
                raise NotFoundError(message="Application not found")
            # Agencies only — staff applications do not soft-delete via this path.
            if app.application_type != ApplicationType.AGENT.value:
                raise BadRequestError(message="Only agencies can be soft-deleted this way")
            app.active = bool(payload.active)
            await session.commit()
            await session.refresh(app)
            return self._to_data(app)

    async def delete_application(
        self, payload: ApplicationDeletePayload, auth_token: str = ""
    ) -> ApplicationData:
        # Hard/cascade soft-delete path kept but route registration is commented out.
        # Agencies use set_application_active instead (DB-only active toggle).
        async_session = get_async_session_maker()
        async with async_session() as session:
            app = await session.get(Application, payload.id)
            if app is None:
                raise NotFoundError(message="Application not found")
            if app.is_self_registered:
                raise BadRequestError(
                    message="Self-registered applications cannot be deleted from the staff UI"
                )
            from iam_core.models import ApplicationPermission, DataPolicy, Role, RolePermission

            app.active = False
            app.client_status = SyncStatus.PENDING.value
            app.client_error = SyncAction.DELETE.value
            roles = (await session.scalars(select(Role).where(Role.application_id == app.id))).all()
            permissions = (
                await session.scalars(
                    select(ApplicationPermission).where(ApplicationPermission.application_id == app.id)
                )
            ).all()
            for role in roles:
                role.active = False
            for permission in permissions:
                permission.active = False
            role_ids = [role.id for role in roles]
            permission_ids = [permission.id for permission in permissions]
            mappings = []
            if role_ids:
                mappings.extend(
                    (
                        await session.scalars(
                            select(RolePermission).where(RolePermission.role_id.in_(role_ids))
                        )
                    ).all()
                )
            if permission_ids:
                mappings.extend(
                    (
                        await session.scalars(
                            select(RolePermission).where(RolePermission.permission_id.in_(permission_ids))
                        )
                    ).all()
                )
            for mapping in mappings:
                mapping.active = False
            policies = (
                await session.scalars(select(DataPolicy).where(DataPolicy.application_id == app.id))
            ).all()
            for policy in policies:
                await session.delete(policy)
            await session.commit()
            return self._to_data(app)
