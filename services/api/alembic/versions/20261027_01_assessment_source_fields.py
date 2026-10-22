"""Questionnaire update (01 Sept 2026 source) — clinical assessment source fields.

Adds four nullable columns to clinical_assessments so the clinician form can
record every source field without overloading free-text fields:

- symptoms_other_note          "Others (specify)" text for encounter symptoms
- admission_species_other_note "Other:" species text at admission
- treatment_given              source page 5 "IF ADMITTED = NO": treatment given
- follow_up_assigned           source page 5: health worker assigned for follow-up

Additive and non-destructive: all columns are nullable (NULL for existing rows),
no existing column is altered or dropped, and no data is migrated.
"""
import sqlalchemy as sa
from alembic import op

revision = "20261027_01"
down_revision = "20261026_01"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name, col_name):
    insp = sa.inspect(bind)
    return any(c["name"] == col_name for c in insp.get_columns(table_name))


NEW_COLUMNS = [
    ("symptoms_other_note", sa.Column("symptoms_other_note", sa.String(length=200), nullable=True)),
    ("admission_species_other_note", sa.Column("admission_species_other_note", sa.String(length=200), nullable=True)),
    ("treatment_given", sa.Column("treatment_given", sa.String(length=10), nullable=True)),
    ("follow_up_assigned", sa.Column("follow_up_assigned", sa.String(length=10), nullable=True)),
]


def upgrade():
    bind = op.get_bind()
    for col_name, column in NEW_COLUMNS:
        if not _column_exists(bind, "clinical_assessments", col_name):
            op.add_column("clinical_assessments", column)


def downgrade():
    bind = op.get_bind()
    for col_name, _column in reversed(NEW_COLUMNS):
        if _column_exists(bind, "clinical_assessments", col_name):
            op.drop_column("clinical_assessments", col_name)
