"""Select pending rows and queue one worker task for each."""

import asyncio

from openg2p_fastapi_common.context import get_async_session_maker
from sqlalchemy import select

from iam_core.models.application import Application
from iam_core.models.enum import ApplicationType, SyncStatus
from iam_core.models.role import Role
from iam_core.models.user import User

from .app import celery_app
from .config import Settings

_config = Settings.get_config()


async def queue_pending() -> None:
    limit = _config.provision_users_batch_size
    session_maker = get_async_session_maker()
    async with session_maker() as session:
        applications = (
            await session.scalars(
                select(Application).where(Application.client_status == SyncStatus.PENDING.value).limit(limit)
            )
        ).all()
        agencies = (
            await session.scalars(
                select(Application)
                .where(
                    Application.application_type == ApplicationType.AGENT.value,
                    Application.client_status == SyncStatus.SYNCED.value,
                    Application.group_status == SyncStatus.PENDING.value,
                )
                .limit(limit)
            )
        ).all()
        roles = (
            await session.scalars(
                select(Role)
                .join(Application, Role.application_id == Application.id)
                .where(
                    Role.sync_status == SyncStatus.PENDING.value,
                    Application.client_status == SyncStatus.SYNCED.value,
                )
                .limit(limit)
            )
        ).all()
        users = (
            await session.scalars(
                select(User).where(User.sync_status == SyncStatus.PENDING.value).limit(limit)
            )
        ).all()

        application_ids = [row.id for row in applications]
        agency_ids = [row.id for row in agencies]
        role_ids = [row.id for row in roles]
        user_ids = [row.id for row in users]
        for row in applications:
            row.client_status = SyncStatus.SYNCING.value
        for row in agencies:
            row.group_status = SyncStatus.SYNCING.value
        for row in roles:
            row.sync_status = SyncStatus.SYNCING.value
        for row in users:
            row.sync_status = SyncStatus.SYNCING.value
        await session.commit()

    for application_id in application_ids:
        celery_app.send_task("iam.provision_application", args=(application_id,), queue=_config.worker_queue)
    for agency_id in agency_ids:
        celery_app.send_task("iam.provision_agency_group", args=(agency_id,), queue=_config.worker_queue)
    for role_id in role_ids:
        celery_app.send_task("iam.provision_role", args=(role_id,), queue=_config.worker_queue)
    for user_id in user_ids:
        celery_app.send_task("iam.provision_user", args=(user_id,), queue=_config.worker_queue)


@celery_app.task(name="iam.provision_users_beat")
def provision_users_beat() -> None:
    asyncio.run(queue_pending())
