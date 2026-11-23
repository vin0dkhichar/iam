import uuid

from openg2p_fastapi_common.models import BaseORMModelWithTimes
from sqlalchemy import Index, JSON, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from .enum import SyncAction, SyncStatus


class User(BaseORMModelWithTimes):
    """Local user row. Keycloak is filled in later by the provision worker.

    Email is the Keycloak username and is unique inside a realm.
    agency_id, when set, is the application mnemonic: the Keycloak client id
    and the agency group name. An agent user has one. Staff and beneficiary
    users do not.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    realm: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    agency_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    enabled: Mapped[str] = mapped_column(String, nullable=False, default="true")
    keycloak_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    # Clients and roles the worker must apply in Keycloak. Example:
    # [{"client_id": "agent-web", "roles": ["AGENCY_ADMIN"]}]
    keycloak_clients: Mapped[list | None] = mapped_column(JSON, nullable=True)
    sync_action: Mapped[str] = mapped_column(String, nullable=False, default=SyncAction.CREATE.value)
    sync_status: Mapped[str] = mapped_column(String, nullable=False, default=SyncStatus.PENDING.value)
    sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index(
            "ix_users_realm_email_unique",
            "realm",
            text("lower(email)"),
            unique=True,
        ),
    )
