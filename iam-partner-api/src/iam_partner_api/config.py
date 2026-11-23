from iam_core.user_auth.config import Settings as BaseSettings
from pydantic_settings import SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="iam_partner_",
        env_file=".env",
        extra="allow",
        env_nested_delimiter="__",
    )
    # Same switch as the registry DCI controller. Off until a partner key is configured.
    signature_validation_enabled: bool = False
