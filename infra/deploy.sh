#!/usr/bin/env bash
set -euo pipefail
cd /opt/flytopay
test -s .env
set -a
. ./.env
set +a
export IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d postgres redis
until docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U flytopay; do sleep 2; done
docker compose -f docker-compose.prod.yml run --rm api alembic upgrade head
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml exec -T api python -c 'import urllib.request; urllib.request.urlopen("http://localhost:8000/health/live")'
