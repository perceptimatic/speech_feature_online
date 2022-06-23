from contextlib import AbstractContextManager
from time import sleep, perf_counter
from logging import getLogger
from os import getenv, path

import boto3
from fabric import Connection
from paramiko.ssh_exception import NoValidConnectionsError
from invoke.exceptions import UnexpectedExit

from app.settings import settings

logger = getLogger(__name__)


class EC2_Provider(AbstractContextManager):
    def __init__(self):
        self.start = perf_counter()
        self.launch_template_id = settings.LAUNCH_TEMPLATE_ID
        self.ec2_client = boto3.client("ec2")
        self.ssh_client = None
        self._needs_provision = False
        self.instance = self._get_instance()
        self._connect()
        if self._needs_provision:
            self._provision()

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Terminate instance and close client connection"""
        if self.instance:
            self.ec2_client.terminate_instances(
                InstanceIds=[self.instance["InstanceId"]]
            )
        if self.ssh_client.is_connected:
            self.ssh_client.close()
        elapsed = perf_counter() - self.start
        print(f"job finished in {elapsed}")

    def _get_instance_is_running(self):
        """Check if the instance is running"""
        instance = self.ec2_client.describe_instances(
            InstanceIds=[self.instance["InstanceId"]]
        )

        self.instance = instance["Reservations"][0]["Instances"][0]
        return self.instance["State"]["Code"] == 16

    def _get_instance(self):
        """Find an instance that matches the corresponding launch template.
        Prefer running instances; if no running instance, create one.
        """
        instances = self.ec2_client.describe_instances(
            Filters=[
                {
                    "Name": "tag:aws:ec2launchtemplate:id",
                    "Values": [self.launch_template_id],
                }
            ]
        )
        instance = None
        if instances["Reservations"]:
            for item in instances["Reservations"][0]["Instances"]:
                if item["State"]["Name"] == "running":
                    logger.info("found running node")
                    instance = item
                    break
        if not instance:
            _response = self.ec2_client.run_instances(
                LaunchTemplate={
                    "LaunchTemplateId": self.launch_template_id,
                },
                MaxCount=1,
                MinCount=1,
            )
            self._needs_provision = True
            instance = _response["Instances"][0]
        return instance

    def _wait_for_connection(self):
        """Poll until ssh server comes online"""
        tries = 0
        while tries < 5:
            try:
                logger.info("waiting for ssh to come online....")
                self.ssh_client.open()
            except NoValidConnectionsError:
                sleep(3)
                tries += 1
            else:
                break
        if tries == 5:
            raise Exception("Could not connect to SSH!")
        return True

    def _connect(self):
        tries = 0
        while not self._get_instance_is_running() and tries < 10:
            logger.info("waiting for node to come online...")
            sleep(5)
            tries += 1
        if not self._get_instance_is_running():
            raise Exception("Failed to bring up instance!")

        logger.info("instance is up!")
        ipaddr = self.instance["PublicIpAddress"]
        self.ssh_client = Connection(
            host=ipaddr,
            user="ubuntu",
            connect_kwargs={"key_filename": "/home/worker/.ssh/ec2-private-key.pem"},
        )
        self._wait_for_connection()

    def _provision(self):
        """Provision execution environment"""
        self.ssh_client.put(
            path.join(path.dirname(__file__), "provision.sh"),
            "/home/ubuntu/provision.sh",
        )
        self.ssh_client.run(
            f'bash /home/ubuntu/provision.sh {getenv("GITHUB_PAT")} {getenv("GITHUB_OWNER")}'
        )

    def execute(self, command):
        """Run the command on the remote machine"""
        try:
            result = self.ssh_client.sudo(command)
            print(result.stdout)
        except UnexpectedExit as e:
            # if we're dealing with a python error here, then stderr is a stringified traceback
            # so the result will contain 2 tracebacks: the string "message" and the traceback of this exception
            # would likely be better to throw custom exception but running into pickle errors with celery's serializer
            raise Exception(e.result.stderr) from None
