"""questionnaire submissions, worker identity fields, slides, travel, contractor reports

Revision ID: 20261020_01
Revises: 20261019_01
Create Date: 2026-10-20

Additive migration only: existing records are preserved. No table is dropped or
recreated; added columns are nullable and new tables start empty.
"""
import sqlalchemy as sa
from alembic import op

revision = "20261020_01"
down_revision = "20261019_01"
branch_labels = None
depends_on = None

def _column_exists(table_name, col_name):
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == col_name for c in insp.get_columns(table_name))

def _table_exists(table_name):
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table_name in insp.get_table_names()

def _add_col(table_name, column):
    if not _column_exists(table_name, column.name):
        op.add_column(table_name, column)

def upgrade():
    # 1. Additive columns on patients
    _add_col("patients", sa.Column("dob", sa.Date(), nullable=True))
    _add_col("patients", sa.Column("age_as_on", sa.Date(), nullable=True))
    _add_col("patients", sa.Column("age_flagged", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_col("patients", sa.Column("phone_e164", sa.String(16), nullable=True))
    _add_col("patients", sa.Column("alternate_contact", sa.String(120), nullable=True))
    _add_col("patients", sa.Column("id_type", sa.String(30), nullable=True))
    _add_col("patients", sa.Column("id_other_details", sa.String(200), nullable=True))
    _add_col("patients", sa.Column("address_present", sa.String(400), nullable=True))
    _add_col("patients", sa.Column("address_permanent", sa.String(400), nullable=True))

    # 2. Additive columns on sites
    _add_col("sites", sa.Column("contractor_user_id", sa.String(36), nullable=True))

    # 3. Additive columns on worker_site_assignments
    _add_col("worker_site_assignments", sa.Column("reported_malaria_status", sa.String(20), nullable=True))
    _add_col("worker_site_assignments", sa.Column("reported_treatment_status", sa.String(20), nullable=True))
    _add_col("worker_site_assignments", sa.Column("reported_at", sa.DateTime(timezone=True), nullable=True))
    _add_col("worker_site_assignments", sa.Column("reported_by_user_id", sa.String(36), nullable=True))

    # 4. Additive columns on travel_events
    _add_col("travel_events", sa.Column("departure_date", sa.String(10), nullable=True))
    _add_col("travel_events", sa.Column("return_date", sa.String(10), nullable=True))
    _add_col("travel_events", sa.Column("planned", sa.Boolean(), nullable=False, server_default=sa.false()))

    # 5. Additive columns on clinical_assessments
    _add_col("clinical_assessments", sa.Column("medical_officer_name", sa.String(140), nullable=True))
    _add_col("clinical_assessments", sa.Column("fever_duration_category", sa.String(32), nullable=True))
    _add_col("clinical_assessments", sa.Column("onset_date", sa.String(10), nullable=True))
    _add_col("clinical_assessments", sa.Column("red_flags", sa.JSON(), nullable=True))
    _add_col("clinical_assessments", sa.Column("comorbidities_list", sa.JSON(), nullable=True))
    _add_col("clinical_assessments", sa.Column("can_attend_testing", sa.String(20), nullable=True))
    _add_col("clinical_assessments", sa.Column("admission_species", sa.String(30), nullable=True))
    _add_col("clinical_assessments", sa.Column("admission_symptoms", sa.JSON(), nullable=True))
    _add_col("clinical_assessments", sa.Column("admission_severity", sa.String(30), nullable=True))
    _add_col("clinical_assessments", sa.Column("treatment_completed", sa.String(30), nullable=True))
    _add_col("clinical_assessments", sa.Column("treatment_incomplete_reason", sa.String(500), nullable=True))
    _add_col("clinical_assessments", sa.Column("discharge_date", sa.String(10), nullable=True))
    _add_col("clinical_assessments", sa.Column("outcome", sa.String(100), nullable=True))
    _add_col("clinical_assessments", sa.Column("remarks", sa.Text(), nullable=True))

    # 6. Additive columns on samples
    _add_col("samples", sa.Column("facility_id", sa.String(36), nullable=True))

    # 7. Additive columns on diagnostic_tests
    _add_col("diagnostic_tests", sa.Column("other_method_note", sa.String(500), nullable=True))
    _add_col("diagnostic_tests", sa.Column("species_other_note", sa.String(200), nullable=True))

    # 8. Additive columns on follow_ups
    _add_col("follow_ups", sa.Column("created_by_user_id", sa.String(36), nullable=True))
    _add_col("follow_ups", sa.Column("scheduled_day", sa.String(20), nullable=True))

    # 9. New tables if not exist
    if not _table_exists("questionnaire_submissions"):
        op.create_table(
            "questionnaire_submissions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("state", sa.String(20), nullable=False, server_default="draft", index=True),
            sa.Column("data", sa.JSON(), nullable=True),
            sa.Column("client_request_id", sa.String(64), nullable=True, unique=True, index=True),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("respondent_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    if not _table_exists("slide_follow_ups"):
        op.create_table(
            "slide_follow_ups",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("sample_id", sa.String(36), sa.ForeignKey("samples.id"), nullable=False, index=True),
            sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("scheduled_day", sa.String(20), nullable=True),
            sa.Column("due_date", sa.String(10), nullable=True),
            sa.Column("received", sa.String(10), nullable=False, server_default="unknown"),
            sa.Column("positive", sa.String(10), nullable=True),
            sa.Column("positive_day", sa.String(20), nullable=True),
            sa.Column("not_received_reason", sa.String(60), nullable=True),
            sa.Column("other_reason", sa.String(300), nullable=True),
            sa.Column("recorded_by_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    if not _table_exists("worker_qr_tokens"):
        op.create_table(
            "worker_qr_tokens",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("token", sa.String(64), nullable=False, unique=True, index=True),
            sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("created_by_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )

def downgrade():
    if _table_exists("worker_qr_tokens"):
        op.drop_table("worker_qr_tokens")
    if _table_exists("slide_follow_ups"):
        op.drop_table("slide_follow_ups")
    if _table_exists("questionnaire_submissions"):
        op.drop_table("questionnaire_submissions")
