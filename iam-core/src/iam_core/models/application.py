from typing import Optional

from openg2p_fastapi_common.models import BaseORMModelWithTimes
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .enum import ApplicationType, SyncStatus


class Application(BaseORMModelWithTimes):
    __tablename__ = "applications"

    application_mnemonic: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # Which audience this client belongs to. Existing rows are staff.
    application_type: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=ApplicationType.STAFF.value,
        server_default=ApplicationType.STAFF.value,
    )
    application_description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    icon_base64: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    application_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # True when this staff application is a registry (has register APIs for
    # data-policy builders). Used to filter registry apps in the staff UI.
    is_registry: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Registry staff API base URL. Staff UI uses this for register/fields/values
    # when building DP_ / staff-scoped policies against that registry.
    staff_api_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Registry agent API base URL (same response shape as staff). IAM agent UI
    # and staff AGC_ policy builders use this for agency/agent data policies.
    agent_api_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # True for rows pushed in by an application (e.g. a registry self-registering
    # via the API), False for rows seeded from the bundled dataset. Used so the
    # seed loader never overwrites self-registered rows.
    is_self_registered: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Used when application_type is agent. The worker creates clients, then the group.
    client_status: Mapped[str] = mapped_column(
        String, nullable=False, default=SyncStatus.SYNCED.value, server_default=SyncStatus.SYNCED.value
    )
    client_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    group_status: Mapped[str] = mapped_column(
        String, nullable=False, default=SyncStatus.SYNCED.value, server_default=SyncStatus.SYNCED.value
    )
    group_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
