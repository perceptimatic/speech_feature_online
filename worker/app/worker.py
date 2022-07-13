from json import dumps
import logging
from time import sleep
from typing import Any, Dict
import uuid
from os import getenv

import boto3
from botocore.exceptions import ClientError
from jinja2 import Environment, PackageLoader, select_autoescape

from app.celery_app import celery_app
from app.emails.smtp_service import SMTPService
from app.settings import settings
from app.cloud_providers.ec2.ec2_provider import EC2_Provider

jinja_env = Environment(
    loader=PackageLoader("app.emails"), autoescape=select_autoescape()
)

logger = logging.getLogger(__name__)


# https://docs.celeryq.dev/en/stable/userguide/tasks.html#on_failure
def on_failure(self, exc, task_id, args, kwargs, einfo):
    # send_failure_email(email, job_id)
    pass


def attempt_connection(node):
    """Bring up instance and connect, retrying in case of network or incidental errors"""
    attempts = 0
    while True:
        try:
            node.connect()
            return node
        except Exception as e:
            attempts += 1
            if attempts < 3:
                logger.error(e)
                logger.warning("caught exception while connecting, retrying...")
                continue
            else:
                raise e from None


@celery_app.task()
def test(test_arg: str):
    sleep_time = 5
    print(f"sleeping {sleep_time}")
    sleep(sleep_time)
    return test_arg


@celery_app.task()
def verify_user_email(email_addr: str, verification_code: str):
    """Verify user email"""
    template = jinja_env.get_template("verify-email.html")
    html = template.render(
        verification_code=verification_code,
    )
    mailer = SMTPService("Complete Your SFO signup", email_addr, html)
    mailer.send()
    return "Email sent"


@celery_app.task()
def notify_job_complete(
    result_url: str,
    email_address: str,
):
    template = jinja_env.get_template("success.html")
    html = template.render(download_link=result_url, from_email="example@example.net")
    mailer = SMTPService("Your SFO Results", email_address, html)
    mailer.send()
    return result_url


@celery_app.task(bind=True, on_failure=on_failure)
def process_shennong_job(self, config: Dict[str, Any], provider=EC2_Provider):
    """Run the shennong job."""

    client = boto3.client("s3")
    self.provider = provider
    save_path = f"{uuid.uuid4().hex}.zip"
    config["save_path"] = save_path
    config["bucket"] = settings.BUCKET_NAME
    config_json = dumps(config)
    image = f"ghcr.io/{settings.GITHUB_OWNER}/sfo-shennong-runner:latest"

    with provider() as worker_node:
        attempt_connection(worker_node)
        worker_node.execute(
            f"docker run -i --rm -e 'AWS_DEFAULT_REGION={getenv('AWS_DEFAULT_REGION')}' -e 'AWS_SECRET_ACCESS_KEY={getenv('AWS_SECRET_ACCESS_KEY')}' -e 'AWS_ACCESS_KEY_ID={getenv('AWS_ACCESS_KEY_ID')}' {image} '{config_json}'"
        )

    try:
        client.get_object_attributes(
            Bucket=settings.BUCKET_NAME, Key=save_path, ObjectAttributes=["ObjectSize"]
        )
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.BUCKET_NAME, "Key": save_path},
            ExpiresIn=60 * 60 * 168,
        )

    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            logger.error("Can't find key, results not saved!")
        raise
