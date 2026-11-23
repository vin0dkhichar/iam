from typing import Optional

from openg2p_fastapi_common.models import BaseORMModelWithTimes
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .enum import SyncStatus


class Role(BaseORMModelWithTimes):
    __tablename__ = "roles"

    role_mnemonic: Mapped[str] = mapped_column(String, nullable=False)
    role_description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    application_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # Existing rows are already in Keycloak. New rows stay pending until the worker creates them.
    sync_status: Mapped[str] = mapped_column(
        String, nullable=False, default=SyncStatus.SYNCED.value, server_default=SyncStatus.SYNCED.value
    )
    sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
