#!/usr/bin/env bash

set -euo pipefail


docker-compose run -v ./:/tmp/schema --entrypoint="" --rm worker python3 /code/scripts/parse_shennong.py /tmp/schema/processor-schema.json 
