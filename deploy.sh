#! /usr/bin/env bash

set -euo pipefail

SERVICE=$1

if [[ $SERVICE != 'api' && $SERVICE != 'worker' ]]; then
    echo >&2 "Error! Unrecognized service!" && exit 1
fi

OWNER=$( cat .env | awk -F= '/GITHUB_OWNER/ {print $2}')
PAT=$( cat .env | awk -F= '/GITHUB_PAT/ {print $2}')

echo $PAT | docker login ghcr.io -u $OWNER --password-stdin

docker pull ghcr.io/${OWNER}/sfo-$SERVICE:latest
docker-compose -f docker-compose.prod.yaml up -d $SERVICE