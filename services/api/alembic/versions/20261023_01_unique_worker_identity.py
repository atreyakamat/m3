"""stable worker identity: at most one account per worker profile

Adds a partial unique index on users.patient_id. Additive and non-destructive:
no row is changed or deleted. If development data already has two accounts
pointing at one profile the index is NOT created (the upgrade must not delete or
merge potentially conflicting records); the conflict is reported on stderr and
`scripts/reconcile_worker_identity.py` lists it for an audited manual decision.
"""
import sys

revision = "20261023_01"
down_revision = "20261022_01"

INDEX = "uq_users_patient_id"


def upgrade():
    import sqlalchemy as sa
    from sqlalchemy import inspect as sa_inspect
    from alembic import op

    bind = op.get_bind()
    insp = sa_inspect(bind)
    if not insp.has_table("users"):
        return
    if any(ix["name"] == INDEX for ix in insp.get_indexes("users")):
        return
    dupes = bind.execute(sa.text(
        "SELECT patient_id, COUNT(*) FROM users WHERE patient_id IS NOT NULL "
        "GROUP BY patient_id HAVING COUNT(*) > 1")).fetchall()
    if dupes:
        print(f"WARNING: {INDEX} not created: {len(dupes)} profile(s) are claimed by more than one "
              "account. Run scripts/reconcile_worker_identity.py (report mode) and resolve, "
              "then re-run `alembic upgrade head`.", file=sys.stderr)
        return
    op.create_index(INDEX, "users", ["patient_id"], unique=True,
                    postgresql_where=sa.text("patient_id IS NOT NULL"),
                    sqlite_where=sa.text("patient_id IS NOT NULL"))


def downgrade():
    from alembic import op
    from sqlalchemy import inspect as sa_inspect

    insp = sa_inspect(op.get_bind())
    if insp.has_table("users") and any(ix["name"] == INDEX for ix in insp.get_indexes("users")):
        op.drop_index(INDEX, table_name="users")
