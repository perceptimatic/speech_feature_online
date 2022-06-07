#!/usr/bin/env bash

# compile the schema and place in api static folder
# should be run on host machine

set -euo pipefail

docker-compose -f docker-compose.dev.yaml run --no-deps --entrypoint="" --rm worker python3 /code/scripts/parse_shennong.py > ./worker/processor-schema.json

cp ./worker/processor-schema.json ./api/static/