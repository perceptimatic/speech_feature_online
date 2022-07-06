#!/usr/bin/env bash

set -euo pipefail

# generates processor-schema.json that services use for validation/processing/form creation
# this script should be run whenever parse_shennong.py updates
# note that json files should never be edited directly

docker run --entrypoint="" -v --rm ghcr.io/perceptimatic/sfo-shennong-runner:dev python3 /code/app/parse_shennong.py > ./shennong_runner/processor-schema.json

cp ./shennong_runner/processor-schema.json ./api/static/ 
cp ./shennong_runner/processor-schema.json ./worker/