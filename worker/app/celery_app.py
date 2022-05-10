import logging
from logging.handlers import TimedRotatingFileHandler
from os import path

import celery
from celery import Celery

from app.settings import settings

celery_app = Celery("speech_features")

celery_app.config_from_object("app.celeryconfig")

celery_app.conf.task_routes = {
    "app.worker.process_shennong_job": {"queue": settings.PROCESSING_QUEUE},
}


@celery.signals.after_setup_logger.connect
def on_after_setup_logger(logger, *args, **kwargs):

    formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s: %(message)s")

    file_handler = TimedRotatingFileHandler(
        path.join(path.dirname(__file__), "logs", "errors.log"),
        when="D",
        backupCount=10,
        interval=1,
    )
    file_handler.setLevel(logging.ERROR)
    file_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
