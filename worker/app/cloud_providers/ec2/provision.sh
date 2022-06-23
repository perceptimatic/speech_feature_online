#! /usr/bin/env bash

set -euo pipefail

GITHUB_PAT=$1
GITHUB_OWNER=$2

echo "installing docker...."

sudo apt-get update -y
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

sudo mkdir -p /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io
sudo usermod -a -G docker ubuntu

echo $GITHUB_PAT | sudo docker login ghcr.io -u ${GITHUB_OWNER} --password-stdin

sudo docker pull ghcr.io/${GITHUB_OWNER}/sfo-shennong-runner:latest

