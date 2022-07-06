from json import dumps
import logging
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
    pass


@celery_app.task(bind=True, on_failure=on_failure)
def process_shennong_job(
    self, config: Dict[str, Any], send_email=True, provider=EC2_Provider
):
    """Run the shennong job."""

    client = boto3.client("s3")
    self.provider = provider
    save_path = f"{uuid.uuid4().hex}.zip"
    email = config.pop("email")
    config["save_path"] = save_path
    config["bucket"] = settings.BUCKET_NAME
    config_json = dumps(config)
    image = f"ghcr.io/{settings.GITHUB_OWNER}/sfo-shennong-runner:latest"

    with provider() as worker_node:
        try:
            # don't launch in constructor b/c __exit__ will not fire on error
            worker_node.launch_instance()
            worker_node.execute(
                f"docker run -i --rm -e 'AWS_DEFAULT_REGION={getenv('AWS_DEFAULT_REGION')}' -e 'AWS_SECRET_ACCESS_KEY={getenv('AWS_SECRET_ACCESS_KEY')}' -e 'AWS_ACCESS_KEY_ID={getenv('AWS_ACCESS_KEY_ID')}' {image} '{config_json}'"
            )
        except Exception as e:
            logger.error(e)
            raise e from None
            # send_failure_email(email, job_id)

    try:
        client.get_object_attributes(
            Bucket=settings.BUCKET_NAME, Key=save_path, ObjectAttributes=["ObjectSize"]
        )
        url = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.BUCKET_NAME, "Key": save_path},
            ExpiresIn=60 * 60 * 168,
        )

        if send_email:
            template = jinja_env.get_template("success.html")
            html = template.render(download_link=url, from_email="example@example.net")
            mailer = SMTPService("Your SFO Results", email, html)
            mailer.send()

    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            logger.error("Can't find key, results not saved!")
            # todo: error email
            raise
        else:
            raise
