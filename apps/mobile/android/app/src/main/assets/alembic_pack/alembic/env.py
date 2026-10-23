from app.database import Base, get_database_url
from app import models  # noqa: F401
from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
url = config.get_main_option("sqlalchemy.url")
import os as _os
if (not url) or "placeholder" in url:
    url = _os.environ.get("DATABASE_URL") or get_database_url()
    config.set_main_option("sqlalchemy.url", url)

target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = url
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
