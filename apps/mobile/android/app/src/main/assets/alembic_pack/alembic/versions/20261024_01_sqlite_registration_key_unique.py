"""SQLite parity: unique registration idempotency key

Migration 20261021_01 creates uq_patients_client_request_id on PostgreSQL only, so a
SQLite database (development) could accept two concurrent registrations with the same
offline request id. Additive: creates the partial unique index if absent. If duplicates
already exist it is NOT created (no rows are changed) and a warning is printed;
scripts/check_deployment_gates.py then reports the gate as failing.
"""
import sys

revision = "20261024_01"
down_revision = "20261023_01"

INDEX = "uq_patients_client_request_id"


def upgrade():
    import sqlalchemy as sa
    from sqlalchemy import inspect as sa_inspect
    from alembic import op

    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        return
    insp = sa_inspect(bind)
    if not insp.has_table("patients") or any(ix["name"] == INDEX for ix in insp.get_indexes("patients")):
        return
    dupes = bind.execute(sa.text(
        "SELECT client_request_id FROM patients WHERE client_request_id IS NOT NULL "
        "GROUP BY client_request_id HAVING COUNT(*) > 1")).fetchall()
    if dupes:
        print(f"WARNING: {INDEX} not created: {len(dupes)} duplicate registration key(s) exist; "
              "resolve manually (no rows were changed).", file=sys.stderr)
        return
    op.create_index(INDEX, "patients", ["client_request_id"], unique=True,
                    sqlite_where=sa.text("client_request_id IS NOT NULL"))


def downgrade():
    from sqlalchemy import inspect as sa_inspect
    from alembic import op

    bind = op.get_bind()
    if bind.dialect.name == "sqlite" and any(ix["name"] == INDEX for ix in sa_inspect(bind).get_indexes("patients")):
        op.drop_index(INDEX, table_name="patients")
