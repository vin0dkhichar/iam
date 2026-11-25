"""Agency admin creates and lists the agents in the agency from their token group."""

from fastapi import Request
from openg2p_fastapi_common.context import get_async_session_maker
from openg2p_fastapi_common.controller import BaseController
from openg2p_fastapi_common.errors.http_exceptions import BadRequestError, ForbiddenError
from sqlalchemy import select

from iam_core.helpers.agency import (
    AGENCY_ADMIN_ROLE,
    AGENT_APP_CLIENT,
    AGENT_PORTAL_CLIENT,
    merge_agency_client_roles,
)
from iam_core.models.application import Application
from iam_core.models.enum import ApplicationType, SyncAction, SyncStatus
from iam_core.models.role import Role
from iam_core.models.user import User
from iam_core.schemas.data_policy import DataPolicyType
from iam_core.services.data_policy_service import DataPolicyService
from iam_core.services.user_service import UserService
from iam_core.user_auth.decorators import requires_auth
from iam_core.user_auth.helpers.data_policy_role_helper import (
    AGC_ROLE_PREFIX,
    AGT_ROLE_PREFIX,
    DP_ROLE_PREFIX,
)

from ..helpers.agency import agency_id_from_request, require_agency_admin
from ..schemas import (
    AddAgentPolicyBody,
    AddAgentPolicyResponse,
    AgencyPoliciesResponse,
    AgencyPolicyItem,
    AgencyResponse,
    AgencyRoleItem,
    AgencyRolesResponse,
    AgentUserListPagination,
    AgentUserListResponse,
    AgentUserResponse,
    AssignRolesBody,
    AssignRolesResponse,
    CreateAgentBody,
    CreateAgentResponse,
    ListUsersBody,
    RegistryApplicationItem,
    RegistryApplicationsResponse,
    RemoveAgentPolicyBody,
    RemoveAgentPolicyResponse,
)


def _user_roles(user) -> list[str]:
    """AGC_/AGT_ roles from agent-app (legacy per-agency client still accepted).

    AGENCY_ADMIN on agent-portal stays out of this list.
    """
    agency_id = user.agency_id
    allowed_clients = {AGENT_APP_CLIENT}
    if agency_id:
        allowed_clients.add(agency_id)
    roles: list[str] = []
    for entry in user.keycloak_clients or []:
        client_id = entry.get("client_id")
        if client_id in {AGENT_PORTAL_CLIENT, "agency-web"}:
            continue
        if client_id not in allowed_clients:
            continue
        for role in entry.get("roles") or []:
            if role and role != AGENCY_ADMIN_ROLE:
                roles.append(role)
    return sorted(set(roles))


def _user_row(user) -> AgentUserResponse:
    return AgentUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        agency_id=user.agency_id,
        enabled=user.enabled,
        sync_status=user.sync_status,
        roles=_user_roles(user),
        keycloak_user_id=user.keycloak_user_id,
    )


