#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ]; then echo "Usage: ./scripts/restore-db.sh backups/file.sql.gz" >&2; exit 2; fi
: "${POSTGRES_DB:?Set POSTGRES_DB}"; : "${POSTGRES_USER:?Set POSTGRES_USER}"
gzip -cd "$1" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "Restore command completed. Validate records and audit logs before use."
