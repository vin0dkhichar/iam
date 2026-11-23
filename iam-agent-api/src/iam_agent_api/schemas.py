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
    keycloak_user_id: str | None = None


class AgentUserListResponse(BaseModel):
    agency_id: str
    users: list[AgentUserResponse]


class CreateAgentResponse(BaseModel):
    id: str
    agency_id: str
    sync_status: str


class AssignRolesResponse(BaseModel):
    user_id: str
    roles: list[str]
