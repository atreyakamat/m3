"""initial M3 relational schema

Revision ID: 20261019_01
Revises:
Create Date: 2026-10-19
"""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20261019_01"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    Base.metadata.create_all(bind=op.get_bind())

def downgrade():
    Base.metadata.drop_all(bind=op.get_bind())
