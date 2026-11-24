"""Partner onboarding: create agency and agency admin only."""

from fastapi import Request
from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from iam_core.helpers.agency import AGENCY_ADMIN_ROLE, AGENT_WEB_CLIENT
from iam_core.models.enum import ApplicationType, SyncStatus
from iam_core.services.agency_service import AgencyService
from iam_core.services.user_service import UserService

from ..helpers.request_body import partner_payload
from ..helpers.signature import require_partner_signature
from ..schemas import (
    CreateAgencyAdminBody,
    CreateAgencyAdminResponse,
    CreateAgencyBody,
    CreateAgencyResponse,
)


class PartnerAgenciesController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.prefix = "/partner"
        self.router.tags += ["partner"]
        self._agencies = AgencyService()
        self._users = UserService()
        self.router.add_api_route("/agencies", self.create_agency, methods=["POST"])
        self.router.add_api_route("/users/create_agency_admin", self.create_agency_admin, methods=["POST"])

    async def create_agency(self, request: Request) -> CreateAgencyResponse:
        await require_partner_signature(request)
        body = await partner_payload(request, CreateAgencyBody)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            agency = await self._agencies.create(session, agency_id=body.agency_id, name=body.name)
            await session.commit()
        return CreateAgencyResponse(
            id=str(agency.id),
            agency_id=agency.application_mnemonic,
            client_status=agency.client_status,
            group_status=agency.group_status,
        )

    async def create_agency_admin(self, request: Request) -> CreateAgencyAdminResponse:
        await require_partner_signature(request)
        body = await partner_payload(request, CreateAgencyAdminBody)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            agency = await self._agencies.get(session, body.agency_id)
            if agency is None or not agency.active:
                raise BadRequestError(message="Agency does not exist")
            if agency.group_status != SyncStatus.SYNCED.value:
                raise BadRequestError(message="Agency group is not ready yet")
            user = await self._users.create_user(
                session,
                realm=ApplicationType.AGENT.value,
                email=body.email,
                first_name=body.first_name,
                last_name=body.last_name,
                agency_id=body.agency_id,
                keycloak_clients=[{"client_id": AGENT_WEB_CLIENT, "roles": [AGENCY_ADMIN_ROLE]}],
            )
            await session.commit()
            user_id = user.id
        return CreateAgencyAdminResponse(
            id=user_id,
            agency_id=body.agency_id,
            sync_status="pending",
        )
