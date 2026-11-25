"""Data policy controller for IAM service."""

import logging

from fastapi import Request
from openg2p_fastapi_common.context import get_async_session_maker
from iam_core.schemas.data_policy import (
    AddPolicyRequest,
    AddPolicyResponse,
    AddPolicyResponseBody,
    AddPolicyResponsePayload,
    GetAllPoliciesRequest,
    GetAllPoliciesResponse,
    GetAllPoliciesResponseBody,
    GetAllPoliciesResponsePayload,
    GetPolicyRequest,
    GetPolicyResponse,
    GetPolicyResponseBody,
    GetPolicyResponsePayload,
    RemovePolicyRequest,
    RemovePolicyResponse,
    RemovePolicyResponseBody,
    RemovePolicyResponsePayload,
)
from iam_core.services.data_policy_service import DataPolicyService
from iam_core.user_auth.decorators import require_permissions
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from ..helpers.request_response_helper import RequestResponseHelper

_logger = logging.getLogger(__name__)


class DataPolicyController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._service = DataPolicyService.get_component()
        self.router.tags += ["/data-policies"]
        self.router.prefix = "/data-policies"
        self.helper = RequestResponseHelper.get_component()

        self.router.add_api_route(
            "/get_policy",
            self.get_policy,
            responses={200: {"model": GetPolicyResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/get_all_policies",
            self.get_all_policies,
            responses={200: {"model": GetAllPoliciesResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/add_policy",
            self.add_policy,
            responses={200: {"model": AddPolicyResponse}},
            methods=["POST"],
        )
        self.router.add_api_route(
            "/remove_policy",
            self.remove_policy,
            responses={200: {"model": RemovePolicyResponse}},
            methods=["POST"],
        )

    @require_permissions({"dataPolicy:view"})
    async def get_policy(self, request: GetPolicyRequest) -> GetPolicyResponse:
        try:
            payload = request.request_body.request_payload
            _logger.info("Getting data policy policy_id=%s", payload.policy_id)

            session_maker = get_async_session_maker()
            async with session_maker() as session:
                policy = await self._service.get_policy(
                    session,
                    policy_id=payload.policy_id,
                )
            return self.helper.construct_payload_response(
                request,
                GetPolicyResponsePayload(policy=policy),
                GetPolicyResponseBody,
                GetPolicyResponse,
            )
        except Exception as error_exception:
            _logger.error("Error in get_policy: %s", error_exception)
            raise BadRequestError(message=str(error_exception))

    @require_permissions({"dataPolicy:view"})
    async def get_all_policies(self, request: GetAllPoliciesRequest) -> GetAllPoliciesResponse:
        try:
            payload = request.request_body.request_payload
            _logger.info(
                "Getting all data policies with application_id=%s, policy_target=%s, register_id=%s",
                payload.application_id,
                payload.policy_target,
                payload.register_id,
            )

            session_maker = get_async_session_maker()
            async with session_maker() as session:
                policies, total = await self._service.get_all_policies(
                    session,
                    application_id=payload.application_id,
                    policy_target=payload.policy_target.value if payload.policy_target else None,
                    register_id=payload.register_id,
                )
            return self.helper.construct_payload_response(
                request,
                GetAllPoliciesResponsePayload(policies=policies),
                GetAllPoliciesResponseBody,
                GetAllPoliciesResponse,
                total=total,
                page_size=(
                    request.request_body.pagination_request.page_size
                    if request.request_body and request.request_body.pagination_request
                    else None
                ),
            )
        except Exception as error_exception:
            _logger.error("Error in get_all_policies: %s", error_exception)
            raise BadRequestError(message=str(error_exception))

    @require_permissions({"dataPolicy:create"})
    async def add_policy(self, request: AddPolicyRequest, http_request: Request) -> AddPolicyResponse:
        try:
            payload = request.request_body.request_payload
            _logger.info(
                "Adding data policy mnemonic=%s register_id=%s policy_target=%s application_id=%s",
                payload.policy_mnemonic,
                payload.register_id,
                payload.policy_target,
                payload.application_id,
            )

            session_maker = get_async_session_maker()
            async with session_maker() as session:
                mnemonic = payload.policy_mnemonic
                application = None
                if payload.application_id is not None:
                    from iam_core.models.application import Application
                    from iam_core.models.enum import ApplicationType
                    from iam_core.user_auth.helpers.data_policy_role_helper import (
                        AGC_ROLE_PREFIX,
                        DP_ROLE_PREFIX,
                        agency_scoped_policy_mnemonic,
                        strip_policy_prefix,
                    )

                    application = await session.get(Application, payload.application_id)
                    if application is None:
                        raise BadRequestError(message="Application not found")
                    if application.application_type == ApplicationType.AGENT.value:
                        # AGC_<agency>_<name> — roles land on agent-app Keycloak client.
                        mnemonic = agency_scoped_policy_mnemonic(
                            AGC_ROLE_PREFIX,
                            application.application_mnemonic,
                            mnemonic,
                        )
                    else:
                        bare = strip_policy_prefix(mnemonic)
                        mnemonic = f"{DP_ROLE_PREFIX}{bare}"

                policy = await self._service.add_policy(
                    policy_mnemonic=mnemonic,
                    policy_description=payload.policy_description,
                    register_id=payload.register_id,
                    policy_filter_expression=payload.policy_filter_expression,
                    session=session,
                    policy_type=payload.policy_type,
                    policy_target=payload.policy_target,
                    application_id=payload.application_id,
                )

                if payload.application_id is not None:
                    from sqlalchemy import select

                    from iam_core.models import Role
                    from iam_core.models.enum import ApplicationType, SyncStatus
                    from iam_core.services.user_service import UserService
                    from iam_core.user_auth.helpers.data_policy_role_helper import AGC_ROLE_PREFIX

                    existing_role = await session.scalar(
                        select(Role).where(
                            Role.application_id == payload.application_id,
                            Role.role_mnemonic == mnemonic,
                        )
                    )
                    if existing_role is None:
                        session.add(
                            Role(
                                application_id=payload.application_id,
                                role_mnemonic=mnemonic,
                                role_description=payload.policy_description,
                                sync_status=SyncStatus.PENDING.value,
                                active=True,
                            )
                        )
                    # AGC_ roles are inherited by every agency user; queue Keycloak UPDATE_ROLES.
                    if (
                        mnemonic.startswith(AGC_ROLE_PREFIX)
                        and application is not None
                        and application.application_type == ApplicationType.AGENT.value
                    ):
                        policies = await self._service.policies_for_agency(
                            session, application.application_mnemonic
                        )
                        agc_roles = [
                            item.policy_mnemonic
                            for item in policies
                            if str(item.policy_mnemonic).startswith(AGC_ROLE_PREFIX)
                        ]
                        await UserService().refresh_inherited_agc_roles(
                            session,
                            agency_id=application.application_mnemonic,
                            agc_roles=agc_roles,
                        )

                await session.commit()
            return self.helper.construct_payload_response(
                request,
                AddPolicyResponsePayload(policy=policy),
                AddPolicyResponseBody,
                AddPolicyResponse,
            )
        except Exception as error_exception:
            _logger.error("Error in add_policy: %s", error_exception)
            raise BadRequestError(message=str(error_exception))

    @require_permissions({"dataPolicy:delete"})
    async def remove_policy(
        self, request: RemovePolicyRequest, http_request: Request
    ) -> RemovePolicyResponse:
        try:
            payload = request.request_body.request_payload
            _logger.info("Removing data policy policy_id=%s", payload.policy_id)

            session_maker = get_async_session_maker()
            async with session_maker() as session:
                # Get policy first to check if it's an IAM application policy
                from iam_core.models import DataPolicy

                policy = await session.get(DataPolicy, payload.policy_id)
                if not policy:
                    raise BadRequestError(message=f"Data policy not found: {payload.policy_id}")

                application_id = policy.application_id
                policy_mnemonic = policy.policy_mnemonic
                deleted_id, _, should_delete_role = await self._service.remove_policy(
                    policy_id=payload.policy_id,
                    session=session,
                )
                from sqlalchemy import select

                from iam_core.models import Role
                from iam_core.models.application import Application
                from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
                from iam_core.services.user_service import UserService
                from iam_core.user_auth.helpers.data_policy_role_helper import AGC_ROLE_PREFIX

                if should_delete_role and application_id is not None:
                    role = await session.scalar(
                        select(Role).where(
                            Role.application_id == application_id,
                            Role.role_mnemonic == policy_mnemonic,
                        )
                    )
                    if role is not None:
                        role.active = False
                        role.sync_status = SyncStatus.PENDING.value
                        role.sync_error = SyncAction.DELETE.value
                # Drop removed AGC_ from agency users and queue Keycloak UPDATE_ROLES.
                if application_id is not None and str(policy_mnemonic).startswith(AGC_ROLE_PREFIX):
                    application = await session.get(Application, application_id)
                    if (
                        application is not None
                        and application.application_type == ApplicationType.AGENT.value
                    ):
                        policies = await self._service.policies_for_agency(
                            session, application.application_mnemonic
                        )
                        agc_roles = [
                            item.policy_mnemonic
                            for item in policies
                            if str(item.policy_mnemonic).startswith(AGC_ROLE_PREFIX)
                        ]
                        await UserService().refresh_inherited_agc_roles(
                            session,
                            agency_id=application.application_mnemonic,
                            agc_roles=agc_roles,
                        )
                await session.commit()
            return self.helper.construct_payload_response(
                request,
                RemovePolicyResponsePayload(policy_id=deleted_id),
                RemovePolicyResponseBody,
                RemovePolicyResponse,
            )
        except Exception as error_exception:
            _logger.error("Error in remove_policy: %s", error_exception)
            raise BadRequestError(message=str(error_exception))
