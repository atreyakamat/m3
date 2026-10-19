from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import get_settings

def get_database_url() -> str:
    return get_settings().database_url

def _connect_args(url: str):
    return {"check_same_thread": False} if url.startswith("sqlite") else {}

engine = create_engine(get_database_url(), future=True, pool_pre_ping=True, connect_args=_connect_args(get_database_url()))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