class UsersController(BaseController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router.prefix = "/users"
        self.router.tags += ["users"]
        self._service = UserService()
        self.router.add_api_route("", self.list_users, methods=["POST"])
        self.router.add_api_route("/agency", self.get_agency, methods=["POST"])
        self.router.add_api_route("/registries", self.list_registries, methods=["POST"])
        # Roles menu removed from agent UI — keep handler, comment route.
        # self.router.add_api_route("/roles", self.list_roles, methods=["POST"])
        self.router.add_api_route("/data-policies", self.list_data_policies, methods=["POST"])
        self.router.add_api_route("/data-policies/add", self.add_agent_policy, methods=["POST"])
        self.router.add_api_route("/data-policies/remove", self.remove_agent_policy, methods=["POST"])
        self.router.add_api_route("/create", self.create_user, methods=["POST"])
        self.router.add_api_route("/assign_roles", self.assign_roles, methods=["POST"])
        self.router.add_api_route("/delete", self.delete_user, methods=["POST"])

    @requires_auth
    async def get_agency(self, request: Request) -> AgencyResponse:
        """Current agency from the token, including staff/agent API URLs for BFF calls."""
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            agency = await session.scalar(
                select(Application).where(
                    Application.application_mnemonic == agency_id,
                    Application.application_type == ApplicationType.AGENT.value,
                    Application.active.is_(True),
                )
            )
        if agency is None:
            raise BadRequestError(message="Agency does not exist")
        return AgencyResponse(
            agency_id=agency.application_mnemonic,
            name=agency.application_description,
            staff_api_url=agency.staff_api_url,
            agent_api_url=agency.agent_api_url,
        )

    @requires_auth
    async def list_registries(self, request: Request) -> RegistryApplicationsResponse:
        """Staff applications flagged is_registry — for AGT_ register pickers."""
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            apps = (
                await session.execute(
                    select(Application)
                    .where(
                        Application.active.is_(True),
                        Application.application_type == ApplicationType.STAFF.value,
                        Application.is_registry.is_(True),
                    )
                    .order_by(
                        Application.order.asc().nullslast(),
                        Application.id.asc(),
                    )
                )
            ).scalars().all()
        return RegistryApplicationsResponse(
            items=[
                RegistryApplicationItem(
                    id=app.id,
                    application_mnemonic=app.application_mnemonic,
                    application_description=app.application_description,
                    staff_api_url=app.staff_api_url,
                    agent_api_url=app.agent_api_url,
                )
                for app in apps
            ]
        )

    @requires_auth
    async def list_users(self, request: Request, body: ListUsersBody) -> AgentUserListResponse:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        page = body.current_page
        page_size = body.page_size
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            users, total = await self._service.list_for_agency(
                session, agency_id, page=page, page_size=page_size
            )
        pages = (total + page_size - 1) // page_size if page_size else 0
        return AgentUserListResponse(
            agency_id=agency_id,
            users=[_user_row(user) for user in users],
            pagination=AgentUserListPagination(
                current_page=page,
                page_size=page_size,
                number_of_items=total,
                number_of_pages=pages,
            ),
        )

    @requires_auth
    async def list_roles(self, request: Request) -> AgencyRolesResponse:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            application = await session.scalar(
                select(Application).where(
                    Application.application_mnemonic == agency_id,
                    Application.active.is_(True),
                )
            )
            if application is None:
                return AgencyRolesResponse(roles=[])
            rows = await session.scalars(
                select(Role)
                .where(
                    Role.application_id == application.id,
                    Role.active.is_(True),
                    ~Role.role_mnemonic.like(f"{AGC_ROLE_PREFIX}%"),
                    ~Role.role_mnemonic.like(f"{AGT_ROLE_PREFIX}%"),
                    ~Role.role_mnemonic.like(f"{DP_ROLE_PREFIX}%"),
                )
                .order_by(Role.role_mnemonic.asc())
            )
            return AgencyRolesResponse(
                roles=[
                    AgencyRoleItem(role_mnemonic=row.role_mnemonic, sync_status=row.sync_status)
                    for row in rows
                ]
            )

    def _policy_item(self, policy) -> AgencyPolicyItem:
        return AgencyPolicyItem(
            policy_id=policy.policy_id,
            policy_mnemonic=policy.policy_mnemonic,
            policy_description=policy.policy_description,
            policy_target=(
                policy.policy_target.value
                if hasattr(policy.policy_target, "value")
                else str(policy.policy_target)
            ),
            policy_type=(
                policy.policy_type.value if hasattr(policy.policy_type, "value") else str(policy.policy_type)
            ),
            register_id=policy.register_id,
            policy_filter_expression=policy.policy_filter_expression,
            sync_status=policy.sync_status,
        )

    async def _agc_policy_roles(self, session, agency_id: str) -> list[str]:
        """Every agency user inherits all AGC_ policies for the agency."""
        policies = await DataPolicyService().policies_for_agency(session, agency_id)
        return sorted(
            {
                policy.policy_mnemonic
                for policy in policies
                if str(policy.policy_mnemonic).startswith(AGC_ROLE_PREFIX)
            }
        )

    def _with_inherited_agc(self, roles: list[str], agc_roles: list[str]) -> list[str]:
        from iam_core.helpers.agency import with_inherited_agc_roles

        # Drop any stale AGC_ the client sent; always re-apply current agency AGC_ set.
        return with_inherited_agc_roles(roles, agc_roles)

    @requires_auth
    async def list_data_policies(self, request: Request) -> AgencyPoliciesResponse:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            policies = await DataPolicyService().policies_for_agency(session, agency_id)
        return AgencyPoliciesResponse(policies=[self._policy_item(policy) for policy in policies])

    @requires_auth
    async def add_agent_policy(self, request: Request, body: AddAgentPolicyBody) -> AddAgentPolicyResponse:
        """Create an AGT_ agency policy + pending Keycloak role for Celery sync."""
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        from iam_core.user_auth.helpers.data_policy_role_helper import agency_scoped_policy_mnemonic

        try:
            # AGT_<agency>_<name> — roles land on agent-app Keycloak client.
            mnemonic = agency_scoped_policy_mnemonic(
                AGT_ROLE_PREFIX, agency_id, body.policy_mnemonic
            )
        except ValueError as exc:
            raise BadRequestError(message="policy_mnemonic is required") from exc
        # Staff UI historically used DENY; IAM stores DISALLOW.
        raw_type = (body.policy_type or "ALLOW").strip().upper()
        if raw_type == "DENY":
            raw_type = DataPolicyType.DISALLOW.value
        try:
            policy_type = DataPolicyType(raw_type)
        except ValueError as exc:
            raise BadRequestError(message="policy_type must be ALLOW or DISALLOW") from exc
        expression = body.policy_filter_expression or {
            "type": "GROUP",
            "operator": "AND",
            "children": [],
        }
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            application = await session.scalar(
                select(Application).where(
                    Application.application_mnemonic == agency_id,
                    Application.application_type == ApplicationType.AGENT.value,
                    Application.active.is_(True),
                )
            )
            if application is None:
                raise BadRequestError(message="Agency does not exist")
            policy_target = (body.policy_target or "ATTRIBUTE").strip().upper()
            register_id = body.register_id.strip() if body.register_id else None
            if policy_target != "REGISTER_RECORD":
                register_id = None
            registry_application_id = body.registry_application_id
            if registry_application_id is None and body.registry_client_id:
                registry_application_id = await session.scalar(
                    select(Application.id).where(
                        Application.application_mnemonic == body.registry_client_id.strip(),
                        Application.application_type == ApplicationType.STAFF.value,
                        Application.active.is_(True),
                        Application.is_registry.is_(True),
                    )
                )
                if registry_application_id is None:
                    raise BadRequestError(message="Registry application not found")
            if registry_application_id is not None:
                registry_app = await session.get(Application, registry_application_id)
                if (
                    registry_app is None
                    or registry_app.application_type != ApplicationType.STAFF.value
                    or not registry_app.is_registry
                    or not registry_app.active
                ):
                    raise BadRequestError(message="Registry application not found")
            policy = await DataPolicyService().add_policy(
                policy_mnemonic=mnemonic,
                policy_description=body.policy_description,
                register_id=register_id,
                policy_filter_expression=expression,
                session=session,
                policy_type=policy_type,
                policy_target=policy_target,
                application_id=application.id,
                registry_application_id=registry_application_id,
            )
            existing_role = await session.scalar(
                select(Role).where(
                    Role.application_id == application.id,
                    Role.role_mnemonic == mnemonic,
                )
            )
            if existing_role is None:
                session.add(
                    Role(
                        application_id=application.id,
                        role_mnemonic=mnemonic,
                        role_description=body.policy_description,
                        sync_status=SyncStatus.PENDING.value,
                        active=True,
                    )
                )
            elif not existing_role.active:
                existing_role.active = True
                existing_role.sync_status = SyncStatus.PENDING.value
                existing_role.sync_error = None
            await session.commit()
        return AddAgentPolicyResponse(
            policy_id=policy.policy_id,
            policy_mnemonic=policy.policy_mnemonic,
            sync_status=policy.sync_status,
        )

    @requires_auth
    async def remove_agent_policy(
        self, request: Request, body: RemoveAgentPolicyBody
    ) -> RemoveAgentPolicyResponse:
        """Remove an AGT_ policy only; queue Keycloak role delete via Celery."""
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            policies = await DataPolicyService().policies_for_agency(session, agency_id)
            match = next((item for item in policies if item.policy_id == body.policy_id), None)
            if match is None:
                raise BadRequestError(message="Policy is not part of this agency")
            if not str(match.policy_mnemonic).startswith(AGT_ROLE_PREFIX):
                raise BadRequestError(message="Only AGT_ agent data policies can be removed here")
            application = await session.scalar(
                select(Application).where(
                    Application.application_mnemonic == agency_id,
                    Application.application_type == ApplicationType.AGENT.value,
                    Application.active.is_(True),
                )
            )
            deleted_id, policy_mnemonic, should_delete_role = await DataPolicyService().remove_policy(
                policy_id=body.policy_id,
                session=session,
            )
            if should_delete_role and application is not None:
                role = await session.scalar(
                    select(Role).where(
                        Role.application_id == application.id,
                        Role.role_mnemonic == policy_mnemonic,
                    )
                )
                if role is not None:
                    role.active = False
                    role.sync_status = SyncStatus.PENDING.value
                    role.sync_error = SyncAction.DELETE.value
            await session.commit()
        return RemoveAgentPolicyResponse(policy_id=deleted_id)

    @requires_auth
    async def create_user(self, request: Request, body: CreateAgentBody) -> CreateAgentResponse:
        agency_id = agency_id_from_request(request)
        session_maker = get_async_session_maker()
        require_agency_admin(request)
        roles = sorted(
            {item.strip() for item in body.roles if item.strip() and item.strip() != AGENCY_ADMIN_ROLE}
        )
        async with session_maker() as session:
            roles = self._with_inherited_agc(roles, await self._agc_policy_roles(session, agency_id))
            user = await self._service.create_user(
                session,
                realm=ApplicationType.AGENT.value,
                email=body.email,
                first_name=body.first_name,
                last_name=body.last_name,
                agency_id=agency_id,
                keycloak_clients=merge_agency_client_roles(None, agency_id, roles),
            )
            await session.commit()
            user_id = user.id
        return CreateAgentResponse(id=user_id, agency_id=agency_id, sync_status="pending")

    @requires_auth
    async def assign_roles(self, request: Request, body: AssignRolesBody) -> AssignRolesResponse:
        agency_id = agency_id_from_request(request)
        require_agency_admin(request)
        roles = sorted(
            {item.strip() for item in body.roles if item.strip() and item.strip() != AGENCY_ADMIN_ROLE}
        )
        # Roles UI removed — policy-only assignment may be empty (AGC_ still inherited).
        # if not roles:
        #     raise BadRequestError(message="Choose at least one role")
        session_maker = get_async_session_maker()
        async with session_maker() as session:
            user = await session.get(User, body.user_id)
            if (
                user is None
                or not user.active
                or user.realm != ApplicationType.AGENT.value
                or user.agency_id != agency_id
            ):
                raise ForbiddenError(message="User is not in this agency")
            roles = self._with_inherited_agc(roles, await self._agc_policy_roles(session, agency_id))
            user.keycloak_clients = merge_agency_client_roles(user.keycloak_clients, agency_id, roles)
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
            if user is None or not user.active or user.agency_id != agency_id:
                raise ForbiddenError(message="User is not in this agency")
            user.active = False
            if not user.keycloak_user_id:
                await session.delete(user)
            else:
                user.sync_action = SyncAction.DELETE.value
                user.sync_status = SyncStatus.PENDING.value
            await session.commit()
        return {"id": user_id, "sync_status": "pending"}
