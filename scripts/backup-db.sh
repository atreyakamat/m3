#!/usr/bin/env sh
set -eu
: "${POSTGRES_DB:?Set POSTGRES_DB}"; : "${POSTGRES_USER:?Set POSTGRES_USER}"
mkdir -p backups
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "backups/m3-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "Backup written under backups/. Encrypt and store it under an approved policy before production use."
