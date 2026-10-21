#!/usr/bin/env bash
# PG upgrade-path rehearsal (validation-kit Phase 5B).
# Builds a disposable database at revision 20261019_01, inserts legacy
# synthetic rows with psql, upgrades to head with the backend venv, then
# verifies data preservation + schema additions (columns, indexes).
#
# Prereqs: docker container m3-pg-test OR local host PostgreSQL (:5432).
# Run from repository root:  bash scripts/pg_upgrade_rehearsal.sh
set -euo pipefail

DB=m3_pg_upg
CONTAINER=m3-pg-test
USER=m3test
PORT=5434

if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
    RUN_PSQL="docker exec $CONTAINER psql -U $USER"
    RUN_PSQL_I="docker exec -i $CONTAINER psql -U $USER"
    ENV_URL="postgresql+psycopg://m3test:m3test@127.0.0.1:${PORT}/${DB}"
else
    USER="$(whoami)"
    PORT=5432
    RUN_PSQL="psql -h 127.0.0.1 -p ${PORT} -U ${USER}"
    RUN_PSQL_I="psql -h 127.0.0.1 -p ${PORT} -U ${USER}"
    ENV_URL="postgresql+psycopg://127.0.0.1:${PORT}/${DB}"
fi

cd "$(dirname "$0")/../services/api"

step () { printf '\n== %s ==\n' "$1"; }

step "1. Recreate disposable database ${DB}"
$RUN_PSQL -d postgres -c "DROP DATABASE IF EXISTS ${DB};" -c "CREATE DATABASE ${DB};" >/dev/null

step "2. Upgrade to revision 20261019_01 (pre-questionnaire schema)"
DATABASE_URL="$ENV_URL" PYTHONDONTWRITEBYTECODE=1 ./.venv/bin/python -m alembic upgrade 20261019_01 2>&1 | tail -1

step "3. Insert legacy synthetic rows (users, site, patient, roster, sample)"
$RUN_PSQL_I -d $DB -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO users (id, phone_e164, display_name, pin_hash, preferred_language, active, technical_provisioner, failed_login_count, created_at, updated_at)
VALUES ('upg-worker-1','+917100000501','Upgrade Worker','x','hi',true,true,0,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z'),
       ('upg-contr-1','+917100000511','Upgrade Contractor','x','hi',true,true,0,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');
INSERT INTO sites (id, code, name, contractor_name, district, area, status, contractor_user_id, created_at, updated_at)
VALUES ('upg-site-1','UPG-S1','Upgrade Site','Legacy Builders','North Goa','Mapusa','active','upg-contr-1','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');
INSERT INTO patients (id, patient_code, preferred_language, consent_status, age_flagged, created_at, updated_at)
VALUES ('upg-worker-1','UPG-W-0001','hi','pending',false,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');
INSERT INTO worker_site_assignments (id, patient_id, site_id, start_date, created_at, updated_at)
VALUES ('upg-asg-1','upg-worker-1','upg-site-1','2026-01-05','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');
INSERT INTO samples (id, sample_code, patient_id, collected_at, specimen_type, status, created_at, updated_at)
VALUES ('upg-smp-1','UPG-SMP-001','upg-worker-1','2026-01-06T10:00:00Z','blood','pending','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');
COMMIT;
SELECT COUNT(*) AS legacy_rows FROM patients;
SQL

step "4. Upgrade to head (all migrations incl. 20261021_01)"
DATABASE_URL="$ENV_URL" PYTHONDONTWRITEBYTECODE=1 ./.venv/bin/python -m alembic upgrade head 2>&1 | tail -1

step "5. Verify preservation + new schema objects"
$RUN_PSQL -d $DB -c "
SELECT (SELECT COUNT(*) FROM patients) patients_after,
       (SELECT COUNT(*) FROM samples)  samples_after,
       (SELECT COUNT(*) FROM worker_site_assignments) assignments_after,
       (SELECT COUNT(*) FROM users)  users_after;"
$RUN_PSQL -d $DB -c "
SELECT column_name FROM information_schema.columns
WHERE table_name='patients' AND column_name IN ('client_request_id','created_by_user_id') ORDER BY 1;
SELECT indexname FROM pg_indexes WHERE tablename='patients'
  AND indexname IN ('ix_patients_client_request_id','ix_patients_created_by_user_id','uq_patients_client_request_id')
  ORDER BY 1;"

step "6. Verify ORM reads the upgraded database"
PYTHONDONTWRITEBYTECODE=1 ./.venv/bin/python - "$ENV_URL" <<'PY'
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Patient, Sample
Session = sessionmaker(bind=create_engine(sys.argv[1]))
s = Session()
p, sm = s.get(Patient, 'upg-worker-1'), s.get(Sample, 'upg-smp-1')
assert p.patient_code == 'UPG-W-0001' and sm.sample_code == 'UPG-SMP-001'
assert p.client_request_id is None
print('ORM model read OK:', p.patient_code, '| sample', sm.sample_code, '| replay id', p.client_request_id)
PY

step "7. Cleanup (drop disposable DB)"
$RUN_PSQL -d postgres -c "DROP DATABASE ${DB};" >/dev/null

printf '\nUPGRADE REHEARSAL: PASS\n'
