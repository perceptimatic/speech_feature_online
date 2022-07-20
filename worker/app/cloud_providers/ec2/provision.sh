#! /usr/bin/env bash

set -euo pipefail

GITHUB_PAT=$1
GITHUB_OWNER=$2

echo $GITHUB_PAT | sudo docker login ghcr.io -u ${GITHUB_OWNER} --password-stdin

sudo docker pull ghcr.io/${GITHUB_OWNER}/sfo-shennong-runner:latest

