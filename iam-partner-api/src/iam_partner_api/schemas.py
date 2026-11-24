from pydantic import BaseModel


class CreateAgencyBody(BaseModel):
    agency_id: str
    name: str


class CreateAgencyResponse(BaseModel):
    id: str
    agency_id: str
    client_status: str
    group_status: str


class CreateAgencyAdminBody(BaseModel):
    agency_id: str
    email: str
    first_name: str
    last_name: str


class CreateAgencyAdminResponse(BaseModel):
    id: str
    agency_id: str
    sync_status: str
