"""Phase 2-3/10: cases, symptom reports, notifications, case events + linkage columns.

Additive and reversible: four new tables and three nullable index-backed
columns on existing tables (clinical_assessments.case_id, samples.case_id,
follow_ups.case_id) so existing clinical records can join a case without any
row mutation. No foreign keys on the linkage columns (legacy test data), all
new tables use proper FKs.
"""
revision = "20261022_01"
down_revision = "20261021_01"


def _add_col(bind, table_name, column):
    from sqlalchemy import inspect as sa_inspect
    from alembic import op
    insp = sa_inspect(bind)
    if not insp.has_table(table_name):
        return
    if any(c["name"] == column.name for c in insp.get_columns(table_name)):
        return
    op.add_column(table_name, column)


def upgrade():
    import sqlalchemy as sa
    from sqlalchemy import inspect as sa_inspect
    from alembic import op

    bind = op.get_bind()
    insp = sa_inspect(bind)

    if not insp.has_table("cases"):
        op.create_table(
            "cases",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("case_code", sa.String(24), nullable=False, unique=True),
            sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("site_id", sa.String(36), sa.ForeignKey("sites.id"), nullable=True, index=True),
            sa.Column("status", sa.String(40), nullable=False, default="submitted", index=True),
            sa.Column("urgent", sa.Boolean(), nullable=False, default=False),
            sa.Column("source", sa.String(24), nullable=False, default="symptom_report", index=True),
            sa.Column("created_by_user_id", sa.String(36), nullable=True),
            sa.Column("assigned_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True, index=True),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("client_request_id", sa.String(64), nullable=True, unique=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if not insp.has_table("symptom_reports"):
        op.create_table(
            "symptom_reports",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("case_id", sa.String(36), sa.ForeignKey("cases.id"), nullable=False, unique=True, index=True),
            sa.Column("patient_id", sa.String(36), sa.ForeignKey("patients.id"), nullable=False, index=True),
            sa.Column("site_id", sa.String(36), sa.ForeignKey("sites.id"), nullable=True, index=True),
            sa.Column("location_note", sa.String(200), nullable=True),
            sa.Column("symptoms", sa.JSON(), nullable=False),
            sa.Column("onset_category", sa.String(32), nullable=True),
            sa.Column("temperature_c", sa.Float(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("attend_facility", sa.String(16), nullable=True),
            sa.Column("contact_pref", sa.String(32), nullable=True),
            sa.Column("reported_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("client_request_id", sa.String(64), nullable=True, unique=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if not insp.has_table("case_events"):
        op.create_table(
            "case_events",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("case_id", sa.String(36), sa.ForeignKey("cases.id"), nullable=False, index=True),
            sa.Column("from_status", sa.String(40), nullable=True),
            sa.Column("to_status", sa.String(40), nullable=False),
            sa.Column("actor_user_id", sa.String(36), nullable=True),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if not insp.has_table("notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("recipient_user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("case_id", sa.String(36), sa.ForeignKey("cases.id"), nullable=True, index=True),
            sa.Column("kind", sa.String(40), nullable=False, index=True),
            sa.Column("title", sa.String(120), nullable=False),
            sa.Column("body", sa.String(300), nullable=False),
            sa.Column("body_minimal", sa.Boolean(), nullable=False, default=False, index=True),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True, default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )

    _add_col(bind, "clinical_assessments", sa.Column("case_id", sa.String(36), nullable=True))
    _add_col(bind, "samples", sa.Column("case_id", sa.String(36), nullable=True))
    _add_col(bind, "follow_ups", sa.Column("case_id", sa.String(36), nullable=True))

    for table, col in (("clinical_assessments", "case_id"), ("samples", "case_id"), ("follow_ups", "case_id")):
        ix_name = f"ix_{table}_{col}"
        if insp.has_table(table) and not any(ix["name"] == ix_name for ix in insp.get_indexes(table)):
            op.create_index(ix_name, table, [col], unique=False)


def downgrade():
    from alembic import op
    import sqlalchemy as sa
    from sqlalchemy import inspect as sa_inspect

    bind = op.get_bind()
    insp = sa_inspect(bind)
    for table, col in (("follow_ups", "case_id"), ("samples", "case_id"), ("clinical_assessments", "case_id")):
        if not insp.has_table(table):
            continue
        cols = [c["name"] for c in insp.get_columns(table)]
        ixs = [ix["name"] for ix in insp.get_indexes(table)]
        ix_name = f"ix_{table}_{col}"
        if col in cols and ix_name in ixs:
            op.drop_index(ix_name, table_name=table)
        if col in cols:
            op.drop_column(table, col)
    for t in ("notifications", "case_events", "symptom_reports", "cases"):
        if insp.has_table(t):
            op.drop_table(t)
