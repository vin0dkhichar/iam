from pydantic import BaseModel, Field

from iam_core.schemas.data_policy import DataPolicyType


class CreateAgencyBody(BaseModel):
    agency_id: str
    name: str


class CreateAgencyAdminBody(BaseModel):
    agency_id: str
    email: str
    first_name: str
    last_name: str


class AddAgencyPolicyBody(BaseModel):
    policy_mnemonic: str
    policy_description: str | None = None
    register_id: str | None = None
    policy_type: DataPolicyType = DataPolicyType.ALLOW
    policy_target: str = "REGISTER_RECORD"
    policy_filter_expression: dict = Field(default_factory=dict)
    application_id: int | None = None
