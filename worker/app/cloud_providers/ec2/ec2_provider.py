from contextlib import AbstractContextManager
from time import perf_counter
from os import getenv, path

import boto3
from fabric import Connection
from invoke.exceptions import UnexpectedExit

from app.settings import settings


class EC2_Provider(AbstractContextManager):
    def __init__(self):
        """Set clients and flags. Caller responsible for connecting."""
        self.start = perf_counter()
        self.launch_template_id = settings.LAUNCH_TEMPLATE_ID
        self.ec2_client = boto3.client("ec2")
        self.ec2_resource = boto3.resource("ec2")
        self.ssh_client = None
        self.instance = None
        self.is_provisioned = False

    def connect(self):
        """Bring up instance.
        This could be a retry after a network or ec2 failure, so we'll go through
        the steps one by one to avoid errors and redundancy.
        """
        if not self.instance:
            print("bringing up instance....")
            self.instance = self._get_instance()
            waiter = self.ec2_client.get_waiter("instance_status_ok")
            waiter.wait(InstanceIds=[self.instance.id])
        if not self.ssh_client:
            print("connecting via ssh....")
            self.ssh_client = self._connect()
        if not self.is_provisioned:
            print("provisioning node....")
            self._provision()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Terminate instance and close ssh connection"""
        if self.instance:
            self.instance.terminate()
        if self.ssh_client and self.ssh_client.is_connected:
            self.ssh_client.close()
        elapsed = perf_counter() - self.start
        print(f"job finished in {elapsed}")

    def _get_instance(self):
        """Spin up an instance according to the launch template."""
        instances = self.ec2_resource.create_instances(
            LaunchTemplate={
                "LaunchTemplateId": self.launch_template_id,
            },
            MaxCount=1,
            MinCount=1,
        )
        return instances[0]

    def _connect(self):
        """Establish ssh connection"""
        # we may need to reload in case public ip was not set initially
        self.instance.reload()
        ipaddr = self.instance.public_ip_address
        return Connection(
            host=ipaddr,
            user="ubuntu",
            connect_kwargs={"key_filename": "/home/worker/.ssh/ec2-private-key.pem"},
        )

    def _provision(self):
        """Provision execution environment"""
        self.ssh_client.put(
            path.join(path.dirname(__file__), "provision.sh"),
            "/home/ubuntu/provision.sh",
        )
        self.ssh_client.run(
            f'bash /home/ubuntu/provision.sh {getenv("GITHUB_PAT")} {getenv("GITHUB_OWNER")}'
        )
        self.is_provisioned = True

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
