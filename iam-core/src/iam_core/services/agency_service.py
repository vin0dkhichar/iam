"""Save an agency as an Application with type agent."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from iam_core.models.application import Application
from iam_core.models.enum import ApplicationType, SyncStatus


class AgencyService:
    async def create(self, session: AsyncSession, *, agency_id: str, name: str) -> Application:
        cleaned = agency_id.strip()
        if not cleaned or not name.strip():
            raise BadRequestError(message="Agency id and name are required")
        existing = await session.scalar(
            select(Application).where(Application.application_mnemonic == cleaned)
        )
        if existing is not None:
            raise BadRequestError(message="This agency already exists")
        agency = Application(
            application_mnemonic=cleaned,
            application_description=name.strip(),
            application_type=ApplicationType.AGENT.value,
            client_status=SyncStatus.PENDING.value,
            group_status=SyncStatus.PENDING.value,
            is_self_registered=True,
            active=True,
        )
        session.add(agency)
        await session.flush()
        return agency

    async def get(self, session: AsyncSession, agency_id: str) -> Application | None:
        return await session.scalar(
            select(Application).where(
                Application.application_mnemonic == agency_id,
                Application.application_type == ApplicationType.AGENT.value,
                Application.active.is_(True),
            )
        )
