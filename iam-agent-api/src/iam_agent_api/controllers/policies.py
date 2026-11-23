"""Read-only policy list for the agency group."""

from fastapi import Request
from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from iam_core.schemas.data_policy import (
    GetAllPoliciesRequestPayload,
    GetAllPoliciesResponsePayload,
    GetPolicyRequestPayload,
    GetPolicyResponsePayload,
)
from iam_core.services.data_policy_service import DataPolicyService
from iam_core.user_auth.decorators import requires_auth

from ..helpers.agency import agency_id_from_request, require_agency_admin


class PoliciesController(BaseController):
    """Same policy reads as staff. Add and remove stay on the staff API."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.prefix = "/data-policies"
        self.router.tags += ["data-policies"]
        self._policies = DataPolicyService.get_component() or DataPolicyService()
        self.router.add_api_route("/get_policy", self.get_policy, methods=["POST"])
        self.router.add_api_route("/get_all_policies", self.get_all_policies, methods=["POST"])

    @requires_auth
    async def get_policy(self, request: Request, body: GetPolicyRequestPayload) -> GetPolicyResponsePayload:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            policy = await self._policies.get_policy(session, policy_id=body.policy_id)
            allowed = await self._policies.policies_for_agency(session, agency_id)
        if policy.policy_id not in {item.policy_id for item in allowed}:
            raise BadRequestError(message="Policy is not part of this agency")
        return GetPolicyResponsePayload(policy=policy)

    @requires_auth
    async def get_all_policies(
        self, request: Request, body: GetAllPoliciesRequestPayload
    ) -> GetAllPoliciesResponsePayload:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            policies = await self._policies.policies_for_agency(session, agency_id)
        if body.policy_target is not None:
            policies = [policy for policy in policies if policy.policy_target == body.policy_target]
        if body.register_id is not None:
            policies = [policy for policy in policies if policy.register_id == body.register_id]
        return GetAllPoliciesResponsePayload(policies=policies)
