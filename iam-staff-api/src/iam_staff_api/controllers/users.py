"""Staff adds agency admins after the agency group exists. The worker assigns AGENCY_ADMIN."""

from __future__ import annotations
from typing import Any

from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError

from iam_core.models import User
from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
from iam_core.services.data_policy_service import DataPolicyService
from iam_core.services.user_service import UserService
from iam_core.user_auth.decorators import require_permissions
from iam_core.user_auth.helpers.data_policy_role_helper import DP_ROLE_PREFIX
from ..config import Settings
from .agencies import admin_client_roles, require_synced_agency
from ..schemas import (
    AgencyUserItem,
    AgencyUsersBody,
    AgencyUsersPagination,
    AgencyUsersResponse,
    AssignPoliciesBody,
    AssignPoliciesResponse,
    CreateAgencyAdminBody,
    CreateAgencyAdminResponse,
)


class UsersController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.prefix = "/users"
        self.router.tags += ["users"]
        self._service = UserService()
        self._policies = DataPolicyService.get_component() or DataPolicyService()
        self._settings = Settings.get_config(strict=False)
        self.router.add_api_route("/create_agency_admin", self.create_agency_admin, methods=["POST"])
        self.router.add_api_route("/get_agency_users", self.get_agency_users, methods=["POST"])
        self.router.add_api_route("/assign_policies", self.assign_policies, methods=["POST"])

    @require_permissions({"user:create"})
    async def create_agency_admin(self, body: CreateAgencyAdminBody) -> CreateAgencyAdminResponse:
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            await require_synced_agency(session, body.agency_id)
            user = await self._service.create_user(
                session,
                realm=ApplicationType.AGENT.value,
                email=body.email,
                first_name=body.first_name,
                last_name=body.last_name,
                agency_id=body.agency_id,
                keycloak_clients=admin_client_roles(),
            )
            await session.commit()
            user_id = user.id
        return CreateAgencyAdminResponse(
            id=user_id,
            agency_id=body.agency_id,
            sync_status="pending",
        )

    @require_permissions({"application:view"})
    async def get_agency_users(self, body: AgencyUsersBody) -> AgencyUsersResponse:
        page = max(1, body.current_page or 1)
        page_size = max(1, min(body.page_size or 10, 100))
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            users, total = await self._service.list_for_agency(
                session, body.agency_id, page=page, page_size=page_size
            )
            pages = (total + page_size - 1) // page_size if page_size else 0
            return AgencyUsersResponse(
                items=[
                    AgencyUserItem(
                        id=user.id,
                        email=user.email,
                        first_name=user.first_name,
                        last_name=user.last_name,
                        sync_status=user.sync_status,
                        enabled=user.enabled,
                    )
                    for user in users
                ],
                pagination=AgencyUsersPagination(
                    current_page=page,
                    page_size=page_size,
                    number_of_items=total,
                    number_of_pages=pages,
                ),
            )

    @require_permissions({"user:create"})
    async def assign_policies(self, body: AssignPoliciesBody) -> AssignPoliciesResponse:
        """Give an existing staff user the DP_ roles for policies that already exist."""
        wanted = sorted({mnemonic.strip() for mnemonic in body.policy_mnemonics if mnemonic.strip()})
        if not wanted:
            raise BadRequestError(message="Choose at least one policy")
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            known = await self._policies.get_policies_by_mnemonics(wanted, session)
            known_mnemonics = {policy.policy_mnemonic for policy in known}
            if any(mnemonic not in known_mnemonics for mnemonic in wanted):
                raise BadRequestError(message="Policy does not exist")
            user = await session.get(User, body.user_id)
            if user is None or user.realm != ApplicationType.STAFF.value or not user.keycloak_user_id:
                raise BadRequestError(message="User is not a staff user yet")
            names = [f"{DP_ROLE_PREFIX}{mnemonic}" for mnemonic in wanted]
            clients = list(user.keycloak_clients or [])
            matched = next(
                (entry for entry in clients if entry.get("client_id") == self._settings.keycloak_client_id),
                None,
            )
            if matched is None:
                clients.append({"client_id": self._settings.keycloak_client_id, "roles": names})
            else:
                matched["roles"] = sorted(set[Any](matched.get("roles") or []) | set(names))
            user.keycloak_clients = clients
            user.sync_action = SyncAction.UPDATE_ROLES.value
            user.sync_status = SyncStatus.PENDING.value
            await session.commit()
        return AssignPoliciesResponse(user_id=body.user_id, policy_mnemonics=wanted)
