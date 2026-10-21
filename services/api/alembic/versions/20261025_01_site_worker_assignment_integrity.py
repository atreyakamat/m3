"""Site creation idempotency and worker site assignment integrity

Adds client_request_id to sites and worker_site_assignments for safe idempotency,
and enforces at most one active site assignment per worker via a partial unique index.
Additive and non-destructive: no rows are deleted or overwritten.
"""
import sys
import sqlalchemy as sa
from alembic import op

revision = "20261025_01"
down_revision = "20261024_01"
branch_labels = None
depends_on = None

ACTIVE_INDEX = "uq_worker_site_assignments_active_worker"
SITE_CRID_INDEX = "uq_sites_client_request_id"
ASGN_CRID_INDEX = "uq_worker_site_assignments_client_request_id"


def _column_exists(bind, table_name, col_name):
    insp = sa.inspect(bind)
    return any(c["name"] == col_name for c in insp.get_columns(table_name))


def _index_exists(bind, table_name, idx_name):
    insp = sa.inspect(bind)
    return any(ix["name"] == idx_name for ix in insp.get_indexes(table_name))


def upgrade():
    bind = op.get_bind()

    # 1. Additive column sites.client_request_id
    if not _column_exists(bind, "sites", "client_request_id"):
        op.add_column("sites", sa.Column("client_request_id", sa.String(64), nullable=True))

    if not _index_exists(bind, "sites", SITE_CRID_INDEX):
        op.create_index(
            SITE_CRID_INDEX,
            "sites",
            ["client_request_id"],
            unique=True,
            postgresql_where=sa.text("client_request_id IS NOT NULL"),
            sqlite_where=sa.text("client_request_id IS NOT NULL"),
        )

    # 2. Additive column worker_site_assignments.client_request_id
    if not _column_exists(bind, "worker_site_assignments", "client_request_id"):
        op.add_column("worker_site_assignments", sa.Column("client_request_id", sa.String(64), nullable=True))

    if not _index_exists(bind, "worker_site_assignments", ASGN_CRID_INDEX):
        op.create_index(
            ASGN_CRID_INDEX,
            "worker_site_assignments",
            ["client_request_id"],
            unique=True,
            postgresql_where=sa.text("client_request_id IS NOT NULL"),
            sqlite_where=sa.text("client_request_id IS NOT NULL"),
        )

    # 3. Partial unique index on active worker assignment (patient_id WHERE end_date IS NULL)
    if not _index_exists(bind, "worker_site_assignments", ACTIVE_INDEX):
        # Check for pre-existing duplicate active assignments before creating index
        dupes = bind.execute(sa.text(
            "SELECT patient_id, COUNT(*) FROM worker_site_assignments WHERE end_date IS NULL "
            "GROUP BY patient_id HAVING COUNT(*) > 1"
        )).fetchall()
        if dupes:
            print(
                f"WARNING: {ACTIVE_INDEX} not created: {len(dupes)} worker(s) have multiple active "
                "site assignments. Resolve manually before creating index.",
                file=sys.stderr,
            )
        else:
            op.create_index(
                ACTIVE_INDEX,
                "worker_site_assignments",
                ["patient_id"],
                unique=True,
                postgresql_where=sa.text("end_date IS NULL"),
                sqlite_where=sa.text("end_date IS NULL"),
            )


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _index_exists(bind, "worker_site_assignments", ACTIVE_INDEX):
        op.drop_index(ACTIVE_INDEX, table_name="worker_site_assignments")

    if _index_exists(bind, "worker_site_assignments", ASGN_CRID_INDEX):
        op.drop_index(ASGN_CRID_INDEX, table_name="worker_site_assignments")

    if _index_exists(bind, "sites", SITE_CRID_INDEX):
        op.drop_index(SITE_CRID_INDEX, table_name="sites")

    # In SQLite, dropping columns is handled via batch mode if needed, but in forward-only migrations
    # columns are preserved.
    if bind.dialect.name != "sqlite":
        if _column_exists(bind, "worker_site_assignments", "client_request_id"):
            op.drop_column("worker_site_assignments", "client_request_id")
        if _column_exists(bind, "sites", "client_request_id"):
            op.drop_column("sites", "client_request_id")
