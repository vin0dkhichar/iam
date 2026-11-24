from pydantic import BaseModel, Field


class CreateAgentBody(BaseModel):
    first_name: str
    last_name: str
    email: str
    roles: list[str] = []


class AssignRolesBody(BaseModel):
    user_id: str
    roles: list[str]


class ListUsersBody(BaseModel):
    current_page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, ge=1, le=100)


class AgentUserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    agency_id: str | None = None
    enabled: str
    sync_status: str
    roles: list[str] = []
    keycloak_user_id: str | None = None


class AgentUserListPagination(BaseModel):
    current_page: int
    page_size: int
    number_of_items: int
    number_of_pages: int


class AgentUserListResponse(BaseModel):
    agency_id: str
    users: list[AgentUserResponse]
    pagination: AgentUserListPagination


class CreateAgentResponse(BaseModel):
    id: str
    agency_id: str
    sync_status: str


class AgencyRoleItem(BaseModel):
    role_mnemonic: str
    sync_status: str | None = None


class AgencyRolesResponse(BaseModel):
    roles: list[AgencyRoleItem]


class AgencyPolicyItem(BaseModel):
    policy_id: str
    policy_mnemonic: str
    policy_description: str | None = None
    policy_target: str
    policy_type: str
    register_id: str | None = None
    policy_filter_expression: dict | None = None
    sync_status: str | None = None


class AgencyPoliciesResponse(BaseModel):
    policies: list[AgencyPolicyItem]


class AssignRolesResponse(BaseModel):
    user_id: str
    roles: list[str]
