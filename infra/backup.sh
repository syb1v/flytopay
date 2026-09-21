#!/usr/bin/env bash
set -euo pipefail
cd /opt/flytopay
mkdir -p backups
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U "${POSTGRES_USER:-flytopay}" -d "${POSTGRES_DB:-flytopay}" | gzip > "backups/flytopay-${timestamp}.sql.gz"
find backups -type f -name '*.sql.gz' -mtime +14 -delete
