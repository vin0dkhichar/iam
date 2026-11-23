"""Agency admin creates and lists the agents in the agency from their token group."""

from fastapi import Request
from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError, ForbiddenError

from iam_core.models.agency import app_client_id
from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
from iam_core.models.user import User
from iam_core.services.user_service import UserService
from iam_core.user_auth.decorators import requires_auth

from ..helpers.agency import agency_id_from_request, require_agency_admin
from ..schemas import (
    AgentUserListResponse,
    AgentUserResponse,
    AssignRolesBody,
    AssignRolesResponse,
    CreateAgentBody,
    CreateAgentResponse,
)


def _user_row(user) -> AgentUserResponse:
    return AgentUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        agency_id=user.agency_id,
        enabled=user.enabled,
        sync_status=user.sync_status,
        keycloak_user_id=user.keycloak_user_id,
    )


class UsersController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.prefix = "/users"
        self.router.tags += ["users"]
        self._service = UserService()
        self.router.add_api_route("", self.list_users, methods=["GET"])
        self.router.add_api_route("/create", self.create_user, methods=["POST"])
        self.router.add_api_route("/assign_roles", self.assign_roles, methods=["POST"])
        self.router.add_api_route("/delete", self.delete_user, methods=["POST"])

    @requires_auth
    async def list_users(self, request: Request) -> AgentUserListResponse:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            users = await self._service.list_for_agency(session, agency_id)
        return AgentUserListResponse(agency_id=agency_id, users=[_user_row(user) for user in users])

    @requires_auth
    async def create_user(self, request: Request, body: CreateAgentBody) -> CreateAgentResponse:
        agency_id = agency_id_from_request(request)
        session_maker = get_async_session_maker()
        require_agency_admin(request)
        roles = sorted({item.strip() for item in body.roles if item.strip()})
        async with session_maker() as session:
            user = await self._service.create_user(
                session,
                realm=ApplicationType.AGENT.value,
                email=body.email,
                first_name=body.first_name,
                last_name=body.last_name,
                agency_id=agency_id,
                keycloak_clients=[{"client_id": app_client_id(agency_id), "roles": roles}],
            )
            await session.commit()
            user_id = user.id
        return CreateAgentResponse(id=user_id, agency_id=agency_id, sync_status="pending")

    @requires_auth
    async def assign_roles(self, request: Request, body: AssignRolesBody) -> AssignRolesResponse:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        roles = sorted({item.strip() for item in body.roles if item.strip()})
        if not roles:
            raise BadRequestError(message="Choose at least one role")
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            user = await session.get(User, body.user_id)
            if user is None or user.realm != ApplicationType.AGENT.value or user.agency_id != agency_id:
                raise ForbiddenError(message="User is not in this agency")
            user.keycloak_clients = [{"client_id": app_client_id(agency_id), "roles": roles}]
            user.sync_action = SyncAction.UPDATE_ROLES.value
            user.sync_status = SyncStatus.PENDING.value
            await session.commit()
        return AssignRolesResponse(user_id=body.user_id, roles=roles)

    @requires_auth
    async def delete_user(self, request: Request, user_id: str) -> dict:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            user = await session.get(User, user_id)
            if user is None or user.agency_id != agency_id:
                raise ForbiddenError(message="User is not in this agency")
            if not user.keycloak_user_id:
                await session.delete(user)
            else:
                user.sync_action = SyncAction.DELETE.value
                user.sync_status = SyncStatus.PENDING.value
            await session.commit()
        return {"id": user_id, "sync_status": "pending"}
