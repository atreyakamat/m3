from datetime import timedelta, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import get_settings
from .database import get_db
from .models import User, RoleAssignment, Session as DbSession, now

# Argon2id with an OWASP-aligned 19 MiB memory cost; tune upward after host sizing.
password_hash = PasswordHash((Argon2Hasher(time_cost=2, memory_cost=19_456, parallelism=1),))
bearer = HTTPBearer(auto_error=False)

def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if digits.startswith("91") and len(digits) == 12:
        return "+" + digits
    if phone.startswith("+") and 8 <= len(digits) <= 15:
        return "+" + digits
    raise ValueError("Use a valid phone number")

def hash_pin(pin: str) -> str: return password_hash.hash(pin)
def verify_pin(pin: str, hashed: str) -> bool: return password_hash.verify(pin, hashed)

def create_token(user: User, db: Session):
    settings = get_settings()
    expires = now() + timedelta(minutes=settings.access_token_minutes)
    session = DbSession(user_id=user.id, expires_at=expires)
    db.add(session); db.flush()
    token = jwt.encode({"sub": user.id, "sid": session.id, "exp": expires}, settings.jwt_secret, algorithm="HS256")
    return token, expires

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(credentials.credentials, get_settings().jwt_secret, algorithms=["HS256"])
        session = db.get(DbSession, payload.get("sid"))
        user = db.get(User, payload.get("sub"))
    except InvalidTokenError:
        session = user = None
    expires_at = session.expires_at if session else None
    # SQLite test storage returns naive timestamps; PostgreSQL keeps the UTC offset.
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if not session or session.revoked_at or not expires_at or expires_at < now() or not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user

def active_roles(user: User, db: Session) -> set[str]:
    return set(db.scalars(select(RoleAssignment.role).where(RoleAssignment.user_id == user.id, RoleAssignment.revoked_at.is_(None))).all())

def require_roles(*allowed: str):
    def dependency(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if not active_roles(user, db).intersection(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        return user
    return dependency

def audit(db: Session, user: User | None, action: str, entity_type: str, entity_id: str | None = None, detail: dict | None = None):
    from .models import AuditEvent
    db.add(AuditEvent(actor_user_id=user.id if user else None, action=action, entity_type=entity_type, entity_id=entity_id, detail=detail))
