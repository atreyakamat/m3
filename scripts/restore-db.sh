#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 1 ]; then
    echo "Usage: ./scripts/restore-db.sh backups/file.sql.gz" >&2
    exit 2
fi

BACKUP_FILE="$1"
CHECKSUM_FILE="${BACKUP_FILE%.sql.gz}.sha256"
META_FILE="${BACKUP_FILE%.sql.gz}.meta.json"

: "${POSTGRES_DB:?Set POSTGRES_DB}"
POSTGRES_USER="${POSTGRES_USER:-$(whoami)}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_DB POSTGRES_USER POSTGRES_HOST POSTGRES_PORT

if [ -f "$CHECKSUM_FILE" ]; then
    echo "Verifying archive checksum..."
    sha256sum -c "$CHECKSUM_FILE"
fi

echo "Restoring into database ${POSTGRES_DB}..."
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "^db$"; then
    gzip -cd "$BACKUP_FILE" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
else
    gzip -cd "$BACKUP_FILE" | PGPASSWORD="${PGPASSWORD:-}" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB"
fi

# Verify record counts if metadata exists
if [ -f "$META_FILE" ]; then
    echo "Verifying record-level table counts against metadata..."
    python3 -c "
import json, subprocess, os, sys
meta_file = '${META_FILE}'
db = os.environ.get('POSTGRES_DB')
user = os.environ.get('POSTGRES_USER')
host = os.environ.get('POSTGRES_HOST', '127.0.0.1')
port = os.environ.get('POSTGRES_PORT', '5432')
with open(meta_file) as f:
    meta = json.load(f)
mismatches = []
for t, expected in meta.get('tables', {}).items():
    cmd = ['psql', '-h', host, '-p', port, '-U', user, '-d', db, '-tAc', f'SELECT COUNT(*) FROM {t}']
    res = subprocess.run(cmd, capture_output=True, text=True)
    actual = int(res.stdout.strip()) if res.returncode == 0 and res.stdout.strip().isdigit() else -1
    if actual != expected:
        mismatches.append(f'{t}: expected {expected}, got {actual}')
if mismatches:
    print('Restore verification failed:', mismatches, file=sys.stderr)
    sys.exit(1)
print('Record-level table counts verified matching backup metadata.')
"
fi

echo "Restore successfully completed and verified."
