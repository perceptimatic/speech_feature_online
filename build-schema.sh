#!/usr/bin/env bash

# compile the schema and place in api static folder
# for development only

set -euo pipefail

TARGET=$(pwd)/api/static

docker-compose run --entrypoint="" --rm worker python3 /code/scripts/parse_shennong.py /code/processor-schema.json

cp ./worker/processor-schema.json ./api/static/