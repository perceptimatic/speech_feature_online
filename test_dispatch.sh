#! /usr/bin/env bash

# Simple convenience script to dispatch one or more test jobs to the queue.
# Arguments are path to JSON config and path to audio file: both will be mounted into the worker container.
# Assumes all services are running.
# Example: bash test_dispatch.sh ~/test/config.json ~/recordings/my-recording.mp3 --dev

set -euo pipefail

DEV_FLAG=${3:-}

if [[ -z $1 ]]; then
    echo >&2 "The first argument should be a path to the JSON job configuration file!" && exit 22
fi

if ! [[ -e $1 ]]; then
    echo >&2 "Path to JSON is invalid!" && exit 22
fi

if [[ -z $2 ]]; then
    echo >&2 "The second argument should be a path to the audio file!" && exit 22
fi

if ! [[ -e $2 ]]; then
    echo >&2 "Path to audio file is invalid!" && exit 22
fi

COMPOSE_FILE=docker-compose.yaml

if [[ $DEV_FLAG == '--dev' ]]; then
    COMPOSE_FILE=docker-compose.dev.yaml
fi

CONFIG_FILE_BASENAME=$(basename "${1}")
AUDIO_FILE_BASENAME=$(basename "${2}")

docker-compose \
    -f \
    $COMPOSE_FILE \
    run \
    -v "${1}":"/tmp/${CONFIG_FILE_BASENAME}" \
    -v "${2}":"/tmp/${AUDIO_FILE_BASENAME}" \
    --rm \
    --no-deps \
    --entrypoint='' \
    worker \
    python3 \
    /code/scripts/dispatch_job.py \
    "/tmp/${CONFIG_FILE_BASENAME}" \
    "/tmp/${AUDIO_FILE_BASENAME}"