#!/usr/bin/env bash
set -euo pipefail
cd /opt/flytopay
export IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml run --rm api alembic upgrade head
docker-compose -f docker-compose.prod.yml up -d --remove-orphans
docker-compose -f docker-compose.prod.yml ps
curl --fail --retry 10 --retry-delay 2 http://127.0.0.1/api/v1/health/live
