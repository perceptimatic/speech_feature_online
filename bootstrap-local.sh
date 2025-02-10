#! /usr/bin/env bash

set -euo pipefail

# build images
docker compose build

# install react dependencies
docker compose run --rm --entrypoint="yarn install" react

# run database migrations
docker compose run --rm --entrypoint="alembic upgrade head" api

# create default admin user
docker compose run --rm --entrypoint="python -m app.scripts.create_admin_user" api

# bring up services
docker compose up