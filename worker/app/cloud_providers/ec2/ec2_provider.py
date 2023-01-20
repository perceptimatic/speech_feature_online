""" Module for bringing up an EC2 instance and connecting to Docker API. Assumes that the instance is running Ubuntu."""

from contextlib import AbstractContextManager
from os import path
from time import perf_counter

import boto3
import docker
import paramiko

from app.settings import settings


def update_known_hosts(host: str):
    """Add instance to known_hosts, creating file if necessary"""
    KNOWN_HOSTS_PATH = path.expanduser("~/.ssh/known_hosts")
    open(KNOWN_HOSTS_PATH, "a").close()
    transport = paramiko.Transport(host)
    transport.connect()
    key = transport.get_remote_server_key()
    transport.close()
    hk = paramiko.HostKeys(KNOWN_HOSTS_PATH)
    hk.add(host, key.get_name(), key)
    hk.save(KNOWN_HOSTS_PATH)


class EC2_Provider(AbstractContextManager):
    def __init__(self):
        """Set clients and flags. Caller responsible for connecting."""
        self.start = perf_counter()
        self.launch_template_id = settings.LAUNCH_TEMPLATE_ID
        self.ec2_client = boto3.client("ec2")
        self.ec2_resource = boto3.resource("ec2")
        self.instance = None
        self.docker_client = None

    def connect(self):
        """Bring up instance.
        This could be a retry after a network or ec2 failure, so we'll go through
        the steps one by one to avoid errors and redundancy.
        """
        if not self.instance:
            print("bringing up instance....")
            self.instance = self._get_instance()
            # we wait here so self.instance is assigned immediately and can be properly terminated on error
            waiter = self.ec2_client.get_waiter("instance_status_ok")
            waiter.wait(InstanceIds=[self.instance.id])
        if not self.docker_client:
            print("connecting to docker....")
            self.docker_client = self._connect_docker()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Terminate instance and close connection"""
        if self.instance:
            self.instance.terminate()
        if self.docker_client:
            self.docker_client.close()
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

    def _connect_docker(self):
        """Establish connection with docker daemon"""
        # we may need to reload in case public ip was not set initially
        self.instance.reload()
        ipaddr = self.instance.public_ip_address
        update_known_hosts(ipaddr)
        return docker.DockerClient(
            base_url=f"ssh://ubuntu@{ipaddr}",
            use_ssh_client=False,
        )
