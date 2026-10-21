#!/usr/bin/env bash
set -euo pipefail
: "${POSTGRES_DB:?Set POSTGRES_DB}"
POSTGRES_USER="${POSTGRES_USER:-$(whoami)}"
POSTGRES_HOST="${POSTGRES_HOST:-127.0.0.1}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
export POSTGRES_DB POSTGRES_USER POSTGRES_HOST POSTGRES_PORT

mkdir -p backups
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="backups/m3-${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="backups/m3-${TIMESTAMP}.sha256"
META_FILE="backups/m3-${TIMESTAMP}.meta.json"

echo "Backing up database ${POSTGRES_DB}..."
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "^db$"; then
    docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$BACKUP_FILE"
else
    PGPASSWORD="${PGPASSWORD:-}" pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$BACKUP_FILE"
fi

sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

# Record-level metadata & table counts
python3 -c "
import json, subprocess, os
db = os.environ.get('POSTGRES_DB')
user = os.environ.get('POSTGRES_USER')
host = os.environ.get('POSTGRES_HOST', '127.0.0.1')
port = os.environ.get('POSTGRES_PORT', '5432')
tables = ['users', 'sites', 'patients', 'samples', 'questionnaire_submissions', 'clinical_assessments', 'follow_ups']
manifest = {'database': db, 'tables': {}}
for t in tables:
    cmd = ['psql', '-h', host, '-p', port, '-U', user, '-d', db, '-tAc', f'SELECT COUNT(*) FROM {t}']
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        manifest['tables'][t] = int(res.stdout.strip())
    except Exception:
        pass
with open('${META_FILE}', 'w') as f:
    json.dump(manifest, f, indent=2)
"

echo "Backup written under ${BACKUP_FILE}"
echo "Checksum: $(cat "${CHECKSUM_FILE}")"
echo "Metadata written under ${META_FILE}"
