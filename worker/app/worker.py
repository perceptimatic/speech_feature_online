from os import path
from time import sleep
from typing import Any, Dict, List

from celery.utils.log import get_task_logger

from app.analyse import process_data
from app.celery_app import celery_app
from app.email.test_provider import LocalEmailProvider

logger = get_task_logger(__name__)


@celery_app.task()
def celery_test(word: str) -> str:
    """Test the celery integration."""
    sleep(15)
    return f"test task return {word}"


@celery_app.task()
def process_shennong_job(file_paths: List[str], data: Dict[str, Any]):
    logger.debug(file_paths, data)
    """Run the shennong job."""
    email = data["email"]
    res_type = data["res"]
    channel = data["channel"]
    settings = data["analyses"]
    url = process_data(file_paths, settings, res_type, channel)
    link = f"<a target='_blank' href='{url}' download>click</a>"
    mailer = LocalEmailProvider("results", email, link)
    mailer.send()
    return url
