"""Offline-replay idempotency keys for samples and follow-ups (defects D1/D2).

Additive migration: adds client_request_id columns to samples and follow_ups
plus partial unique indexes (uq_samples_client_request_id,
uq_follow_ups_client_request_id) so concurrent duplicate keyed requests lose
the insert race instead of silently duplicating lab results or field tasks.

Safety for existing data:
- Columns are added as NULL by default; no rows are rewritten or deleted.
- DUPLICATE DETECTION runs BEFORE each unique index. If duplicate non-NULL
  values already exist the index is NOT created and the offending keys are
  reported to the operator for manual cleanup (rows are neither changed nor
  deleted); upgrade still completes so environments are never blocked.
- On a fresh database the tables are created from the current models (initial
  revision 20261019_01 uses metadata.create_all), so every step is guarded and
  idempotent.
"""
import sys
import sqlalchemy as sa
from alembic import op

revision = "20261029_01"
down_revision = "20261028_01"
branch_labels = None
depends_on = None

TARGETS = (
    # table, plain replay-lookup index, unique-race index
    ("samples", "ix_samples_client_request_id", "uq_samples_client_request_id"),
    ("follow_ups", "ix_follow_ups_client_request_id", "uq_follow_ups_client_request_id"),
)


def _table_exists(bind, table_name):
    import sqlalchemy as sa
    return table_name in sa.inspect(bind).get_table_names()


def upgrade():
    import sqlalchemy as sa

    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    is_sqlite = bind.dialect.name == "sqlite"

    for table, lookup_index, unique_index in TARGETS:
        if not _table_exists(bind, table):
            continue
        insp = sa.inspect(bind)
        columns = {c["name"] for c in insp.get_columns(table)}
        index_names = {ix["name"] for ix in insp.get_indexes(table)}

        # 1) Add the replay-key column (additive, NULL for all legacy rows).
        if "client_request_id" not in columns:
            op.add_column(table, sa.Column("client_request_id", sa.String(64), nullable=True))
        index_names = {ix["name"] for ix in sa.inspect(bind).get_indexes(table)}
        if lookup_index not in index_names:
            op.create_index(lookup_index, table, ["client_request_id"], unique=False)

        # 3) Duplicate detection BEFORE the unique race index (never deletes).
        dupes = bind.execute(sa.text(
            f"SELECT client_request_id, COUNT(*) AS n FROM {table} "
            "WHERE client_request_id IS NOT NULL "
            "GROUP BY client_request_id HAVING COUNT(*) > 1")).fetchall()
        if dupes:
            print(f"WARNING: {unique_index} NOT created for {table}: "
                  f"{len(dupes)} duplicate idempotency key(s) exist; "
                  "resolve manually (no rows were changed, no rows deleted).",
                  file=sys.stderr)
            for client_request_id, n in dupes:
                detail = bind.execute(sa.text(
                    f"SELECT id, created_at FROM {table} "
                    "WHERE client_request_id = :k ORDER BY created_at"
                ), {"k": client_request_id}).fetchall()
                print(f"  duplicate key {client_request_id!r} on {len(detail)} {table} rows: "
                      f"{[(row[0], str(row[1])) for row in detail]}", file=sys.stderr)
            continue

        # 4) Unique partial index: only non-NULL keys race; legacy NULL rows
        # and unrelated keys are unaffected. PostgreSQL uses a partial index;
        # SQLite ignores the where-clause bitmap but excludes no rows (NULLs
        # are never equal to each other in UNIQUE), so behavior matches.
        insp = sa.inspect(bind)
        index_names = {ix["name"] for ix in insp.get_indexes(table)}
        if unique_index in index_names:
            continue
        if is_postgres:
            op.create_index(
                unique_index, table, ["client_request_id"], unique=True,
                postgresql_where=sa.text("client_request_id IS NOT NULL"),
            )
        elif is_sqlite:
            op.create_index(
                unique_index, table, ["client_request_id"], unique=True,
                sqlite_where=sa.text("client_request_id IS NOT NULL"),
            )
        else:
            op.create_index(unique_index, table, ["client_request_id"], unique=True)


def downgrade():
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    for table, lookup_index, unique_index in TARGETS:
        if not _table_exists(bind, table):
            continue
        insp = sa.inspect(bind)
        index_names = {ix["name"] for ix in insp.get_indexes(table)}
        if unique_index in index_names:
            op.drop_index(unique_index, table_name=table)
        if lookup_index in index_names:
            op.drop_index(lookup_index, table_name=table)
        columns = {c["name"] for c in sa.inspect(bind).get_columns(table)}
        if not is_sqlite and "client_request_id" in columns:
            op.drop_column(table, "client_request_id")
