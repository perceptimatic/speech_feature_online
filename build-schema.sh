#!/usr/bin/env bash

set -euo pipefail

docker run --entrypoint="" -v --rm ghcr.io/perceptimatic/sfo-shennong-runner:dev python3 /code/app/parse_shennong.py > ./shennong_runner/processor-schema.json

cp ./shennong_runner/processor-schema.json ./api/static/ 
cp ./shennong_runner/processor-schema.json ./worker/