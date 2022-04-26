import logging
from typing import Any, Dict, List

from app.analyse import process_data
from app.celery_app import celery_app
from app.email.test_provider import LocalEmailProvider


@celery_app.task()
def process_shennong_job(file_paths: List[str], data: Dict[str, Any]):
    """Run the shennong job."""

    email = data["email"]
    res_type = data["res"]
    channel = data["channel"]
    settings = data["analyses"]
    url = process_data(file_paths, settings, res_type, channel)
    link = (
        f"<a target='_blank' href='{url}' download>Click to download your results.</a>"
    )
    mailer = LocalEmailProvider("Your SFO Results", email, link)
    mailer.send()
    return url
