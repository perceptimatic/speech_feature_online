import datetime
from io import StringIO
from json import dumps
import logging
from time import sleep
from typing import Any, Dict
import uuid
from os import getenv

import boto3
from botocore.exceptions import ClientError
import docker
from jinja2 import Environment, PackageLoader, select_autoescape

from app.celery_app import celery_app
from app.emails.smtp_service import SMTPService
from app.settings import settings
from app.cloud_providers.ec2.ec2_provider import EC2_Provider, update_known_hosts

jinja_env = Environment(
    loader=PackageLoader("app.emails"), autoescape=select_autoescape()
)

logger = logging.getLogger(__name__)


@celery_app.task
def delete_expired_files(continuation_token=None):
    s3 = boto3.client("s3")

    kwargs = {"Bucket": settings.BUCKET_NAME}

    if continuation_token:
        kwargs["ContinuationToken"] = continuation_token

    response = s3.list_objects_v2(**kwargs)
    continuation_token = response.get("NextContinuationToken")
    expired = [
        {"Key": obj["Key"]}
        for obj in response["Contents"]
        if (
            datetime.datetime.now(datetime.timezone.utc)
            - obj["LastModified"].replace(tzinfo=datetime.timezone.utc)
        ).days
        > 8
    ]

    if expired:
        s3.delete_objects(Bucket=settings.BUCKET_NAME, Delete={"Objects": expired})

        f = StringIO()
        f.write(
            f"Deleted {len(expired)} files: {[list(o.values())[0] for o in expired]}"
        )

        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

        s3.put_object(
            Bucket=settings.BUCKET_NAME,
            Key=f"deletion-history {now}",
            Body=f.getvalue(),
        )

        f.close()

    if continuation_token:
        delete_expired_files(continuation_token)


@celery_app.task(time_limit=60)
def terminate_dangling_nodes():
    """Poll instances and terminate those without a docker process or those that have been up for more than 24 hours"""
    client = boto3.client("ec2")
    instances = client.describe_instances(
        Filters=[
            {
                "Name": "tag:aws:ec2launchtemplate:id",
                "Values": [settings.LAUNCH_TEMPLATE_ID],
            },
            {"Name": "instance-state-name", "Values": ["running"]},
        ]
    )
    if instances["Reservations"] and instances["Reservations"]:
        for res in instances["Reservations"]:
            for instance in res["Instances"]:
                launch_time = instance["LaunchTime"]
                uptime = (
                    (
                        datetime.datetime.now(datetime.timezone.utc)
                        - launch_time.replace(tzinfo=datetime.timezone.utc)
                    ).seconds
                    / 60
                    / 60
                )
                if uptime > 1:
                    ipaddr = instance["PublicIpAddress"]
                    update_known_hosts(ipaddr)
                    docker_client = docker.DockerClient(
                        base_url=f"ssh://ubuntu@{ipaddr}",
                        use_ssh_client=True,
                    )
                    running_containers = docker_client.containers.list()
                    docker_client.close()
                    if not running_containers or uptime > 24:
                        client.terminate_instances(InstanceIds=[instance["InstanceId"]])


# https://docs.celeryq.dev/en/stable/userguide/tasks.html#on_failure
def on_failure(self, exc, task_id, args, kwargs, einfo):
    # send_failure_email(email, job_id) (?)
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

        logger.info("logging into ghcr...")
        worker_node.docker_client.login(
            username=settings.GITHUB_OWNER,
            password=settings.GITHUB_PAT,
            registry=f"ghcr.io/{settings.GITHUB_OWNER}",
        )

        logger.info("pulling shennong...")
        worker_node.docker_client.images.pull(image)

        logger.info("running analysis...")
        worker_node.docker_client.containers.run(
            image=image,
            command=[config_json],
            stderr=True,
            environment={
                "AWS_SECRET_ACCESS_KEY": getenv("AWS_SECRET_ACCESS_KEY"),
                "AWS_DEFAULT_REGION": getenv("AWS_DEFAULT_REGION"),
                "AWS_ACCESS_KEY_ID": getenv("AWS_ACCESS_KEY_ID"),
            },
        )

        try:
            client.get_object_attributes(
                Bucket=settings.BUCKET_NAME,
                Key=save_path,
                ObjectAttributes=["ObjectSize"],
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
