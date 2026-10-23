"""Single-screening governance: screening completion state and re-screen reason.

Adds patients.screening_completed / patients.screened_at so the API can enforce
the once-per-routine-intake rule, and clinical_assessments.re_screening_reason
so every authorized re-screen records why it was performed. Additive and
non-destructive: no rows are deleted or overwritten.
"""
import sqlalchemy as sa
from alembic import op

revision = "20261026_01"
down_revision = "20261025_01"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name, col_name):
    insp = sa.inspect(bind)
    return any(c["name"] == col_name for c in insp.get_columns(table_name))


def upgrade():
    bind = op.get_bind()

    if not _column_exists(bind, "patients", "screening_completed"):
        op.add_column(
            "patients",
            sa.Column("screening_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if not _column_exists(bind, "patients", "screened_at"):
        op.add_column(
            "patients",
            sa.Column("screened_at", sa.DateTime(timezone=True), nullable=True),
        )

    if not _column_exists(bind, "clinical_assessments", "re_screening_reason"):
        op.add_column(
            "clinical_assessments",
            sa.Column("re_screening_reason", sa.Text(), nullable=True),
        )


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    def has_column(table, col):
        return any(c["name"] == col for c in insp.get_columns(table))

    if has_column("clinical_assessments", "re_screening_reason"):
        op.drop_column("clinical_assessments", "re_screening_reason")
    if has_column("patients", "screened_at"):
        op.drop_column("patients", "screened_at")
    if has_column("patients", "screening_completed"):
        op.drop_column("patients", "screening_completed")
