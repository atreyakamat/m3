"""Add prescriptions table for structured prescriptions with history.

Additive migration only: creates prescriptions table, no drops/edits to
existing columns or data. Preserves treatment_documentation on
clinical_assessments and all historical records.
"""
import sqlalchemy as sa
from alembic import op

revision = "20261028_01"
down_revision = "20261027_01"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "prescriptions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("patient_id", sa.String(length=36), sa.ForeignKey("patients.id"), nullable=False, index=True),
        sa.Column("case_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("assessment_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("prescriber_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("medicine_name", sa.String(length=160), nullable=False),
        sa.Column("dose", sa.String(length=80), nullable=True),
        sa.Column("unit", sa.String(length=40), nullable=True),
        sa.Column("frequency", sa.String(length=80), nullable=True),
        sa.Column("duration", sa.String(length=80), nullable=True),
        sa.Column("start_date", sa.String(length=10), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active", index=True),
        sa.Column("supersedes_prescription_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("revised_by_prescription_id", sa.String(length=36), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("prescriptions")
