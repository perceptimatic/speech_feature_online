#! /usr/bin/env python3

from sys import argv, exit, path as syspath

# make sure the app module in in the python path
syspath.insert(0, ".")
from json import load
from logging import getLogger
from os.path import basename, exists

import boto3

from app.settings import settings as app_settings
from app.worker import process_shennong_job

logger = getLogger(__name__)


if __name__ == "__main__":
    try:
        json_path = argv[1]
        audio_path = argv[2]
    except IndexError:
        print("dispatch_job requires two arguments!")
        exit()

    if not exists(json_path):
        raise FileNotFoundError(f"no json file found at {json_path}!")

    if not exists(audio_path):
        raise FileNotFoundError(f"audio file not found at {audio_path}!")

    resource = boto3.resource("s3")
    client = boto3.client("s3")
    bucket = app_settings.BUCKET_NAME
    filename = f"tests/{basename(audio_path)}"
    client.upload_file(audio_path, bucket, filename)

    with open(json_path) as p:
        args = load(p)

    args['files'] = [filename]

    job_count = args.pop("job_count", 1)

    for job in range(job_count):
        process_shennong_job.delay(args, send_email=False)

    print(f"{job_count} jobs dispatched!")
