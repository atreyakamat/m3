"""patient offline-replay identity: client_request_id + created_by_user_id
"""
revision = "20261021_01"
down_revision = "20261020_01"


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
    from alembic import op

    bind = op.get_bind()
    _add_col(bind, "patients", sa.Column("client_request_id", sa.String(64), nullable=True))
    _add_col(bind, "patients", sa.Column("created_by_user_id", sa.String(36), nullable=True))

    from sqlalchemy import inspect as sa_inspect
    insp = sa_inspect(bind)
    if insp.has_table("patients"):
        if not any(ix["name"] == "ix_patients_client_request_id" for ix in insp.get_indexes("patients")):
            op.create_index("ix_patients_client_request_id", "patients", ["client_request_id"], unique=False)
        if hasattr(insp, "get_unique_constraints") and insp.dialect.name != "sqlite" \
                and not any(ix["name"] == "uq_patients_client_request_id" for ix in insp.get_indexes("patients")):
            # Data-integrity backstop: two concurrent first-registering requests for the
            # same offline worker must never BOTH insert a reconciliation row. The
            # application-level replay check cannot win that race alone; this partial
            # unique index (PostgreSQL) makes the loser fail loudly (HTTP 500) instead
            # of silently duplicating a patient. Partial because worker
            # self-registration and legacy rows have NULL client_request_id.
            op.create_index(
                "uq_patients_client_request_id", "patients", ["client_request_id"],
                unique=True,
                postgresql_where=sa.text("client_request_id IS NOT NULL"),
            )
        existing_fk_names = {fk.get("name") for fk in insp.get_foreign_keys("patients")}
        # SQLite does not support ALTER-of-constraints (batch rebuild is the only
        # option); the column-level ForeignKey metadata already covers integrity
        # there, so the named circular-FK constraint is PostgreSQL-only.
        if "fk_patients_created_by" not in existing_fk_names and bind.dialect.name != "sqlite":
            op.create_foreign_key("fk_patients_created_by", "patients", "users",
                                  ["created_by_user_id"], ["id"], use_alter=True)


def downgrade():
    from alembic import op

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # IF EXISTS keeps the downgrade safe on databases that were migrated
        # with intermediate code revisions (e.g. columns created but a later
        # index revision not yet applied).
        op.execute("DROP INDEX IF EXISTS uq_patients_client_request_id")
        op.execute("ALTER TABLE patients DROP CONSTRAINT IF EXISTS fk_patients_created_by")
        op.execute("DROP INDEX IF EXISTS ix_patients_created_by_user_id")
        op.execute("DROP INDEX IF EXISTS ix_patients_client_request_id")
        op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS created_by_user_id")
        op.execute("ALTER TABLE patients DROP COLUMN IF EXISTS client_request_id")
        return
    # SQLite cannot DROP COLUMN while a foreign key references it, so rebuild
    # the patients table without the two replay-identity columns instead.
    # Indexes that reference the columns must go FIRST: alembic's batch
    # rebuild copies surviving indexes onto the new table, where the columns
    # (and any index still referencing them) no longer exist.
    for ix_name in ("uq_patients_client_request_id", "ix_patients_client_request_id",
                    "ix_patients_created_by_user_id"):
        try:
            op.drop_index(ix_name, table_name="patients")
        except Exception:
            pass
    with op.batch_alter_table("patients", recreate="always") as batch:
        batch.drop_column("created_by_user_id")
        batch.drop_column("client_request_id")
