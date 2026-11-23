"""Agency id and admin role taken from the authenticated request."""

from fastapi import Request
from openg2p_fastapi_common.errors.http_exceptions import ForbiddenError

from iam_core.models.agency import AGENCY_ADMIN_ROLE, AGENT_WEB_CLIENT
from iam_core.user_auth.helpers.claims_helper import AGENCY_ID_STATE_KEY


def agency_id_from_request(request: Request) -> str:
    agency_id = getattr(request.state, AGENCY_ID_STATE_KEY, None)
    if not agency_id:
        raise ForbiddenError(message="Agency group is missing from the token")
    return str(agency_id)


def require_agency_admin(request: Request) -> None:
    roles = (request.state.auth.client_roles or {}).get(AGENT_WEB_CLIENT, [])
    if AGENCY_ADMIN_ROLE not in roles:
        raise ForbiddenError(message="Only an agency admin can manage agents")
