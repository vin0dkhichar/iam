from pydantic import BaseModel, Field


class ClientRoles(BaseModel):
    client_id: str
    role_mnemonics: list[str] = Field(default_factory=list)


class RoleLookup(BaseModel):
    clients: list[ClientRoles] = Field(default_factory=list)


class PermissionsLookupResponse(BaseModel):
    # client_id -> permission mnemonics for that client's roles only
    permissions: dict[str, list[str]] = Field(default_factory=dict)
