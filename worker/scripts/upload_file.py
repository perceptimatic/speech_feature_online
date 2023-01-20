#! /usr/bin/env python3
from sys import argv, path as syspath

import boto3

# make sure the app module in in the python path
syspath.insert(0, ".")

from app import settings


def main(data_path: str, key: str):
    """ Upload a file to S3, mainly to assist in testing """
    client = boto3.client('s3')
    client.upload_file(data_path, settings.BUCKET_NAME, key)


if __name__ == "__main__":

    main(argv[1], argv[2])