"""Tests for database migrations and upgrade data preservation (PRD DATA-001/002).

Verifies that running Alembic upgrade head on a database initialized at
an earlier revision (20261019_01) preserves all pre-existing rows, correctly applies schema
additions (columns, tables, indexes), and preserves data checksums.
"""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import pytest
from sqlalchemy import create_engine, inspect, text
from alembic.config import Config
from alembic import command


def compute_row_checksum(row_dict: dict) -> str:
    """Compute deterministic SHA256 of sorted key-value pairs."""
    serialized = json.dumps(row_dict, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def test_synthetic_legacy_upgrade_rehearsal_preserves_data():
    """Verify upgrade from legacy 20261019_01 schema to head preserves data and checksums."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    try:
        db_url = f"sqlite:///{db_path}"
        engine = create_engine(db_url)

        # 1. Initialize a genuine pre-questionnaire legacy database schema (v20261019_01)
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE alembic_version (
                    version_num VARCHAR(32) NOT NULL PRIMARY KEY
                );
            """))
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20261019_01');"))

            conn.execute(text("""
                CREATE TABLE users (
                    id VARCHAR(36) PRIMARY KEY,
                    phone_e164 VARCHAR(16) NOT NULL UNIQUE,
                    display_name VARCHAR(120) NOT NULL,
                    pin_hash VARCHAR(128) NOT NULL,
                    preferred_language VARCHAR(5) NOT NULL,
                    active BOOLEAN NOT NULL DEFAULT 1,
                    technical_provisioner BOOLEAN NOT NULL DEFAULT 0,
                    failed_login_count INTEGER NOT NULL DEFAULT 0,
                    locked_until TIMESTAMP,
                    patient_id VARCHAR(36),
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE sites (
                    id VARCHAR(36) PRIMARY KEY,
                    code VARCHAR(32) NOT NULL UNIQUE,
                    name VARCHAR(160) NOT NULL,
                    contractor_name VARCHAR(160) NOT NULL,
                    district VARCHAR(80) NOT NULL,
                    area VARCHAR(80) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE patients (
                    id VARCHAR(36) PRIMARY KEY,
                    patient_code VARCHAR(20) NOT NULL UNIQUE,
                    display_name VARCHAR(120),
                    age_years INTEGER,
                    gender VARCHAR(30),
                    phone_e164 VARCHAR(16),
                    alternate_contact VARCHAR(120),
                    id_type VARCHAR(30),
                    id_other_details VARCHAR(200),
                    address_present VARCHAR(400),
                    address_permanent VARCHAR(400),
                    preferred_language VARCHAR(5) NOT NULL DEFAULT 'en',
                    occupation VARCHAR(80),
                    nativity VARCHAR(120),
                    consent_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    initial_symptoms JSON,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE samples (
                    id VARCHAR(36) PRIMARY KEY,
                    sample_code VARCHAR(32) NOT NULL UNIQUE,
                    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                    collected_at TIMESTAMP NOT NULL,
                    specimen_type VARCHAR(20) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE worker_site_assignments (
                    id VARCHAR(36) PRIMARY KEY,
                    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                    site_id VARCHAR(36) NOT NULL REFERENCES sites(id),
                    start_date VARCHAR(10) NOT NULL,
                    end_date VARCHAR(10),
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE travel_events (
                    id VARCHAR(36) PRIMARY KEY,
                    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                    origin VARCHAR(120) NOT NULL,
                    destination VARCHAR(120) NOT NULL,
                    arrival_date VARCHAR(10),
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE clinical_assessments (
                    id VARCHAR(36) PRIMARY KEY,
                    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                    facility_id VARCHAR(36),
                    encounter_at TIMESTAMP NOT NULL,
                    temperature_c FLOAT,
                    fever_duration_days INTEGER,
                    symptoms JSON,
                    general_condition VARCHAR(40),
                    systolic_bp INTEGER,
                    diastolic_bp INTEGER,
                    admission_status VARCHAR(20) NOT NULL DEFAULT 'outpatient',
                    treatment_documentation TEXT,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE diagnostic_tests (
                    id VARCHAR(36) PRIMARY KEY,
                    sample_id VARCHAR(36) NOT NULL REFERENCES samples(id),
                    method VARCHAR(30) NOT NULL,
                    result_status VARCHAR(20) NOT NULL,
                    species VARCHAR(30),
                    smear_type VARCHAR(20),
                    operator_id VARCHAR(36),
                    performed_at TIMESTAMP,
                    notes TEXT,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            conn.execute(text("""
                CREATE TABLE follow_ups (
                    id VARCHAR(36) PRIMARY KEY,
                    patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                    assigned_user_id VARCHAR(36),
                    due_at TIMESTAMP NOT NULL,
                    completed_at TIMESTAMP,
                    status VARCHAR(20) NOT NULL DEFAULT 'due',
                    adherence VARCHAR(30),
                    outcome VARCHAR(40),
                    notes TEXT,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL
                );
            """))

            # 2. Insert synthetic legacy records
            conn.execute(text("""
                INSERT INTO users (id, phone_e164, display_name, pin_hash, preferred_language, created_at, updated_at)
                VALUES ('legacy-user-1', '+919999900001', 'Legacy Health Worker', 'pin_hash_1', 'en', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
            """))
            conn.execute(text("""
                INSERT INTO sites (id, code, name, contractor_name, district, area, status, created_at, updated_at)
                VALUES ('legacy-site-1', 'LEG-SITE-01', 'Legacy Construction Site', 'Legacy Corp', 'North Goa', 'Panaji', 'active', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
            """))
            conn.execute(text("""
                INSERT INTO patients (id, patient_code, display_name, age_years, gender, phone_e164, preferred_language, consent_status, created_at, updated_at)
                VALUES ('legacy-pat-1', 'M3-LEG-001', 'Legacy Worker John', 34, 'male', '+919876500001', 'en', 'documented', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
            """))
            conn.execute(text("""
                INSERT INTO samples (id, sample_code, patient_id, collected_at, specimen_type, status, created_at, updated_at)
                VALUES ('legacy-smp-1', 'M3-SMP-LEG-01', 'legacy-pat-1', '2026-01-01 00:00:00', 'blood', 'positive', '2026-01-01 00:00:00', '2026-01-01 00:00:00');
            """))
            conn.commit()

            # Record baseline checksum of legacy patient
            pre_row = conn.execute(text("SELECT id, patient_code, display_name, age_years, gender, phone_e164, preferred_language, consent_status FROM patients WHERE id = 'legacy-pat-1'")).mappings().fetchone()
            pre_checksum = compute_row_checksum(dict(pre_row))

        # 3. Upgrade to head (runs 20261020_01 and 20261021_01)
        api_dir = Path(__file__).resolve().parent.parent
        alembic_cfg = Config(str(api_dir / "alembic.ini"))
        alembic_cfg.set_main_option("script_location", str(api_dir / "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", db_url)
        command.upgrade(alembic_cfg, "head")

        with engine.connect() as conn:
            # 4. Verify data preservation & checksum match
            post_row = conn.execute(text("SELECT id, patient_code, display_name, age_years, gender, phone_e164, preferred_language, consent_status FROM patients WHERE id = 'legacy-pat-1'")).mappings().fetchone()
            assert post_row is not None, "Legacy patient record missing after upgrade"
            post_checksum = compute_row_checksum(dict(post_row))
            assert pre_checksum == post_checksum, "Legacy patient data was altered during upgrade"

            # 5. Verify additive schema columns exist and default properly
            pat_full = conn.execute(text("SELECT id, dob, age_as_on, age_flagged, client_request_id, created_by_user_id FROM patients WHERE id = 'legacy-pat-1'")).mappings().fetchone()
            assert pat_full["dob"] is None
            assert pat_full["client_request_id"] is None
            assert pat_full["created_by_user_id"] is None
            assert pat_full["age_flagged"] in (0, False)

            # 6. Verify newly added tables exist and accept rows referencing legacy entities
            insp = inspect(engine)
            table_names = set(insp.get_table_names())
            assert "questionnaire_submissions" in table_names
            assert "slide_follow_ups" in table_names

            conn.execute(text("""
                INSERT INTO questionnaire_submissions (id, patient_id, schema_version, state, data, client_request_id, created_at, updated_at)
                VALUES ('qs-legacy-1', 'legacy-pat-1', 1, 'draft', '{}', 'req-leg-001', '2026-10-20 00:00:00', '2026-10-20 00:00:00');
            """))
            conn.execute(text("""
                INSERT INTO slide_follow_ups (id, sample_id, patient_id, scheduled_day, received, not_received_reason, created_at, updated_at)
                VALUES ('sfu-legacy-1', 'legacy-smp-1', 'legacy-pat-1', 'Day 7', 'no', 'patient_unavailable', '2026-10-20 00:00:00', '2026-10-20 00:00:00');
            """))
            conn.commit()

            count_qs = conn.execute(text("SELECT COUNT(*) FROM questionnaire_submissions WHERE patient_id = 'legacy-pat-1'")).scalar()
            assert count_qs == 1
            count_sfu = conn.execute(text("SELECT COUNT(*) FROM slide_follow_ups WHERE sample_id = 'legacy-smp-1'")).scalar()
            assert count_sfu == 1

        engine.dispose()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


def test_postgres_legacy_upgrade_rehearsal():
    """Verify upgrade rehearsal on PostgreSQL when disposable test database is provided."""
    from urllib.parse import urlparse
    pg_url = os.environ.get("M3_TEST_DATABASE_URL")
    if not pg_url:
        cand = os.environ.get("DATABASE_URL", "")
        if cand.startswith("postgresql://") or cand.startswith("postgresql+psycopg://"):
            pg_url = cand
    if not pg_url:
        pytest.skip("No PostgreSQL test target configured via M3_TEST_DATABASE_URL or DATABASE_URL")

    # Connect to an isolated migration rehearsal database so the session test database is untouched
    parsed = urlparse(pg_url)
    mig_db_name = os.environ.get("M3_MIGRATION_DB_NAME", "m3_migration_test_pg")
    pg_mig_url = parsed._replace(path=f"/{mig_db_name}").geturl()

    try:
        engine = create_engine(pg_mig_url)
        with engine.connect() as conn:
            pass
    except Exception:
        admin_url = parsed._replace(path="/postgres").geturl()
        admin_eng = create_engine(admin_url, isolation_level="AUTOCOMMIT")
        with admin_eng.connect() as aconn:
            aconn.execute(text(f"CREATE DATABASE {mig_db_name};"))
        admin_eng.dispose()
        engine = create_engine(pg_mig_url)

    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
        conn.commit()

        # Seed legacy schema (v20261019_01)
        conn.execute(text("""
            CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY);
            INSERT INTO alembic_version (version_num) VALUES ('20261019_01');
            CREATE TABLE users (
                id VARCHAR(36) PRIMARY KEY, phone_e164 VARCHAR(16) NOT NULL UNIQUE,
                display_name VARCHAR(120) NOT NULL, pin_hash VARCHAR(128) NOT NULL,
                preferred_language VARCHAR(5) NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
                technical_provisioner BOOLEAN NOT NULL DEFAULT false, failed_login_count INTEGER NOT NULL DEFAULT 0,
                locked_until TIMESTAMPTZ, patient_id VARCHAR(36), created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE sites (
                id VARCHAR(36) PRIMARY KEY, code VARCHAR(32) NOT NULL UNIQUE,
                name VARCHAR(160) NOT NULL, contractor_name VARCHAR(160) NOT NULL,
                district VARCHAR(80) NOT NULL, area VARCHAR(80) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE patients (
                id VARCHAR(36) PRIMARY KEY, patient_code VARCHAR(20) NOT NULL UNIQUE,
                display_name VARCHAR(120), age_years INTEGER, gender VARCHAR(30),
                phone_e164 VARCHAR(16), alternate_contact VARCHAR(120), id_type VARCHAR(30),
                id_other_details VARCHAR(200), address_present VARCHAR(400), address_permanent VARCHAR(400),
                preferred_language VARCHAR(5) NOT NULL DEFAULT 'en', occupation VARCHAR(80),
                nativity VARCHAR(120), consent_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                initial_symptoms JSON, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE samples (
                id VARCHAR(36) PRIMARY KEY, sample_code VARCHAR(32) NOT NULL UNIQUE,
                patient_id VARCHAR(36) NOT NULL REFERENCES patients(id), collected_at TIMESTAMPTZ NOT NULL,
                specimen_type VARCHAR(20) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE worker_site_assignments (
                id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                site_id VARCHAR(36) NOT NULL REFERENCES sites(id), start_date VARCHAR(10) NOT NULL,
                end_date VARCHAR(10), created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE travel_events (
                id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                origin VARCHAR(120) NOT NULL, destination VARCHAR(120) NOT NULL, arrival_date VARCHAR(10),
                created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE clinical_assessments (
                id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                facility_id VARCHAR(36), encounter_at TIMESTAMPTZ NOT NULL, temperature_c FLOAT,
                fever_duration_days INTEGER, symptoms JSON, general_condition VARCHAR(40),
                systolic_bp INTEGER, diastolic_bp INTEGER, admission_status VARCHAR(20) NOT NULL DEFAULT 'outpatient',
                treatment_documentation TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE diagnostic_tests (
                id VARCHAR(36) PRIMARY KEY, sample_id VARCHAR(36) NOT NULL REFERENCES samples(id),
                method VARCHAR(30) NOT NULL, result_status VARCHAR(20) NOT NULL, species VARCHAR(30),
                smear_type VARCHAR(20), operator_id VARCHAR(36), performed_at TIMESTAMPTZ, notes TEXT,
                created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            CREATE TABLE follow_ups (
                id VARCHAR(36) PRIMARY KEY, patient_id VARCHAR(36) NOT NULL REFERENCES patients(id),
                assigned_user_id VARCHAR(36), due_at TIMESTAMPTZ NOT NULL, completed_at TIMESTAMPTZ,
                status VARCHAR(20) NOT NULL DEFAULT 'due', adherence VARCHAR(30), outcome VARCHAR(40),
                notes TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
            );
            INSERT INTO users (id, phone_e164, display_name, pin_hash, preferred_language, created_at, updated_at)
            VALUES ('upg-hw-1', '+919999900010', 'PG Legacy Worker', 'hash', 'en', NOW(), NOW());
            INSERT INTO patients (id, patient_code, display_name, age_years, gender, phone_e164, preferred_language, consent_status, created_at, updated_at)
            VALUES ('upg-pat-1', 'M3-PG-LEG-01', 'PG Legacy Participant', 28, 'female', '+919876500099', 'en', 'documented', NOW(), NOW());
            INSERT INTO samples (id, sample_code, patient_id, collected_at, specimen_type, status, created_at, updated_at)
            VALUES ('upg-smp-1', 'M3-PG-SMP-01', 'upg-pat-1', NOW(), 'blood', 'pending', NOW(), NOW());
        """))
        conn.commit()

        pre_row = conn.execute(text("SELECT id, patient_code, display_name, age_years, gender, phone_e164, consent_status FROM patients WHERE id = 'upg-pat-1'")).mappings().fetchone()
        pre_checksum = compute_row_checksum(dict(pre_row))

    # Run Alembic upgrade head against the isolated migration PostgreSQL target
    api_dir = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(api_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(api_dir / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", pg_mig_url)
    command.upgrade(alembic_cfg, "head")

    with engine.connect() as conn:
        post_row = conn.execute(text("SELECT id, patient_code, display_name, age_years, gender, phone_e164, consent_status FROM patients WHERE id = 'upg-pat-1'")).mappings().fetchone()
        assert post_row is not None
        post_checksum = compute_row_checksum(dict(post_row))
        assert pre_checksum == post_checksum, "PostgreSQL upgrade altered legacy patient record"

        # Verify added columns & partial unique index
        col_names = {c["name"] for c in inspect(engine).get_columns("patients")}
        assert {"dob", "age_flagged", "client_request_id", "created_by_user_id"} <= col_names

        idx_names = {idx["name"] for idx in inspect(engine).get_indexes("patients")}
        assert "ix_patients_client_request_id" in idx_names
        assert "uq_patients_client_request_id" in idx_names
    engine.dispose()
