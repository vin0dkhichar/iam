"""Staff records an agency. The worker creates its Keycloak clients, then its group."""

from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from iam_core.models.agency import AGENCY_ADMIN_ROLE, AGENT_WEB_CLIENT
from iam_core.models.enum import SyncStatus
from iam_core.services.agency_service import AgencyService
from iam_core.user_auth.decorators import require_permissions

from ..schemas import CreateAgencyBody, CreateAgencyResponse


class AgenciesController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.prefix = "/agencies"
        self.router.tags += ["agencies"]
        self._agencies = AgencyService()
        self.router.add_api_route("", self.create_agency, methods=["POST"])

    @require_permissions({"user:create"})
    async def create_agency(self, body: CreateAgencyBody) -> CreateAgencyResponse:
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


def admin_client_roles() -> list[dict]:
    return [{"client_id": AGENT_WEB_CLIENT, "roles": [AGENCY_ADMIN_ROLE]}]


async def require_synced_agency(session, agency_id: str):
    from iam_core.services.agency_service import AgencyService

    agency = await AgencyService().get(session, agency_id)
    if agency is None:
        raise BadRequestError(message="Agency does not exist")
    if agency.group_status != SyncStatus.SYNCED.value:
        raise BadRequestError(message="Agency group is not ready yet")
    return agency
