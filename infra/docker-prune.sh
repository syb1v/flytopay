#!/usr/bin/env bash
# Weekly Docker/host cleanup for the Flytopay VPS.
# Keeps: images used by running containers, the current release tag, and the
# two most recent api/web images (rollback window). Removes everything else.
set -euo pipefail

cd /opt/flytopay

KEEP_IDS="$(docker compose -f docker-compose.prod.yml ps -q | xargs -r docker inspect --format '{{.Image}}' | sort -u)"
CURRENT_TAG="$(grep -oP 'IMAGE_TAG=\K.*' .release.env 2>/dev/null || true)"
if [ -n "$CURRENT_TAG" ]; then
  KEEP_IDS="$KEEP_IDS
$(docker images --format '{{.ID}} {{.Repository}}:{{.Tag}}' | grep "$CURRENT_TAG" | awk '{print $1}')"
fi
# Two most recent api/web images as a rollback window.
for repo in ghcr.io/syb1v/flytopay-api ghcr.io/syb1v/flytopay-web; do
  KEEP_IDS="$KEEP_IDS
$(docker images "$repo" --format '{{.ID}} {{.CreatedAt}}' | sort -k2 -r | head -2 | awk '{print $1}')"
done

ALL_IDS="$(docker images -q | sort -u)"
TO_REMOVE="$(comm -13 <(echo "$KEEP_IDS" | sort -u) <(echo "$ALL_IDS"))"
if [ -n "$TO_REMOVE" ]; then
  echo "$TO_REMOVE" | xargs -r docker rmi -f >/dev/null 2>&1 || true
fi

docker image prune -f >/dev/null
docker builder prune -af >/dev/null 2>&1 || true
apt-get clean >/dev/null 2>&1 || true
journalctl --vacuum-time=7d >/dev/null 2>&1 || true

echo "docker-prune: $(df -h / | awk 'NR==2 {print $4}') free on /"
