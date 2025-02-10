#! /usr/bin/env bash

set -euo pipefail

OWNER=$( cat .env | awk -F= '/GITHUB_OWNER/ {print $2}')
PAT=$( cat .env | awk -F= '/GITHUB_PAT/ {print $2}')

echo $PAT | docker login ghcr.io -u $OWNER --password-stdin

docker pull ghcr.io/${OWNER}/sfo-api:latest

docker compose -f docker-compose.prod.yaml up -d api
