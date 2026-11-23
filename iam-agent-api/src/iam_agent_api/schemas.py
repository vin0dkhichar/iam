from pydantic import BaseModel


class CreateAgentBody(BaseModel):
    first_name: str
    last_name: str
    email: str
    roles: list[str] = []


class AssignRolesBody(BaseModel):
    user_id: str
    roles: list[str]


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


class AgentUserListResponse(BaseModel):
    agency_id: str
    users: list[AgentUserResponse]


class CreateAgentResponse(BaseModel):
    id: str
    agency_id: str
    sync_status: str


class AgencyRolesResponse(BaseModel):
    roles: list[str]


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
