# ruff: noqa: E402

from .config import Settings

# Register IAM_CELERY_DB_* before fastapi-common builds the database engine.
_config = Settings.get_config()

from celery import Celery
from openg2p_fastapi_common.app import Initializer as BaseInitializer


class Initializer(BaseInitializer):
    def initialize(self, **kwargs):
        super().initialize()


celery_app = Celery(
    "iam_celery_worker",
    broker=_config.celery_broker_url,
    backend=_config.celery_backend_url,
    include=["openg2p_iam_celery_worker.tasks"],
)
celery_app.conf.timezone = "UTC"
celery_app.conf.task_default_queue = _config.worker_queue
