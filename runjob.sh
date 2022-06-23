#! /usr/bin/env bash

set -euo pipefail

AWS_DEFAULT_REGION=$( cat .env | awk -F= '/AWS_DEFAULT_REGION/ {print $2}')
AWS_SECRET_ACCESS_KEY=$( cat .env | awk -F= '/AWS_SECRET_ACCESS_KEY/ {print $2}')
AWS_ACCESS_KEY_ID=$( cat .env | awk -F= '/AWS_ACCESS_KEY_ID/ {print $2}')
BUCKET_NAME=$( cat .env | awk -F= '/BUCKET_NAME/ {print $2}')
IMAGE="ghcr.io/perceptimatic/sfo-shennong-runner:latest"
CONFIG=$(cat ./worker/app/tests/fixtures/sample-request.json | jq 'del(.email)' | jq -r --arg BUCKET "$BUCKET_NAME" '. + {"bucket" : $BUCKET, save_path: "abc123.zip"}') 

docker run -it -e "AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION}" -e "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" -e "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" --rm "${IMAGE}" "${CONFIG}"
