import logging

import celery
from celery import Celery

from app.settings import settings

celery_app = Celery("speech_features", broker="redis://redis:6379/0")

celery_app.conf.task_routes = {
    "app.worker.process_shennong_job": {"queue": settings.PROCESSING_QUEUE},
}

celery_app.conf.result_backend = f"db+{settings.POSTGRES_CONNECTION_STRING}"


@celery.signals.after_setup_logger.connect
def on_after_setup_logger(**kwargs):
    """Enable celery loggin"""
    logger = logging.getLogger("celery")
    logger.propagate = True
    logger = logging.getLogger("celery.app.trace")
    logger.propagate = True
