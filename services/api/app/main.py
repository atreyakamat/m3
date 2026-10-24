import logging
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, selectinload
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from . import permissions, questionnaire as questionnaire_schema
from .analytics import router as analytics_router
from .config import get_settings
from .database import get_db, DATABASE_MODE, DB_DISABLED_DETAIL, database_enabled, engine
from . import kafka_producer
from .models import (AuditEvent, Case, CaseEvent, ClinicalAssessment, DiagnosticTest, Facility, FollowUp,
                     MolecularResult, Notification, Patient, QuestionnaireSubmission, RoleAssignment, Sample, Session,
                     Site, SymptomReport, SlideFollowUp, TravelEvent, User, WorkerQrToken, WorkerSiteAssignment,
                     now, uid)
from .schemas import (AssessmentCreate, FollowUpCreate, LoginIn, MembershipCreate, MolecularCreate,
                      ProvisionIn, QuestionnaireSave, QuestionnaireSubmitIn, ReportedStatusIn, SampleCreate,
                      SignupIn, SiteCreate, SiteWorkerAssignIn, SlideFollowUpSave, TokenOut, TravelEpisodeCreate, WorkerCreate)
from .security import active_roles, audit, create_token, current_session, get_current_user, hash_pin, normalize_phone, require_roles, revoke_session, verify_pin

logger = logging.getLogger("m3.api")

class RequestCorrelationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID")
        if not req_id:
            req_id = f"req_{uuid.uuid4().hex[:12]}"
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response

app = FastAPI(title="M3 Malaria Surveillance API", version="0.2.0", description="Synthetic-data prototype. Not approved for clinical deployment.")
app.add_middleware(RequestCorrelationMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(analytics_router)

@app.on_event("startup")
def _verify_database_configuration():
    """Startup safety checks per database mode.

    - postgres / sqlite: verify configuration and connectivity with a trivial
      query; a configuration or connectivity problem must FAIL THE STARTUP with
      a clear error instead of limping until the first request. Error messages
      never include the configured URL or credentials.
    - none: log the validation-only banner. No connection is attempted, no
      migration runs, no table is created, no seed data is installed.
    """
    if DATABASE_MODE == "none":
        logger.warning(
            "VALIDATION-ONLY MODE: running with M3_DATABASE_MODE=none. "
            "No database engine exists; no migrations, table creation, or seed "
            "data run; database-dependent endpoints return 503 database_disabled."
        )
        return
    logger.info("Database mode: %s (strict, from M3_DATABASE_MODE); verifying connectivity...", DATABASE_MODE)
    assert database_enabled() and engine is not None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — any failure must stop startup
        logger.error("Startup database connectivity check failed (mode=%s): %s", DATABASE_MODE, type(exc).__name__)
        raise RuntimeError(
            f"The configured database could not be reached (M3_DATABASE_MODE={DATABASE_MODE}). "
            "The server refuses to start rather than falling back to another database. "
            "Fix DATABASE_URL / M3_DATABASE_MODE and restart. "
            f"Underlying error: {type(exc).__name__}"
        ) from exc
    logger.info("Database connectivity verified at startup (mode=%s).", DATABASE_MODE)

@app.on_event("startup")
async def _start_event_hub():
    """Best-effort Kafka event hub (Task 7): a background drain task publishes
    surveillance events to topic `malaria.events` when KAFKA_ENABLED=true;
    otherwise this is a no-op."""
    await kafka_producer.start_event_producer()

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error("Unhandled error on %s %s [req_id=%s]: %s", request.method, request.url.path, req_id, str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "request_id": req_id},
        headers={"X-Request-ID": req_id}
    )

@app.post("/api/v1/validate-questionnaire", tags=["operations"])
def validate_questionnaire(body: QuestionnaireSubmitIn):
    """Database-free request validation (all modes, including `none`).

    Runs the SAME validation the worker questionnaire submission performs
    (schema plus the pure questionnaire rules), but NEVER persists, never
    touches the database, and never reports a submission as accepted. The
    response always states `"persisted": false` so a caller cannot mistake
    schema validity for a stored record. Deliberately unauthenticated: it can
    only return rule errors for the submitted payload — it has no access to
    stored data — so it can serve request-shape validation in validation-only
    mode without weakening any authorization boundary.
    """
    errors = questionnaire_schema.validate(body.data)
    return {
        "valid": not errors,
        "errors": errors,
        "schema_version": questionnaire_schema.SCHEMA_VERSION,
        "database_mode": DATABASE_MODE,
        "persisted": False,
        "note": "Validation only — nothing was stored.",
    }

def page(items, total, offset, limit): return {"items": items, "total": total, "offset": offset, "limit": limit}

def user_view(user, db):
    return {"id": user.id, "display_name": user.display_name, "preferred_language": user.preferred_language, "roles": sorted(active_roles(user, db)), "patient_id": user.patient_id}

def effective(user, db):
    return permissions.effective_roles(active_roles(user, db))

CONTACT_FIELDS = {"display_name", "dob", "age_as_on", "phone_e164", "alternate_contact", "id_type", "id_other_details", "address_present", "address_permanent"}
HEALTH_CONTEXT_FIELDS = {"initial_symptoms"}

# Research Lab explicit field allowlist (PRD/Phase B). "other number" is
# undefined and must NEVER be added/exposed. Diagnosis/prescription fields are
# surfaced only via dedicated restricted views (see research_restricted_patient).
RESEARCH_ALLOWED_PATIENT_FIELDS = {"id", "patient_code", "display_name", "age_years", "gender", "updated_at"}
RESEARCH_FORBIDDEN_PATIENT_FIELDS = {"occupation", "nativity", "phone_e164", "alternate_contact",
                                     "id_type", "id_other_details", "address_present", "address_permanent",
                                     "dob", "age_as_on", "age_flagged", "preferred_language", "initial_symptoms"}

def patient_view(p: Patient, roles: set[str], own: bool = False):
    """Role-filtered worker profile view."""
    data = {"id": p.id, "patient_code": p.patient_code, "age_years": p.age_years, "gender": p.gender, "occupation": p.occupation,
            "consent_status": p.consent_status, "updated_at": p.updated_at,
            # Screening state drives the single-screening rule in every client;
            # it is operational (not clinical) data and is safe to expose here.
            "screening_completed": bool(p.screening_completed),
            "screened_at": p.screened_at,
            # Home state (nativity) supports name/state-based lookup for health workers.
            "nativity": p.nativity}
    if "clinician" in roles or "pathologist" in roles or own or "health_worker" in roles:
        data.update(display_name=p.display_name, dob=p.dob, age_as_on=p.age_as_on, age_flagged=p.age_flagged,
                    phone_e164=p.phone_e164, alternate_contact=p.alternate_contact, id_type=p.id_type,
                    id_other_details=p.id_other_details, address_present=p.address_present,
                    address_permanent=p.address_permanent, preferred_language=p.preferred_language)
        data["initial_symptoms"] = p.initial_symptoms or []
    elif "contractor" in roles:
        data["display_name"] = p.display_name
    elif "research_lab" in roles:
        data = {k: v for k, v in data.items() if k in RESEARCH_ALLOWED_PATIENT_FIELDS}
        # Explicitly strip anything that might be added in future
        for f in RESEARCH_FORBIDDEN_PATIENT_FIELDS:
            data.pop(f, None)
    return data

def sample_view(s, roles=None):
    tests = [{"id": t.id, "method": t.method, "other_method_note": t.other_method_note, "result_status": t.result_status,
              "species": t.species, "species_other_note": t.species_other_note, "smear_type": t.smear_type,
              "performed_at": t.performed_at} for t in s.tests]
    # updated_at is the optimistic-concurrency stamp: clients mirror it back as
    # base_updated_at on follow-up writes (slide follow-up guard, main.py:590).
    data = {"id": s.id, "sample_code": s.sample_code, "patient_id": s.patient_id, "status": s.status,
            "specimen_type": s.specimen_type, "collected_at": s.collected_at, "updated_at": s.updated_at,
            "case_id": s.case_id, "tests": tests}
    if "pathologist" in (roles or set()):
        data["facility_id"] = s.facility_id
        data["slide_followups"] = [{"id": f.id, "scheduled_day": f.scheduled_day, "due_date": f.due_date, "received": f.received,
                                    "positive": f.positive, "positive_day": f.positive_day, "updated_at": f.updated_at,
                                    "not_received_reason": f.not_received_reason, "other_reason": f.other_reason}
                                   for f in s.slide_followups]
    elif "research_lab" in (roles or set()):
        # Research Lab sees sample/test metadata needed to link to positive
        # RDT/microscopy results; no facility/slide followups or contact fields.
        pass
    return data

def _research_restricted_diagnosis(db: Session, patient_id: str):
    """Specifically approved diagnosis/prescription-like info for eligible cases."""
    # Pull latest clinical assessment and any linked cases without serialising
    # the full model. Only non-sensitive, case-relevant fields.
    from sqlalchemy import select
    from .models import ClinicalAssessment, Case
    rows = db.scalars(select(ClinicalAssessment).where(ClinicalAssessment.patient_id == patient_id)
                      .order_by(ClinicalAssessment.encounter_at.desc()).limit(5)).all()
    assessments = []
    for a in rows:
        assessments.append({
            "id": a.id,
            "encounter_at": a.encounter_at,
            "admission_status": a.admission_status,
            "admission_species": a.admission_species,
            "outcome": a.outcome,
            "treatment_given": a.treatment_given,
            "follow_up_assigned": a.follow_up_assigned,
            # treatment_documentation is the existing documented plan field;
            # exposed only if present and is the approved "prescription info"
            # placeholder until a structured Prescription model is added.
            "treatment_documentation": a.treatment_documentation,
        })
    cases = db.scalars(select(Case).where(Case.patient_id == patient_id).order_by(Case.created_at.desc()).limit(5)).all()
    case_items = [{"id": c.id, "case_code": c.case_code, "status": c.status, "urgent": c.urgent} for c in cases]
    return {"assessments": assessments, "cases": case_items}

def resolve_patient(db: Session, identifier: str) -> Patient | None:
    if not identifier: return None
    clean = str(identifier).strip()
    if patient := db.get(Patient, clean): return patient
    if patient := db.scalar(select(Patient).where(or_(func.upper(Patient.patient_code) == clean.upper(), Patient.id == clean))): return patient
    user = db.get(User, clean)
    if user and user.patient_id:
        return db.get(Patient, user.patient_id)
    return None

def require_patient_scope(user, db, patient_id) -> Patient:
    if patient_id == "me":
        if getattr(user, "patient_id", None):
            patient = db.get(Patient, user.patient_id)
        else:
            roles = effective(user, db)
            if "worker" in roles:
                patient = db.scalar(select(Patient).where(Patient.phone_e164 == user.phone_e164)) if user.phone_e164 else None
                if not patient:
                    patient_code = "M3-" + secrets.token_hex(4).upper()
                    patient = Patient(
                        patient_code=patient_code,
                        display_name=user.display_name,
                        phone_e164=user.phone_e164,
                        preferred_language=user.preferred_language or "en",
                        consent_status="documented",
                        created_by_user_id=user.id,
                    )
                    db.add(patient)
                    db.flush()
                user.patient_id = patient.id
                db.flush()
            else:
                patient = None
    else:
        patient = resolve_patient(db, patient_id)
    if not patient: raise HTTPException(404, "Patient record not found")
    if not permissions.can_read_patient(db, user, patient, effective(user, db)):
        raise HTTPException(403, "You do not have access to this record")
    return patient

def _reject_foreign_replay(db, user, operation, request_id):
    """A request id already used by ANOTHER principal. Never reveal or return that
    principal's record: audit (admin-visible) and answer with a generic conflict."""
    db.rollback()
    audit(db, user, "idempotency.cross_account_rejected", "request", None,
          {"operation": operation, "client_request_id": request_id}); db.commit()
    raise HTTPException(status_code=409, detail="This request identifier cannot be used. Generate a new one and retry.")

def _die_forbidden_write():
    raise HTTPException(403, "You do not have permission for this action")

def _assert_write_role(user, db, data_kind):
    if not permissions.can_write(data_kind, effective(user, db)):
        _die_forbidden_write()

def _aware(dt: datetime):
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def _assert_not_stale(base_updated_at, current_updated_at):
    """P3 stale-edit detection: reject pre-conditioned updates whose base timestamp
    no longer matches the record; the response carries the current timestamp so the
    client can review and resolve the conflict instead of silently overwriting."""
    if base_updated_at is None:
        return
    base = _aware(base_updated_at); current = _aware(current_updated_at)
    if current > base:
        raise HTTPException(status_code=409, detail={
            "message": "This record changed since you loaded it. Reload to review the newer version before retrying.",
            "current_updated_at": current.isoformat(),
        })

@app.get("/health", tags=["operations"])
@app.get("/api/v1/health", tags=["operations"])
def health():
    """Liveness probe: verifies the API process is alive and responsive.

    Deliberately database-independent (works in every mode). Reports the active
    database mode (postgres | sqlite | none) but never connection strings,
    credentials, or hosts.
    """
    return {"status": "ok", "service": "m3-api", "time": now(),
            "database_mode": DATABASE_MODE,
            "database": "disabled" if DATABASE_MODE == "none" else "enabled",
            "validation_only": DATABASE_MODE == "none"}

@app.get("/ready", tags=["operations"])
@app.get("/api/v1/ready", tags=["operations"])
def readiness(db: Session = Depends(get_db)):
    """Readiness probe: validates database connectivity and transaction capability."""
    if DATABASE_MODE == "none":
        # Intentional 503: readiness means "database ready", and there is
        # deliberately no database in validation-only mode.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DB_DISABLED_DETAIL)
    try:
        db.execute(select(1))
        return {
            "status": "ready",
            "service": "m3-api",
            "database": "connected",
            "time": now(),
        }
    except Exception as e:
        logger.error("Readiness database check failed: %s", str(e))
        raise HTTPException(status_code=503, detail="Database connectivity check failed")

@app.get("/diagnostics", tags=["operations"])
@app.get("/api/v1/diagnostics", tags=["operations"])
def diagnostics(db: Session = Depends(get_db)):
    """Operational diagnostics and self-healing report (Section 4.1/4.4)."""
    if DATABASE_MODE == "none":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=DB_DISABLED_DETAIL)
    db_ready = True
    db_error = None
    try:
        db.execute(select(1))
    except Exception as e:
        db_ready = False
        db_error = str(e)

    current_rev = None
    head_rev = None
    try:
        current_rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:
        current_rev = None

    try:
        from pathlib import Path
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        api_dir = Path(__file__).resolve().parent.parent
        cfg = Config(str(api_dir / "alembic.ini"))
        cfg.set_main_option("script_location", str(api_dir / "alembic"))
        head_rev = ScriptDirectory.from_config(cfg).get_current_head()
    except Exception:
        head_rev = None

    return {
        "status": "healthy" if db_ready else "degraded",
        "api_reachable": True,
        "database_ready": db_ready,
        "database_dialect": db.bind.dialect.name if db.bind else "unknown",
        "database_error": db_error,
        "migration_state": {
            "current_revision": current_rev,
            "head_revision": head_rev,
            "is_up_to_date": bool(current_rev and head_rev and current_rev == head_rev),
        },
        "app_version": "0.1.0",
        "environment": get_settings().environment,
        "timestamp": now(),
    }

@app.post("/api/v1/auth/login", response_model=TokenOut, tags=["authentication"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    generic = HTTPException(status_code=401, detail="Unable to sign in with those credentials")
    try: phone = normalize_phone(body.phone)
    except ValueError: raise generic
    user = db.scalar(select(User).where(User.phone_e164 == phone))
    if not user or not user.active or (user.locked_until and _aware(user.locked_until) > now()) or not verify_pin(body.pin, user.pin_hash):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= get_settings().failed_login_limit:
                user.locked_until = now() + timedelta(minutes=get_settings().lockout_minutes); user.failed_login_count = 0
            audit(db, user, "auth.login_failed", "user", user.id); db.commit()
        raise generic
    user.failed_login_count = 0; user.locked_until = None; user.last_login_at = now()
    token, expires = create_token(user, db); audit(db, user, "auth.login", "user", user.id); db.commit()
    return {"access_token": token, "expires_at": expires, "user": user_view(user, db)}

@app.post("/api/v1/auth/signup", response_model=TokenOut, status_code=201, tags=["authentication"])
def signup(body: SignupIn, db: Session = Depends(get_db)):
    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=422, detail="Mobile number format is invalid")

    existing_user = db.scalar(select(User).where(User.phone_e164 == phone))
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this phone number already exists")

    user = User(
        phone_e164=phone,
        display_name=body.display_name.strip(),
        pin_hash=hash_pin(body.pin),
        preferred_language=body.preferred_language,
        active=True
    )
    db.add(user)
    db.flush()

    role = body.role
    db.add(RoleAssignment(user_id=user.id, role=role))

    if role == "worker":
        patient = db.scalar(select(Patient).where(Patient.phone_e164 == phone))
        if patient and db.scalar(select(User.id).where(User.patient_id == patient.id)):
            # Never share or take over a profile that another account already owns;
            # resolve through an audited reconciliation, not an implicit link.
            raise HTTPException(status_code=409, detail="A worker profile with this mobile already belongs to another account")
        if patient:
            audit(db, user, "worker.profile_linked_on_signup", "worker", patient.id,
                  {"matched_on": "phone", "patient_code": patient.patient_code})
        else:
            patient_code = "M3-" + secrets.token_hex(4).upper()
            patient = Patient(
                patient_code=patient_code,
                display_name=body.display_name.strip(),
                phone_e164=phone,
                preferred_language=body.preferred_language,
                consent_status="documented",
                created_by_user_id=user.id,
            )
            db.add(patient)
            db.flush()
        user.patient_id = patient.id

    token, expires = create_token(user, db)
    audit(db, user, "auth.signup", "user", user.id)
    db.commit()

    return {"access_token": token, "expires_at": expires, "user": user_view(user, db)}

@app.post("/api/v1/bootstrap/users", status_code=201, tags=["administration"])
def bootstrap_user(body: ProvisionIn, x_bootstrap_secret: str | None = Header(default=None), db: Session = Depends(get_db)):
    if x_bootstrap_secret != get_settings().bootstrap_secret: raise HTTPException(403, "Bootstrap authorization failed")
    phone = normalize_phone(body.phone)
    if db.scalar(select(User).where(User.phone_e164 == phone)): raise HTTPException(409, "Account already exists")
    user = User(phone_e164=phone, display_name=body.display_name, pin_hash=hash_pin(body.pin), preferred_language=body.preferred_language, technical_provisioner=body.technical_provisioner)
    db.add(user); db.flush()
    for role in body.roles: db.add(RoleAssignment(user_id=user.id, role=role))
    audit(db, user, "account.provisioned", "user", user.id); db.commit()
    return user_view(user, db)

@app.get("/api/v1/me", tags=["authentication"])
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)): return user_view(user, db)

@app.post("/api/v1/auth/logout", tags=["authentication"])
def logout(credentials_session=Depends(current_session), db: Session = Depends(get_db)):
    """Server-side session revocation (P2): the presented token stops working immediately."""
    session, user = credentials_session
    if not session or not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    revoke_session(db, session.id)
    audit(db, user, "auth.logout", "session", session.id); db.commit()
    return {"detail": "Signed out"}

@app.get("/api/v1/facilities", tags=["facilities"])
def facilities(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Facility).order_by(Facility.name)).all()
    return {"items": [{"id": x.id, "code": x.code, "name": x.name, "district": x.district, "facility_type": x.facility_type} for x in rows]}

def _site_view(site: Site, db: Session) -> dict:
    w_count = db.scalar(select(func.count(func.distinct(WorkerSiteAssignment.patient_id))).where(
        WorkerSiteAssignment.site_id == site.id, WorkerSiteAssignment.end_date.is_(None))) or 0
    return {
        "id": site.id,
        "code": site.code,
        "name": site.name,
        "contractor_name": site.contractor_name,
        "contractor_user_id": site.contractor_user_id,
        "district": site.district,
        "area": site.area,
        "status": site.status,
        "worker_count": w_count,
        "created_at": site.created_at,
    }

@app.get("/api/v1/sites", tags=["sites"])
def sites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Site).order_by(Site.name)
    roles = effective(user, db)
    if "contractor" in roles:
        site_ids = permissions.contractor_site_ids(db, user)
        stmt = stmt.where(Site.id.in_(site_ids or ["__none__"]))
    rows = db.scalars(stmt).all()
    return {"items": [_site_view(x, db) for x in rows]}

@app.post("/api/v1/sites", status_code=201, tags=["sites"])
def create_site(body: SiteCreate, response: Response = None,
                user: User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "site")
    # Idempotent replay by client_request_id
    if body.client_request_id:
        existing = db.scalar(select(Site).where(Site.client_request_id == body.client_request_id))
        if existing:
            if existing.contractor_user_id and existing.contractor_user_id != user.id:
                _reject_foreign_replay(db, user, "sites.create", body.client_request_id)
            audit(db, user, "site.replayed_no_duplicate", "site", existing.id)
            db.commit()
            if response is not None: response.status_code = status.HTTP_200_OK
            return {**_site_view(existing, db), "duplicate": True}

    code = (body.code or "").strip().upper()
    if not code:
        code = "SITE-" + secrets.token_hex(4).upper()

    if db.scalar(select(Site).where(Site.code == code)):
        raise HTTPException(409, f"Site code '{code}' already exists")

    contractor_name = (body.contractor_name or "").strip() or user.display_name or "Contractor"
    site = Site(
        code=code,
        name=body.name.strip(),
        contractor_name=contractor_name,
        contractor_user_id=user.id,
        district=body.district.strip(),
        area=body.area.strip(),
        status="active",
        client_request_id=body.client_request_id,
    )
    db.add(site)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        if body.client_request_id:
            winner = db.scalar(select(Site).where(Site.client_request_id == body.client_request_id))
            if winner:
                if winner.contractor_user_id and winner.contractor_user_id != user.id:
                    _reject_foreign_replay(db, user, "sites.create", body.client_request_id)
                audit(db, user, "site.replayed_no_duplicate", "site", winner.id)
                db.commit()
                if response is not None: response.status_code = status.HTTP_200_OK
                return {**_site_view(winner, db), "duplicate": True}
        raise HTTPException(409, "Site creation conflict (code or request ID collision)")
    audit(db, user, "site.created", "site", site.id)
    db.commit()
    return {**_site_view(site, db), "duplicate": False}

@app.get("/api/v1/sites/{site_id}", tags=["sites"])
def get_site(site_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        site = db.scalar(select(Site).where(Site.code == site_id.upper()))
    if not site:
        raise HTTPException(404, "Site not found")
    roles = effective(user, db)
    if "contractor" in roles and site.id not in permissions.contractor_site_ids(db, user):
        raise HTTPException(403, "You do not manage this site")
    elif not (roles & {"admin", "clinician", "pathologist", "research_lab", "contractor"}):
        raise HTTPException(403, "You do not have permission to view this site")
    return _site_view(site, db)

@app.get("/api/v1/sites/{site_id}/workers", tags=["sites"])
def get_site_workers(site_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    site = db.get(Site, site_id)
    if not site:
        site = db.scalar(select(Site).where(Site.code == site_id.upper()))
    if not site:
        raise HTTPException(404, "Site not found")
    roles = effective(user, db)
    if "contractor" in roles and site.id not in permissions.contractor_site_ids(db, user):
        raise HTTPException(403, "You do not manage this site")
    elif not (roles & {"admin", "clinician", "pathologist", "research_lab", "contractor"}):
        raise HTTPException(403, "You do not have permission to view this site's roster")

    stmt = (select(WorkerSiteAssignment, Patient)
            .join(Patient, Patient.id == WorkerSiteAssignment.patient_id)
            .where(WorkerSiteAssignment.site_id == site.id, WorkerSiteAssignment.end_date.is_(None))
            .order_by(WorkerSiteAssignment.start_date.desc(), Patient.patient_code))
    rows = db.execute(stmt).all()
    # Data minimization: operational fields only, strictly zero clinical notes or symptoms
    items = [{
        "id": p.id,
        "patient_code": p.patient_code,
        "display_name": p.display_name,
        "age_years": p.age_years,
        "gender": p.gender,
        "occupation": p.occupation,
        "start_date": a.start_date,
        "reported_malaria_status": a.reported_malaria_status,
        "reported_treatment_status": a.reported_treatment_status,
        "assignment_id": a.id,
    } for a, p in rows]
    audit(db, user, "site.roster_viewed", "site", site.id, detail={"count": len(items)})
    db.commit()
    return {"items": items, "total": len(items), "site_id": site.id, "site_code": site.code, "site_name": site.name}

@app.post("/api/v1/sites/{site_id}/workers", status_code=201, tags=["sites"])
def assign_worker_to_site(site_id: str, body: SiteWorkerAssignIn, response: Response = None,
                          user: User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "membership")
    site = db.get(Site, site_id)
    if not site:
        site = db.scalar(select(Site).where(Site.code == site_id.upper()))
    if not site:
        raise HTTPException(404, "Site not found")
    if site.id not in permissions.contractor_site_ids(db, user):
        raise HTTPException(403, "You do not manage this site")

    # 1. Idempotent retry by client_request_id
    if body.client_request_id:
        existing = db.scalar(select(WorkerSiteAssignment).where(
            WorkerSiteAssignment.client_request_id == body.client_request_id))
        if existing:
            if existing.reported_by_user_id and existing.reported_by_user_id != user.id:
                _reject_foreign_replay(db, user, "site.worker_assign", body.client_request_id)
            p = db.get(Patient, existing.patient_id)
            audit(db, user, "site.worker_assigned_replayed", "worker", p.id if p else None)
            db.commit()
            if response is not None: response.status_code = status.HTTP_200_OK
            return {
                "assigned": True,
                "already_assigned": True,
                "duplicate": True,
                "assignment_id": existing.id,
                "site_id": existing.site_id,
                "worker": {"id": p.id, "patient_code": p.patient_code, "display_name": p.display_name} if p else {},
                "start_date": existing.start_date,
            }

    # 2. Resolve worker via QR token or direct worker identifier
    patient = None
    if body.qr_token:
        clean_token = body.qr_token.strip()
        qr = db.scalar(select(WorkerQrToken).where(
            WorkerQrToken.token == clean_token, WorkerQrToken.active.is_(True)))
        if not qr:
            raise HTTPException(404, "Worker QR code not recognized or has expired")
        patient = db.get(Patient, qr.patient_id)
    elif body.worker_id:
        patient = resolve_patient(db, body.worker_id)
    else:
        raise HTTPException(422, "Either qr_token or worker_id must be provided")

    if not patient:
        raise HTTPException(404, "Worker record not found")

    # 3. Check active assignment
    active = db.scalar(select(WorkerSiteAssignment).where(
        WorkerSiteAssignment.patient_id == patient.id,
        WorkerSiteAssignment.end_date.is_(None)))

    if active and active.site_id == site.id:
        audit(db, user, "site.worker_already_assigned", "worker", patient.id, detail={"site_id": site.id})
        db.commit()
        if response is not None: response.status_code = status.HTTP_200_OK
        return {
            "assigned": True,
            "already_assigned": True,
            "duplicate": False,
            "assignment_id": active.id,
            "site_id": site.id,
            "worker": {"id": patient.id, "patient_code": patient.patient_code, "display_name": patient.display_name},
            "start_date": active.start_date,
        }

    if active and active.site_id != site.id:
        other_site = db.get(Site, active.site_id)
        other_code = other_site.code if other_site else "UNKNOWN"
        other_name = other_site.name if other_site else "Another Site"
        if not body.confirm_transfer:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": f"Worker is currently assigned to another site ({other_code}: {other_name})",
                    "current_site_id": active.site_id,
                    "current_site_code": other_code,
                    "current_site_name": other_name,
                    "requires_transfer_confirmation": True,
                },
            )
        active.end_date = now().date().isoformat()
        audit(db, user, "site.worker_transferred", "worker", patient.id,
              detail={"from_site": active.site_id, "to_site": site.id})

    # 4. Create new assignment
    assignment = WorkerSiteAssignment(
        patient_id=patient.id,
        site_id=site.id,
        start_date=now().date().isoformat(),
        reported_by_user_id=user.id,
        client_request_id=body.client_request_id,
    )
    db.add(assignment)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        winner = db.scalar(select(WorkerSiteAssignment).where(
            WorkerSiteAssignment.patient_id == patient.id,
            WorkerSiteAssignment.end_date.is_(None)))
        if winner and winner.site_id == site.id:
            if response is not None: response.status_code = status.HTTP_200_OK
            return {
                "assigned": True,
                "already_assigned": True,
                "duplicate": True,
                "assignment_id": winner.id,
                "site_id": site.id,
                "worker": {"id": patient.id, "patient_code": patient.patient_code, "display_name": patient.display_name},
                "start_date": winner.start_date,
            }
        raise HTTPException(409, "Concurrent assignment conflict: worker was assigned to another site")

    audit(db, user, "site.worker_assigned", "site", site.id,
          detail={"worker_id": patient.id, "patient_code": patient.patient_code, "assignment_id": assignment.id})
    db.commit()
    return {
        "assigned": True,
        "already_assigned": False,
        "duplicate": False,
        "assignment_id": assignment.id,
        "site_id": site.id,
        "worker": {"id": patient.id, "patient_code": patient.patient_code, "display_name": patient.display_name},
        "start_date": assignment.start_date,
    }

@app.get("/api/v1/workers", tags=["workers"])
def workers(q: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = effective(user, db)
    stmt = select(Patient)
    own = False
    if "worker" in roles and "clinician" not in roles and "pathologist" not in roles:
        stmt = stmt.where(Patient.id == user.patient_id if user.patient_id else sa_false()); own = True
    elif "contractor" in roles and "clinician" not in roles and "pathologist" not in roles:
        visible = permissions.worker_ids_at_sites(db, permissions.contractor_site_ids(db, user))
        stmt = stmt.where(Patient.id.in_(visible or ["__none__"]))
    elif "health_worker" in roles and "clinician" not in roles and "pathologist" not in roles and "admin" not in roles:
        visible = permissions.assigned_followup_patient_ids(db, user)
        stmt = stmt.where(Patient.id.in_(visible or ["__none__"]))
    elif "research_lab" in roles and "clinician" not in roles and "pathologist" not in roles and "admin" not in roles:
        eligible = permissions.eligible_research_sample_ids(db)
        # Join via samples to find patients with eligible positive samples
        from .models import Sample
        if eligible:
            stmt = stmt.join(Sample, Sample.patient_id == Patient.id).where(Sample.id.in_(eligible)).distinct()
        else:
            stmt = stmt.where(sa_false())
    elif not (roles & {"clinician", "pathologist", "admin", "research_lab", "health_worker", "contractor", "worker"}):
        raise HTTPException(403, "You do not have permission for this action")
    if q:
        like = f"%{q}%"
        cond = [Patient.patient_code.ilike(like)]
        if roles & {"clinician", "pathologist", "health_worker", "admin", "research_lab"}:
            cond.append(Patient.display_name.ilike(like))
            # Health workers search by name, home state and phone without codes.
            if "research_lab" not in roles or ("clinician" in roles or "admin" in roles):
                cond.append(Patient.nativity.ilike(like))
        if roles & {"clinician", "pathologist", "contractor", "health_worker"}:
            cond.append(Patient.phone_e164.like(f"%{q.strip().lstrip('+')}%"))
        stmt = stmt.where(or_(*cond))
    stmt = stmt.order_by(Patient.updated_at.desc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.offset(offset).limit(limit)).all()
    audit(db, user, "worker.list_viewed", "worker", detail={"query": bool(q)}); db.commit()
    return page([patient_view(x, roles, own=own or (user.patient_id == x.id)) for x in rows], total, offset, limit)

def sa_false():
    from sqlalchemy import false
    return false()

def _owns_patient_replay(user, patient) -> bool:
    return patient.created_by_user_id == user.id or user.patient_id == patient.id

@app.post("/api/v1/workers", status_code=201, tags=["workers"])
def create_worker(body: WorkerCreate, response: Response = None, user: User = Depends(require_roles("worker", "contractor")), db: Session = Depends(get_db)):
    roles = effective(user, db)
    data_kind = "questionnaire" if "worker" in roles else "membership"
    _assert_write_role(user, db, data_kind)
    if "worker" in roles and not permissions.can_write("questionnaire", roles): _die_forbidden_write()
    # Offline replay reconciliation (P0): a repeat of a queued registration
    # attempt resolves to the initially created profile instead of creating a
    # second one. The identity is the offline request id itself (global, backed
    # by the partial unique index uq_patients_client_request_id), not a
    # (request id, creator) pair: an attempt belongs to a worker, not to the
    # account that happened to flush the outbox.
    if body.client_request_id:
        replay = db.scalar(select(Patient).where(
            Patient.client_request_id == body.client_request_id))
        if replay and not _owns_patient_replay(user, replay):
            _reject_foreign_replay(db, user, "workers.create", body.client_request_id)
        if replay:
            audit(db, user, "worker.replayed_no_duplicate", "worker", replay.id); db.commit()
            if response is not None: response.status_code = status.HTTP_200_OK
            return {**patient_view(replay, roles, own=("worker" in roles)), "duplicate": True}
    # Stable worker identity: an account that already owns a profile never gets a
    # second one and users.patient_id is never re-pointed (that silently detached
    # every historical case). Resolve to the existing profile; submitted profile
    # data is intentionally NOT applied (use PATCH /workers/me for contact details).
    if "worker" in roles and user.patient_id:
        existing = db.get(Patient, user.patient_id)
        if existing:
            audit(db, user, "worker.reregistration_blocked", "worker", existing.id,
                  {"client_request_id": body.client_request_id}); db.commit()
            if response is not None: response.status_code = status.HTTP_200_OK
            return {**patient_view(existing, roles, own=True), "duplicate": True, "already_registered": True}
    site = db.get(Site, body.site_id) if body.site_id else None
    if body.site_id and not site: raise HTTPException(422, "Unknown site")
    if site and "contractor" in roles:
        if site.id not in permissions.contractor_site_ids(db, user):
            raise HTTPException(403, "You do not manage this site")
    raw_phone = getattr(body, "phone", None) or getattr(body, "mobile", None)
    if raw_phone:
        try: existing_phone = normalize_phone(raw_phone)
        except ValueError: raise HTTPException(422, "Mobile number format is invalid")
        # Single-screening rule: an active profile with the same phone exists.
        duplicates = db.scalars(select(Patient).where(Patient.phone_e164 == existing_phone)).all()
        if duplicates:
            if any(d.screening_completed for d in duplicates):
                raise HTTPException(status_code=409, detail="A worker with this mobile number has already completed screening",
                    headers={"X-Duplicate-Candidates": ",".join(d.patient_code for d in duplicates[:10])})
            raise HTTPException(status_code=409, detail="A worker profile with this mobile already exists",
                headers={"X-Duplicate-Candidates": ",".join(d.patient_code for d in duplicates[:10])})
    dob = date.fromisoformat(body.dob) if body.dob else None
    if dob is not None:
        # Same runtime-side DOB range as the questionnaire (questionnaire.py):
        # today..today-90 calendar years, computed at request time.
        from .questionnaire import dob_boundaries
        min_dob, max_dob = dob_boundaries()
        if not (min_dob <= body.dob <= max_dob):
            raise HTTPException(422, "Date of birth must fall between "
                                f"{min_dob} (90 years ago) and {max_dob} (today)")
    derived_age = body.age_years
    age_flagged = False
    if dob:
        today = date.today()
        calc_age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if body.age_years is not None and body.age_years != calc_age:
            age_flagged = True
        derived_age = calc_age
    patient = Patient(patient_code="M3-" + secrets.token_hex(4).upper(), display_name=body.display_name, dob=dob,
                      age_as_on=date.today() if body.dob else None,
                      age_years=derived_age, age_flagged=age_flagged,
                      gender=body.gender, phone_e164=normalize_phone(raw_phone) if raw_phone else None,
                      alternate_contact=body.alternate_contact, id_type=body.id_type, id_other_details=body.id_other_details,
                      address_present=body.address_present, address_permanent=body.address_permanent,
                      preferred_language=body.preferred_language, occupation=body.occupation, nativity=body.nativity,
                      consent_status=body.consent_status, initial_symptoms=body.initial_symptoms,
                      client_request_id=body.client_request_id, created_by_user_id=user.id)
    db.add(patient)
    try:
        db.flush()
    except IntegrityError:
        # Concurrent duplicate of the same request id lost the race to the unique index.
        db.rollback()
        winner = db.scalar(select(Patient).where(Patient.client_request_id == body.client_request_id)) if body.client_request_id else None
        if winner is None:
            raise
        if not _owns_patient_replay(user, winner):
            _reject_foreign_replay(db, user, "workers.create", body.client_request_id)
        audit(db, user, "worker.replayed_no_duplicate", "worker", winner.id); db.commit()
        if response is not None: response.status_code = status.HTTP_200_OK
        return {**patient_view(winner, roles, own=("worker" in roles)), "duplicate": True}
    if site:
        db.add(WorkerSiteAssignment(patient_id=patient.id, site_id=site.id, start_date=now().date().isoformat()))
    if body.travel_origin:
        db.add(TravelEvent(patient_id=patient.id, origin=body.travel_origin, arrival_date=body.travel_arrival_date))
    if "worker" in roles: user.patient_id = patient.id
    audit(db, user, "worker.created", "worker", patient.id); db.commit()
    kafka_producer.emit_event("intake.created", {
        "patient_id": patient.id, "patient_code": patient.patient_code,
        "site_id": site.id if site else None, "created_by": user.id,
    })
    return patient_view(patient, roles, own=("worker" in roles))

class WorkerSelfUpdate(BaseModel):
    mobile: str | None = Field(default=None, max_length=24)
    alternate_contact: str | None = Field(default=None, max_length=120)
    address_present: str | None = Field(default=None, max_length=400)
    address_permanent: str | None = Field(default=None, max_length=400)
    base_updated_at: datetime | None = None

@app.get("/api/v1/workers/me", tags=["workers"])
def get_own_worker(user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    patient = _own_patient(user, db)
    return patient_view(patient, effective(user, db), own=True)

@app.patch("/api/v1/workers/me", tags=["workers"])
def update_own_worker(body: WorkerSelfUpdate, user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    """Worker updates own contact details; the stable Worker ID never changes (PRD DATA-001)."""
    _assert_write_role(user, db, "questionnaire")
    patient = _own_patient(user, db)
    _assert_not_stale(body.base_updated_at, patient.updated_at)
    if body.mobile:
        phone = normalize_phone(body.mobile)
        clash = db.scalar(select(Patient).where(Patient.phone_e164 == phone, Patient.id != patient.id))
        if clash: raise HTTPException(409, "Another worker profile already uses this mobile")
        patient.phone_e164 = phone
    if body.alternate_contact is not None: patient.alternate_contact = body.alternate_contact
    if body.address_present is not None: patient.address_present = body.address_present
    if body.address_permanent is not None: patient.address_permanent = body.address_permanent
    audit(db, user, "worker.self_updated", "worker", patient.id); db.commit()
    return patient_view(patient, effective(user, db), own=True)

@app.get("/api/v1/workers/{patient_id}", tags=["workers"])
def worker_detail(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, patient_id)
    roles = effective(user, db); own = user.patient_id == patient.id
    audit(db, user, "worker.viewed", "worker", patient.id); db.commit()
    result = patient_view(patient, roles, own=own)
    if "admin" in roles and "clinician" not in roles and "pathologist" not in roles:
        result = {k: result[k] for k in ("id", "patient_code", "age_years", "gender", "consent_status", "updated_at")}
    elif "research_lab" in roles and "clinician" not in roles and "pathologist" not in roles:
        # Enforce eligibility again (defense in depth)
        if not permissions.patient_is_research_eligible(db, patient.id):
            raise HTTPException(403, "You do not have access to this record")
        # Strip any accidental contact/other identifiers
        for f in ("phone_e164", "alternate_contact", "id_type", "id_other_details", "address_present", "address_permanent",
                  "dob", "age_as_on", "age_flagged", "preferred_language", "initial_symptoms", "occupation", "nativity"):
            result.pop(f, None)
        result["research"] = _research_restricted_diagnosis(db, patient.id)
        return result
    else:
        reporter_scope = own or bool(roles & {"contractor", "clinician", "pathologist"})
        result["site_assignments"] = [
            {"site_id": a.site_id, "site_name": a.site.name, "start_date": a.start_date, "end_date": a.end_date,
             "reported_malaria_status": a.reported_malaria_status if reporter_scope else None,
             "reported_treatment_status": a.reported_treatment_status if reporter_scope else None}
            for a in patient.assignments]
    if roles & {"clinician", "pathologist", "contractor", "health_worker"} or own:
        result["travel_history"] = [{"origin": t.origin, "destination": t.destination, "arrival_date": t.arrival_date,
                                     "departure_date": t.departure_date, "return_date": t.return_date, "planned": t.planned}
                                    for t in patient.travels]
    return result

@app.get("/api/v1/workers/{patient_id}/qr-token", tags=["sharing"])
def get_qr_token(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, patient_id)
    roles = effective(user, db)
    if "worker" in roles and user.patient_id != patient.id:
        _die_forbidden_write()
    qr = db.scalar(select(WorkerQrToken).where(
        WorkerQrToken.patient_id == patient.id,
        WorkerQrToken.active.is_(True)
    ).order_by(WorkerQrToken.created_at.desc()))
    if not qr:
        _assert_write_role(user, db, "qr")
        token = secrets.token_urlsafe(24)
        qr = WorkerQrToken(token=token, patient_id=patient.id, created_by_user_id=user.id)
        db.add(qr)
        audit(db, user, "worker.qr_token_issued", "worker", patient.id)
        db.commit()
    return {
        "token": qr.token,
        "payload": {"v": 1, "token": qr.token, "type": "m3_worker_qr"},
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
        "created_at": qr.created_at.isoformat() if qr.created_at else None,
    }

@app.post("/api/v1/workers/{patient_id}/qr-token", status_code=201, tags=["sharing"])
def create_qr_token(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "qr")
    patient = require_patient_scope(user, db, patient_id)
    roles = effective(user, db)
    if "worker" in roles and user.patient_id != patient.id: _die_forbidden_write()
    db.execute(update_tokens(db, patient.id))
    token = secrets.token_urlsafe(24)
    qr = WorkerQrToken(token=token, patient_id=patient.id, created_by_user_id=user.id)
    db.add(qr)
    audit(db, user, "worker.qr_token_issued", "worker", patient.id); db.commit()
    return {
        "token": token,
        "payload": {"v": 1, "token": token, "type": "m3_worker_qr"},
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
    }

def update_tokens(db, patient_id):
    from sqlalchemy import update
    return update(WorkerQrToken).where(WorkerQrToken.patient_id == patient_id).values(active=False)

@app.post("/api/v1/workers/resolve-qr", tags=["sharing"])
def resolve_qr_post(body: dict, user: User = Depends(require_roles("contractor", "clinician", "admin")), db: Session = Depends(get_db)):
    token = (body or {}).get("qr_token") or (body or {}).get("token")
    if not token: raise HTTPException(422, "qr_token is required")
    return resolve_qr(str(token), user=user, db=db)

@app.get("/api/v1/qr/{token}", tags=["sharing"])
def resolve_qr(token: str, user: User = Depends(require_roles("contractor", "clinician", "admin")), db: Session = Depends(get_db)):
    qr = db.scalar(select(WorkerQrToken).where(WorkerQrToken.token == token, WorkerQrToken.active.is_(True)))
    if not qr: raise HTTPException(404, "QR code not recognized or has expired")
    patient = db.get(Patient, qr.patient_id)
    if not patient:
        raise HTTPException(404, "Worker record not found")
    audit(db, user, "worker.qr_resolved", "worker", patient.id); db.commit()
    return {"patient_id": patient.id, "patient_code": patient.patient_code, "display_name": patient.display_name}

@app.post("/api/v1/workers/{patient_id}/membership", status_code=201, tags=["contractor"])
def create_membership(patient_id: str, body: MembershipCreate, user: User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "membership")
    patient = resolve_patient(db, patient_id)
    if not patient: raise HTTPException(404, "Patient record not found")
    site = db.get(Site, body.site_id)
    if not site or site.id not in permissions.contractor_site_ids(db, user):
        raise HTTPException(403, "You do not manage this site")
    if db.scalar(select(WorkerSiteAssignment).where(WorkerSiteAssignment.patient_id == patient.id,
                                                    WorkerSiteAssignment.site_id == site.id,
                                                    WorkerSiteAssignment.end_date.is_(None))):
        raise HTTPException(409, "Worker is already an active member of this site")
    assignment = WorkerSiteAssignment(patient_id=patient.id, site_id=site.id, start_date=now().date().isoformat())
    db.add(assignment)
    audit(db, user, "membership.created", "membership", assignment.id, detail={"worker": patient.patient_code, "site": site.code}); db.commit()
    return {"id": assignment.id, "patient_id": patient.id, "site_id": site.id, "start_date": assignment.start_date}

@app.put("/api/v1/workers/{patient_id}/reported-status", tags=["contractor"])
def set_reported_status(patient_id: str, body: ReportedStatusIn, user: User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "contractor_status")
    patient = require_patient_scope(user, db, patient_id)
    site_ids = permissions.contractor_site_ids(db, user)
    assignment = db.scalar(select(WorkerSiteAssignment).where(
        WorkerSiteAssignment.patient_id == patient.id,
        WorkerSiteAssignment.site_id.in_(site_ids or ["__none__"]),
        WorkerSiteAssignment.end_date.is_(None)).order_by(WorkerSiteAssignment.updated_at.desc()))
    if not assignment: raise HTTPException(404, "No active site membership at an authorized site")
    _assert_not_stale(body.base_updated_at, assignment.updated_at)
    assignment.reported_malaria_status = body.malaria_status
    assignment.reported_treatment_status = body.treatment_status
    assignment.reported_at = now(); assignment.reported_by_user_id = user.id
    audit(db, user, "contractor_status.recorded", "worker", patient.id, detail={"site": assignment.site_id}); db.commit()
    return {"reported_malaria_status": assignment.reported_malaria_status, "reported_treatment_status": assignment.reported_treatment_status,
            "reported_at": assignment.reported_at}

@app.post("/api/v1/workers/{patient_id}/travel", status_code=201, tags=["travel"])
def add_travel(patient_id: str, body: TravelEpisodeCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = effective(user, db)
    self_write = "worker" in roles and not roles & {"clinician", "contractor"}
    if self_write:
        if not permissions.can_write("questionnaire", roles): _die_forbidden_write()
    elif not permissions.can_write("travel", roles):
        _die_forbidden_write()
    patient = resolve_patient(db, patient_id)
    if not patient: raise HTTPException(404, "Patient record not found")
    if self_write:
        if user.patient_id != patient.id: _die_forbidden_write()
    else:
        require_patient_scope(user, db, patient_id)
    # Planned travel looks forward and describes a concrete trip: the client
    # workflow (sites.tsx travel modal) requires both the departure date and
    # the destination, so the server mirrors that requiredness. Historical
    # episodes (planned=False, e.g. arrival into Goa) stay unrestricted.
    if body.planned:
        if not body.departure_date:
            raise HTTPException(422, "Departure date is required for planned travel")
        if not str(body.destination or "").strip():
            raise HTTPException(422, "Destination is required for planned travel")
        from .questionnaire import today_iso
        if body.departure_date < today_iso():
            raise HTTPException(422, "Planned departure date cannot be in the past")
    if body.departure_date and body.return_date and body.return_date < body.departure_date:
        raise HTTPException(422, "Return date cannot precede departure date")
    event = TravelEvent(patient_id=patient.id, origin=body.origin, destination=body.destination,
                        arrival_date=body.arrival_date, departure_date=body.departure_date, return_date=body.return_date,
                        planned=body.planned)
    db.add(event)
    audit(db, user, "travel.recorded", "travel", event.id); db.commit()
    return {"id": event.id}

# ---------------- Questionnaire ----------------

def _own_patient(user, db) -> Patient:
    if not user.patient_id:
        raise HTTPException(409, "This account does not have a worker profile yet")
    patient = db.get(Patient, user.patient_id)
    if not patient: raise HTTPException(404, "Patient record not found")
    return patient

@app.get("/api/v1/questionnaires/draft", tags=["screening"])
def get_draft(user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    patient = _own_patient(user, db)
    draft = db.scalar(select(QuestionnaireSubmission).where(
        QuestionnaireSubmission.patient_id == patient.id,
        QuestionnaireSubmission.state == "draft",
        QuestionnaireSubmission.schema_version == questionnaire_schema.SCHEMA_VERSION))
    return {"submission_id": draft.id if draft else None, "schema_version": questionnaire_schema.SCHEMA_VERSION,
            "data": draft.data if draft else {}, "updated_at": draft.updated_at if draft else None}

@app.put("/api/v1/questionnaires/draft", tags=["screening"])
def save_draft(body: QuestionnaireSave, user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    patient = _own_patient(user, db)
    if not isinstance(body.data, dict): raise HTTPException(422, "Draft data must be an object")
    unknown = set(body.data) - set(questionnaire_schema.SECTIONS)
    if unknown: raise HTTPException(422, f"Unknown questionnaire sections: {', '.join(sorted(unknown))}")
    draft = db.scalar(select(QuestionnaireSubmission).where(
        QuestionnaireSubmission.patient_id == patient.id,
        QuestionnaireSubmission.state == "draft",
        QuestionnaireSubmission.schema_version == questionnaire_schema.SCHEMA_VERSION))
    if draft:
        draft.data = body.data
    else:
        draft = QuestionnaireSubmission(patient_id=patient.id, schema_version=questionnaire_schema.SCHEMA_VERSION, state="draft", data=body.data, respondent_user_id=user.id)
        db.add(draft)
    audit(db, user, "questionnaire.draft_saved", "questionnaire", draft.id); db.commit()
    return {"submission_id": draft.id, "schema_version": draft.schema_version, "updated_at": draft.updated_at}

@app.post("/api/v1/questionnaires/submit", status_code=201, tags=["screening"])
def submit_questionnaire(body: QuestionnaireSubmitIn, response: Response, user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    patient = _own_patient(user, db)
    existing = db.scalar(select(QuestionnaireSubmission).where(QuestionnaireSubmission.client_request_id == body.client_request_id))
    if existing and existing.patient_id != patient.id:
        _reject_foreign_replay(db, user, "questionnaires.submit", body.client_request_id)
    if existing:
        audit(db, user, "questionnaire.duplicate_submit_rejected", "questionnaire", existing.id); db.commit()
        response.status_code = status.HTTP_200_OK
        return {"submission_id": existing.id, "duplicate": True, "schema_version": existing.schema_version,
                "submitted_at": existing.submitted_at}
    errors = questionnaire_schema.validate(body.data)
    if errors: raise HTTPException(status_code=422, detail={"message": "Validation failed", "errors": errors})
    submission = QuestionnaireSubmission(patient_id=patient.id, schema_version=questionnaire_schema.SCHEMA_VERSION,
                                         state="submitted", data=body.data,
                                         client_request_id=body.client_request_id, submitted_at=now(),
                                         respondent_user_id=user.id)
    db.add(submission)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        winner = db.scalar(select(QuestionnaireSubmission).where(QuestionnaireSubmission.client_request_id == body.client_request_id))
        if winner is None:
            raise
        if winner.patient_id != patient.id:
            _reject_foreign_replay(db, user, "questionnaires.submit", body.client_request_id)
        audit(db, user, "questionnaire.duplicate_submit_rejected", "questionnaire", winner.id); db.commit()
        response.status_code = status.HTTP_200_OK
        return {"submission_id": winner.id, "duplicate": True, "schema_version": winner.schema_version,
                "submitted_at": winner.submitted_at}
    draft = db.scalar(select(QuestionnaireSubmission).where(
        QuestionnaireSubmission.patient_id == patient.id,
        QuestionnaireSubmission.state == "draft",
        QuestionnaireSubmission.schema_version == questionnaire_schema.SCHEMA_VERSION))
    if draft: db.delete(draft)
    # Single-screening rule: submitting the worker intake questionnaire IS the
    # worker's one routine screening event; state is stamped once, here.
    if not patient.screening_completed:
        patient.screening_completed = True
        patient.screened_at = now()
    audit(db, user, "questionnaire.submitted", "questionnaire", submission.id)
    kafka_producer.emit_event("screening.completed", {
        "patient_id": patient.id, "submission_id": submission.id, "respondent_user_id": user.id,
    })
    db.commit()
    return {"submission_id": submission.id, "duplicate": False, "schema_version": submission.schema_version, "submitted_at": submission.submitted_at}

@app.post("/api/v1/questionnaires/{submission_id}/amend", status_code=201, tags=["screening"])
def amend_questionnaire(submission_id: str, body: QuestionnaireSave, user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    patient = _own_patient(user, db)
    original = db.get(QuestionnaireSubmission, submission_id)
    if not original or original.patient_id != patient.id or original.state == "draft":
        raise HTTPException(404, "Submitted questionnaire not found")
    unknown = set(body.data) - set(questionnaire_schema.SECTIONS)
    if unknown: raise HTTPException(422, f"Unknown questionnaire sections: {', '.join(sorted(unknown))}")
    amendment = QuestionnaireSubmission(patient_id=patient.id, schema_version=questionnaire_schema.SCHEMA_VERSION,
                                        state="amended", data=body.data, submitted_at=now(), respondent_user_id=user.id)
    db.add(amendment)
    audit(db, user, "questionnaire.amended", "questionnaire", amendment.id, detail={"original": original.id}); db.commit()
    return {"submission_id": amendment.id, "state": amendment.state}

@app.get("/api/v1/questionnaires", tags=["screening"])
def list_questionnaires(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, patient_id)
    roles = effective(user, db)
    is_self = user.patient_id == patient.id
    can_see_content = is_self or bool(roles & {"clinician", "pathologist"})
    stmt = select(QuestionnaireSubmission).where(QuestionnaireSubmission.patient_id == patient.id)
    if not is_self:
        stmt = stmt.where(QuestionnaireSubmission.state != "draft")  # drafts remain private to the respondent
    rows = db.scalars(stmt.order_by(QuestionnaireSubmission.created_at.desc()).limit(50)).all()
    items = []
    for row in rows:
        item = {"id": row.id, "state": row.state, "schema_version": row.schema_version,
                "created_at": row.created_at, "submitted_at": row.submitted_at}
        if not ({"admin", "research_lab", "contractor", "health_worker"} & roles and not can_see_content):
            item["data"] = row.data
        items.append(item)
    audit(db, user, "questionnaire.listed", "questionnaire", patient.id); db.commit()
    return {"items": items}

# ---------------- Clinical ----------------

def _treatment_incomplete(completed_code: str | None) -> bool:
    """True for every source-questionnaire code meaning the course was not
    fully completed during admission (No - still on treatment, No - stopped
    early, legacy plain `no`)."""
    return completed_code in ("no", "no_still_on_treatment", "no_stopped_early")


@app.get("/api/v1/assessments", tags=["clinical"])
def assessments(patient_id: str, user: User = Depends(require_roles("clinician", "admin")), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, patient_id)
    roles = effective(user, db)
    rows = db.scalars(select(ClinicalAssessment).where(ClinicalAssessment.patient_id == patient.id).order_by(ClinicalAssessment.encounter_at.desc())).all()
    items = []
    for x in rows:
        item = {"id": x.id, "encounter_at": x.encounter_at, "temperature_c": x.temperature_c,
                "fever_duration_category": x.fever_duration_category, "onset_date": x.onset_date,
                "general_condition": x.general_condition, "admission_status": x.admission_status}
        if "clinician" in roles or "pathologist" in roles:
            item.update(medical_officer_name=x.medical_officer_name, fever_duration_days=x.fever_duration_days,
                        symptoms=x.symptoms, red_flags=x.red_flags, comorbidities_list=x.comorbidities_list,
                        comorbidities=x.comorbidities, systolic_bp=x.systolic_bp, diastolic_bp=x.diastolic_bp,
                        can_attend_testing=x.can_attend_testing, notes=x.notes, treatment_documentation=x.treatment_documentation,
                        admission_species=x.admission_species, admission_symptoms=x.admission_symptoms,
                        admission_species_other_note=x.admission_species_other_note,
                        symptoms_other_note=x.symptoms_other_note,
                        admission_severity=x.admission_severity, treatment_completed=x.treatment_completed,
                        treatment_incomplete_reason=x.treatment_incomplete_reason, discharge_date=x.discharge_date,
                        outcome=x.outcome, remarks=x.remarks,
                        treatment_given=x.treatment_given, follow_up_assigned=x.follow_up_assigned)
        items.append(item)
    audit(db, user, "assessment.list_viewed", "worker", patient.id); db.commit()
    return {"items": items}

@app.post("/api/v1/assessments", status_code=201, tags=["clinical"])
def create_assessment(body: AssessmentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Clinical encounter record.

    Screening governance (SCR-009): the first routine screening is a one-time
    event. A NEW encounter on an already-screened worker is an authorized
    RE-SCREEN, permitted only for the `clinician` and `health_worker` roles and
    only with a recorded reason. Everyone else is rejected with 403. The reason
    is stored on the assessment row and journaled in the audit log."""
    # Patient identity resolution: accept the patient_code used by the UI as
    # well as the UUID (same resolution contract as /travel and /samples).
    patient = resolve_patient(db, body.patient_id)
    roles = effective(user, db)
    if patient is None:
        # Preserve the original role matrix: non-clinicians get 403 on this
        # write path even when the patient id is unknown.
        if "clinician" not in roles:
            _die_forbidden_write()
        raise HTTPException(404, "Patient record not found")
    is_rescreen = bool(patient.screening_completed)
    if "clinician" in roles:
        _assert_write_role(user, db, "clinical")
    elif "health_worker" in roles:
        # Health workers may record encounters only as authorized re-screens.
        if not is_rescreen:
            _die_forbidden_write()
    else:
        _die_forbidden_write()
    patient = require_patient_scope(user, db, body.patient_id)
    if is_rescreen:
        reason = (body.re_screening_reason or "").strip()
        if not reason:
            raise HTTPException(422, "A re-screening reason is required because this worker has already completed screening")
        if _treatment_incomplete(body.treatment_completed) and not str(body.treatment_incomplete_reason or "").strip():
            raise HTTPException(422, "Reason is required when treatment was not completed")
        if body.admission_status and body.admission_status.lower() == "admitted" and not body.admission_severity:
            raise HTTPException(422, "Severity is required when the worker is admitted")
        if body.facility_id and not db.get(Facility, body.facility_id):
            raise HTTPException(422, "Unknown facility reference")
    else:
        if body.facility_id and not db.get(Facility, body.facility_id):
            raise HTTPException(422, "Unknown facility reference")
        if _treatment_incomplete(body.treatment_completed) and not str(body.treatment_incomplete_reason or "").strip():
            raise HTTPException(422, "Reason is required when treatment was not completed")
        if body.admission_status and body.admission_status.lower() == "admitted" and not body.admission_severity:
            raise HTTPException(422, "Severity is required when the worker is admitted")
    payload = body.model_dump(exclude={"re_screening_reason"})
    payload["re_screening_reason"] = body.re_screening_reason
    case_id = payload.pop("case_id", None)
    payload["patient_id"] = patient.id
    assessment = ClinicalAssessment(**payload, clinician_id=user.id)
    if case_id:
        case = db.get(Case, case_id)
        if not case:
            raise HTTPException(422, "Unknown case reference")
        if case.patient_id != patient.id:
            raise HTTPException(409, "Case does not belong to this worker")
        assessment.case_id = case.id
        if case.status in ("assigned", "in_assessment") and case_transition_allowed(case.status, "plan_recorded"):
            from_status = case.status
            case.status = "plan_recorded"
            _record_case_event(db, user.id, case, from_status, "plan_recorded",
                               "Clinical assessment and disposition recorded")
    db.add(assessment)
    # The encounter completes the (re-)screening event; the worker's screening
    # state is stamped the first time any authorized encounter is recorded.
    if not patient.screening_completed:
        patient.screening_completed = True
        patient.screened_at = now()
    if is_rescreen:
        audit(db, user, "assessment.rescreened", "assessment", assessment.id,
              detail={"patient_id": patient.id, "reason": body.re_screening_reason})
        kafka_producer.emit_event("screening.rescreened", {
            "patient_id": patient.id, "case_id": case_id, "by_user_id": user.id,
            "reason_re_screening": body.re_screening_reason,
        })
    else:
        audit(db, user, "assessment.created", "assessment", assessment.id)
        kafka_producer.emit_event("screening.completed", {
            "patient_id": patient.id, "case_id": case_id, "by_user_id": user.id,
        })
    db.commit()
    return {"id": assessment.id, "case_id": assessment.case_id}

# ---------------- Pathology ----------------

@app.get("/api/v1/samples", tags=["pathology"])
def samples(patient_id: str | None = None, user: User = Depends(require_roles("pathologist", "pathology", "research_lab"), ), db: Session = Depends(get_db)):
    roles = effective(user, db)
    stmt = select(Sample).options(selectinload(Sample.tests), selectinload(Sample.slide_followups)).order_by(Sample.collected_at.desc())
    if patient_id:
        patient = require_patient_scope(user, db, patient_id)
        stmt = stmt.where(Sample.patient_id == patient.id)
    rows = db.scalars(stmt.limit(200)).all()
    if "research_lab" in roles and "clinician" not in roles and "pathologist" not in roles:
        eligible = permissions.eligible_research_sample_ids(db)
        rows = [r for r in rows if r.id in eligible and permissions.patient_is_research_eligible(db, r.patient_id)]
        # Extra safety: ensure patient scope still holds (require_patient_scope did above)
    return {"items": [sample_view(x, roles) for x in rows]}

@app.post("/api/v1/samples", status_code=201, tags=["pathology"])
def create_sample(body: SampleCreate, user: User = Depends(require_roles("pathologist", "pathology")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "lab")
    patient = require_patient_scope(user, db, body.patient_id)
    if body.facility_id and not db.get(Facility, body.facility_id):
        raise HTTPException(422, "Unknown facility reference")
    if body.method == "other" and not str(body.other_method_note or "").strip():
        raise HTTPException(422, "Description is required for Other test method")
    if body.species == "other" and not str(body.species_other_note or "").strip():
        raise HTTPException(422, "Description is required for Other species")
    if body.smear_type and body.smear_type != "not_applicable" and body.method not in ("microscopy", "smp"):
        # Source questionnaire: "Type of Smear read" is asked for slide-based
        # methods (microscopy and the source's "SMP" option), so both accept a
        # smear type. The client requires it for exactly these methods.
        raise HTTPException(422, "Smear type applies only to microscopy or smear tests")
    # The UI requires a species for a positive result; mirror that server-side
    # so API-only callers cannot record an unattributed positive.
    if body.result_status == "positive" and not body.species:
        raise HTTPException(422, "Species is required when the result is positive")
    sample = Sample(sample_code="M3-S-" + secrets.token_hex(4).upper(), patient_id=patient.id,
                    facility_id=body.facility_id, specimen_type=body.specimen_type, status=body.result_status)
    db.add(sample); db.flush()
    test = DiagnosticTest(sample_id=sample.id, method=body.method, other_method_note=body.other_method_note,
                          result_status=body.result_status, species=body.species, species_other_note=body.species_other_note,
                          smear_type=body.smear_type, operator_id=user.id,
                          performed_at=now() if body.result_status != "pending" else None, notes=body.notes)
    db.add(test)
    # When the pathology result resolves a pending clinical order, close the
    # loop: advance the case and notify the clinician who placed the order.
    linked_case_id = body.case_id
    case = db.get(Case, linked_case_id) if linked_case_id else None
    if case:
        sample.case_id = case.id
        if case.status == "awaiting_diagnostic_result" and case_transition_allowed(case.status, "plan_recorded"):
            case.status = "plan_recorded"
            _record_case_event(db, user.id, case, "awaiting_diagnostic_result", "plan_recorded",
                               "Pathology result recorded")
        _notify_case_agents(db, case, "case_diagnostic_result", _clinician_recipients(db),
                            title="Diagnostic result available",
                            body=f"A diagnostic result for case {case.case_code} has been recorded.")
    if body.result_status == "positive":
        # Positive malaria test: immediate clinician alert (outbreak response
        # trigger) plus a Kafka `diagnostic.positive` event for the event hub.
        species_note = body.species or "undetermined"
        positive_recipients = _clinician_recipients(db)
        if case:
            _notify_case_agents(db, case, "diagnostic_positive", positive_recipients,
                                title="Positive malaria test detected",
                                body=f"POSITIVE result ({species_note}) for case {case.case_code}. Workers may need follow-up.")
        else:
            for clinician_id in positive_recipients:
                db.add(Notification(recipient_user_id=clinician_id, case_id=None, kind="diagnostic_positive",
                                    title="Positive malaria test detected",
                                    body=f"POSITIVE result ({species_note}) recorded for worker sample {sample.sample_code}; no linked surveillance case.",
                                    delivered_at=now()))
        # Research Lab notification for eligible positive cases (RDT/microscopy)
        if body.method in ("rdt", "microscopy"):
            rl_recipients = _research_lab_recipients(db)
            for rl_id in rl_recipients:
                db.add(Notification(recipient_user_id=rl_id, case_id=case.id if case else None, kind="research_eligible",
                                    title="Eligible research case",
                                    body="A positive RDT/microscopy result is available for review in the research workspace.",
                                    body_minimal=True, delivered_at=now()))
        kafka_producer.emit_event("diagnostic.positive", {
            "sample_id": sample.id, "sample_code": sample.sample_code, "patient_id": patient.id,
            "case_id": case.id if case else None, "species": body.species, "method": body.method,
            "reported_by": user.id,
        })
        audit(db, user, "diagnostic.positive_alert", "sample", sample.id, detail={"species": body.species})
    audit(db, user, "sample.created", "sample", sample.id); db.commit()
    return sample_view(sample, effective(user, db))

@app.put("/api/v1/samples/{sample_id}/slide-followup", tags=["pathology"])
def save_slide_followup(sample_id: str, body: SlideFollowUpSave, user: User = Depends(require_roles("pathologist", "pathology")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "lab")
    sample = db.get(Sample, sample_id)
    if not sample: raise HTTPException(404, "Sample record not found")
    patient = db.get(Patient, sample.patient_id)
    if not patient: raise HTTPException(404, "Patient record not found")
    if not permissions.can_read_patient(db, user, patient, effective(user, db)):
        _die_forbidden_write()
    slide = db.scalar(select(SlideFollowUp).where(SlideFollowUp.sample_id == sample.id))
    current_updated = slide.updated_at if slide else sample.updated_at
    _assert_not_stale(body.base_updated_at, current_updated)
    if body.received == "yes":
        if not body.positive: raise HTTPException(422, "Follow-up slide positivity is required when a slide was received")
        if body.positive == "yes" and not str(body.positive_day or "").strip():
            raise HTTPException(422, "Follow-up day is required when a slide was positive")
    else:
        if not body.not_received_reason: raise HTTPException(422, "Reason is required when a follow-up slide was not received")
        if body.not_received_reason == "other" and not str(body.other_reason or "").strip():
            raise HTTPException(422, "Description is required for Other not-received reason")
    slide_data = body.model_dump(); slide_data.pop("base_updated_at", None)
    if slide:
        for key, value in slide_data.items(): setattr(slide, key, value)
    else:
        slide = SlideFollowUp(sample_id=sample.id, patient_id=sample.patient_id, recorded_by_user_id=user.id, **slide_data)
        db.add(slide)
    audit(db, user, "slide_followup.recorded", "sample", sample.id); db.commit()
    return {"id": slide.id, "received": slide.received, "positive": slide.positive,
            "positive_day": slide.positive_day, "not_received_reason": slide.not_received_reason}

# ---------------- Follow-ups ----------------

@app.get("/api/v1/health-workers", tags=["follow ups"])
def health_workers(user: User = Depends(require_roles("clinician", "admin", "health_worker")), db: Session = Depends(get_db)):
    """Minimal directory for assigning follow-up tasks (CLIN-003)."""
    stmt = select(User.id, User.display_name).join(RoleAssignment, RoleAssignment.user_id == User.id).where(
        RoleAssignment.role == "health_worker", RoleAssignment.revoked_at.is_(None), User.active,
        User.technical_provisioner == False)  # noqa: E712
    rows = db.execute(stmt).all()
    return {"items": [{"id": r[0], "display_name": r[1]} for r in rows]}

@app.get("/api/v1/follow-ups", tags=["follow ups"])
def list_followups(queue: str = Query("all", pattern="^(all|due|overdue|completed)$"), patient_id: str | None = None,
                   user: User = Depends(require_roles("health_worker", "clinician", "admin")), db: Session = Depends(get_db)):
    roles = effective(user, db)
    stmt = select(FollowUp)
    if "health_worker" in roles and "clinician" not in roles and "admin" not in roles:
        stmt = stmt.where(FollowUp.assigned_user_id == user.id)
    if queue == "due": stmt = stmt.where(FollowUp.status == "due", FollowUp.due_at >= now())
    elif queue == "overdue": stmt = stmt.where(FollowUp.status == "due", FollowUp.due_at < now())
    elif queue == "completed": stmt = stmt.where(FollowUp.status == "completed")
    if patient_id: stmt = stmt.where(FollowUp.patient_id == require_patient_scope(user, db, patient_id).id)
    rows = db.scalars(stmt.order_by(FollowUp.due_at).limit(200)).all()
    audit(db, user, "followup.list_viewed", "follow_up", detail={"queue": queue}); db.commit()
    return {"items": [{"id": x.id, "patient_id": x.patient_id, "assigned_user_id": x.assigned_user_id, "due_at": x.due_at,
                       "scheduled_day": x.scheduled_day, "status": x.status, "adherence": x.adherence,
                       "outcome": x.outcome, "notes": x.notes, "case_id": x.case_id, "updated_at": getattr(x, "updated_at", None)} for x in rows]}

@app.post("/api/v1/follow-ups", status_code=201, tags=["follow ups"])
def create_followup(body: FollowUpCreate, user: User = Depends(require_roles("clinician", "health_worker")), db: Session = Depends(get_db)):
    roles = effective(user, db)
    if "clinician" in roles:
        _assert_write_role(user, db, "followup_assign")
        if not body.assigned_user_id:
            raise HTTPException(422, "An assigned health worker is required")
        patient = require_patient_scope(user, db, body.patient_id)
        assignee = db.get(User, body.assigned_user_id)
        if not assignee or not (permissions.effective_roles(active_roles(assignee, db)) & {"health_worker"}):
            raise HTTPException(422, "Assignee must be an active health worker account")
        data = body.model_dump(); data["patient_id"] = patient.id; data["created_by_user_id"] = user.id
        followup = FollowUp(**data)
    elif "health_worker" in roles:
        _die_forbidden_write()
    else:
        _die_forbidden_write()
    if followup.status == "completed": followup.completed_at = now()
    case_id = data.get("case_id")
    if case_id:
        case = db.get(Case, case_id)
        if not case:
            raise HTTPException(422, "Unknown case reference")
        if case.patient_id != patient.id:
            raise HTTPException(409, "Case does not belong to this worker")
        followup.case_id = case.id
        if case.status in ("plan_recorded", "assigned", "in_assessment") and case_transition_allowed(case.status, "followup_due"):
            from_status = case.status
            case.status = "followup_due"
            _record_case_event(db, user.id, case, from_status, "followup_due",
                               "Follow-up task assigned")
        if followup.assigned_user_id:
            _notify_case_agents(db, case, "followup_assigned", [followup.assigned_user_id],
                                title="Follow-up task assigned",
                                body=f"A follow-up for case {case.case_code} was assigned to you (due {followup.due_at:%Y-%m-%d}).")
    db.add(followup)
    audit(db, user, "followup.created", "followup", followup.id); db.commit()
    return {"id": followup.id, "assigned_user_id": followup.assigned_user_id, "case_id": followup.case_id}


@app.patch("/api/v1/follow-ups/{follow_up_id}", tags=["follow ups"])
@app.put("/api/v1/follow-ups/{follow_up_id}", tags=["follow ups"])
def update_followup(follow_up_id: str, body: FollowUpUpdate, user: User = Depends(require_roles("health_worker", "clinician")), db: Session = Depends(get_db)):
    roles = effective(user, db)
    _assert_write_role(user, db, "followup_update")
    followup = db.get(FollowUp, follow_up_id)
    if not followup:
        raise HTTPException(404, "Follow-up not found")
    patient = db.get(Patient, followup.patient_id)
    if not patient:
        raise HTTPException(404, "Patient record not found")
    # Scope: must be assigned to this health worker, or clinician managing it
    if "health_worker" in roles and "clinician" not in roles:
        if followup.assigned_user_id != user.id:
            raise HTTPException(403, "You do not have access to this follow-up")
    if not permissions.can_read_patient(db, user, patient, roles):
        raise HTTPException(403, "You do not have access to this record")
    if hasattr(body, "base_updated_at"):
        _assert_not_stale(getattr(body, "base_updated_at"), followup.updated_at)
    updates = body.model_dump(exclude_unset=True)
    updates.pop("base_updated_at", None)
    # Never allow changing ownership/assignment/case linkage
    for forbidden in ("patient_id", "assigned_user_id", "case_id", "created_by_user_id", "due_at", "scheduled_day"):
        if forbidden in updates:
            raise HTTPException(422, f"{forbidden} cannot be changed")
    if "status" in updates and updates["status"] == "completed" and followup.status != "completed":
        followup.completed_at = now()
    elif "status" in updates and updates["status"] != "completed":
        followup.completed_at = None
    for k, v in updates.items():
        setattr(followup, k, v)
    audit(db, user, "followup.updated", "followup", followup.id, detail={"fields": sorted(updates.keys())})
    db.commit()
    return {"id": followup.id, "status": followup.status, "adherence": followup.adherence,
            "outcome": followup.outcome, "notes": followup.notes, "completed_at": followup.completed_at}

# ---------------- Molecular / research ----------------

@app.get("/api/v1/research-results", tags=["research laboratory"])
def list_research_results(user: User = Depends(require_roles("research_lab", "clinician")), db: Session = Depends(get_db)):
    roles = effective(user, db)
    stmt = select(MolecularResult).order_by(MolecularResult.created_at.desc()).limit(200)
    rows = db.scalars(stmt).all()
    if "research_lab" in roles and "clinician" not in roles:
        eligible = permissions.eligible_research_sample_ids(db)
        rows = [r for r in rows if r.sample_id in eligible]
    items = [{"id": x.id, "sample_id": x.sample_id, "pcr_status": x.pcr_status,
             "species_confirmation": x.species_confirmation, "parasite_density": x.parasite_density,
             "parasite_density_unit": x.parasite_density_unit, "gametocyte_presence": x.gametocyte_presence,
             "pfhrp2_status": x.pfhrp2_status, "pfhrp3_status": x.pfhrp3_status} for x in rows]
    audit(db, user, "research_results.list_viewed", "research_result", detail={"count": len(items)}); db.commit()
    return {"items": items}

@app.post("/api/v1/research-results", status_code=201, tags=["research laboratory"])
def create_research_result(body: MolecularCreate, user: User = Depends(require_roles("research_lab")), db: Session = Depends(get_db)):
    roles = effective(user, db)
    _assert_write_role(user, db, "research")
    sample = db.get(Sample, body.sample_id)
    if not sample:
        raise HTTPException(404, "Sample record not found")
    patient = db.get(Patient, sample.patient_id)
    if not patient:
        raise HTTPException(404, "Patient record not found")
    if not permissions.can_read_patient(db, user, patient, roles):
        raise HTTPException(403, "You do not have access to this record")
    if not permissions.sample_is_research_eligible(db, sample.id):
        raise HTTPException(403, "Research Lab access is limited to eligible positive RDT/microscopy cases")
    existing = db.scalar(select(MolecularResult).where(MolecularResult.sample_id == sample.id))
    if existing:
        raise HTTPException(409, "A molecular result already exists for this sample")
    mr = MolecularResult(sample_id=sample.id, pcr_status=body.pcr_status,
                         species_confirmation=body.species_confirmation,
                         parasite_density=body.parasite_density,
                         parasite_density_unit=body.parasite_density_unit,
                         gametocyte_presence=body.gametocyte_presence,
                         resistance_markers=body.resistance_markers,
                         pfhrp2_status=body.pfhrp2_status,
                         pfhrp3_status=body.pfhrp3_status,
                         performed_by=user.id)
    db.add(mr)
    audit(db, user, "research_result.created", "research_result", mr.id, detail={"sample_id": sample.id})
    db.commit()
    db.refresh(mr)
    return {"id": mr.id, "sample_id": mr.sample_id, "pcr_status": mr.pcr_status,
            "species_confirmation": mr.species_confirmation, "parasite_density": mr.parasite_density,
            "parasite_density_unit": mr.parasite_density_unit, "gametocyte_presence": mr.gametocyte_presence,
            "resistance_markers": mr.resistance_markers, "pfhrp2_status": mr.pfhrp2_status,
            "pfhrp3_status": mr.pfhrp3_status}

@app.get("/api/v1/audit-events", tags=["administration"])
def read_audit_events(action: str | None = None, entity_type: str | None = None, entity_id: str | None = None,
                      offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
                      user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    """Read-only audit review for the Admin role (PRD DATA-002). Admin has no mutating rights anywhere.
    There is intentionally no POST route for audit events: they are produced solely by application actions."""
    stmt = select(AuditEvent)
    if action: stmt = stmt.where(AuditEvent.action == action)
    if entity_type: stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id: stmt = stmt.where(AuditEvent.entity_id == entity_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(AuditEvent.occurred_at.desc()).offset(offset).limit(limit)).all()
    return page([
        {"id": x.id, "actor_user_id": x.actor_user_id, "action": x.action, "entity_type": x.entity_type,
         "entity_id": x.entity_id, "occurred_at": x.occurred_at, "detail": x.detail}
        for x in rows
    ], total, offset, limit)

@app.get("/api/v1/dashboard", tags=["reports"])
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = effective(user, db)
    if roles == {"worker"}:
        return {"scope": "own", "workers": 1 if user.patient_id else 0, "followups_due": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.patient_id == user.patient_id, FollowUp.status == "due")) or 0, "note": "Personal view; counts are not surveillance indicators."}
    if roles == {"contractor"}:
        site_ids = permissions.contractor_site_ids(db, user)
        workers = db.scalar(select(func.count(func.distinct(WorkerSiteAssignment.patient_id))).where(WorkerSiteAssignment.site_id.in_(site_ids or ["__none__"]), WorkerSiteAssignment.end_date.is_(None))) or 0
        return {"scope": "managed_sites", "workers": workers, "sites": len(site_ids), "note": "Roster totals only; clinical and research data are restricted."}
    if "health_worker" in roles and not (roles & {"clinician", "admin", "pathologist"}):
        assigned = permissions.assigned_followup_patient_ids(db, user)
        followups_due = db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.assigned_user_id == user.id, FollowUp.status == "due")) or 0
        followups_overdue = db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.assigned_user_id == user.id, FollowUp.status == "due", FollowUp.due_at < now())) or 0
        return {"scope": "health_worker_assigned", "workers": len(assigned), "followups_due": followups_due, "followups_overdue": followups_overdue, "note": "Counts limited to assigned follow-ups and permitted workers."}
    if "research_lab" in roles and not (roles & {"clinician", "admin", "pathologist"}):
        eligible_samples = permissions.eligible_research_sample_ids(db)
        eligible_patients = set()
        if eligible_samples:
            from .models import Sample
            eligible_patients = set(db.scalars(select(Sample.patient_id).where(Sample.id.in_(eligible_samples))).all())
        unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.recipient_user_id == user.id, Notification.read_at.is_(None))) or 0
        return {"scope": "research_eligible", "eligible_research_cases": len(eligible_patients), "eligible_samples": len(eligible_samples), "unread_notifications": unread, "note": "Restricted to positive RDT/microscopy cases only."}
    if "admin" in roles and roles == {"admin"}:
        unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.recipient_user_id == user.id, Notification.read_at.is_(None))) or 0
        return {"scope": "admin_readonly", "workers": db.scalar(select(func.count()).select_from(Patient)) or 0, "samples_pending": db.scalar(select(func.count()).select_from(Sample).where(Sample.status == "pending")) or 0, "tests_positive": db.scalar(select(func.count()).select_from(DiagnosticTest).where(DiagnosticTest.result_status == "positive")) or 0, "followups_due": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due")) or 0, "followups_overdue": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due", FollowUp.due_at < now())) or 0, "unread_notifications": unread, "note": "Admin is read-only; counts are operational totals."}
    unread = db.scalar(select(func.count()).select_from(Notification).where(Notification.recipient_user_id == user.id, Notification.read_at.is_(None))) or 0
    return {"scope": "authorized_operational", "workers": db.scalar(select(func.count()).select_from(Patient)) or 0, "samples_pending": db.scalar(select(func.count()).select_from(Sample).where(Sample.status == "pending")) or 0, "tests_positive": db.scalar(select(func.count()).select_from(DiagnosticTest).where(DiagnosticTest.result_status == "positive")) or 0, "followups_due": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due")) or 0, "followups_overdue": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due", FollowUp.due_at < now())) or 0, "unread_notifications": unread, "note": "Synthetic operational counts. Not epidemiological rates."}


# ---------------- Cases: symptom reports, lifecycle, notifications (Phases 2-3) ----------------
# One case per health episode. Symptom reports open cases; all clinical actors
# converge on the same Case row through authorized transitions journaled in
# case_events. Notifications are persisted per recipient and polled by clients
# (no push provider is configured in this deployment).

CASE_STATUSES = (
    "submitted", "awaiting_clinical_review", "assigned", "in_assessment",
    "diagnostic_testing_requested", "awaiting_diagnostic_result",
    "plan_recorded", "followup_due", "followup_completed", "closed",
)
CASE_TRANSITIONS = {
    "submitted": {"awaiting_clinical_review"},
    "awaiting_clinical_review": {"assigned", "closed"},
    "assigned": {"in_assessment", "diagnostic_testing_requested", "closed"},
    "in_assessment": {"diagnostic_testing_requested", "plan_recorded", "closed"},
    "diagnostic_testing_requested": {"awaiting_diagnostic_result", "closed"},
    "awaiting_diagnostic_result": {"plan_recorded", "closed"},
    "plan_recorded": {"followup_due", "closed"},
    "followup_due": {"followup_completed", "closed"},
    "followup_completed": {"closed"},
    "closed": set(),
}

class SymptomReportIn(BaseModel):
    symptoms: list[str] = Field(min_length=1, max_length=15)
    onset_category: str | None = Field(default=None, pattern="^(today|1_3_days|more_3_days|over_a_week|not_sure)$")
    temperature_c: float | None = Field(default=None, ge=30.0, le=45.0)
    site_id: str | None = None
    location_note: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    attend_facility: str | None = Field(default=None, pattern="^(yes|no|unsure)$")
    contact_pref: str | None = Field(default=None, max_length=32)
    client_request_id: str = Field(min_length=8, max_length=64)

class CaseTransitionIn(BaseModel):
    to_status: str
    note: str | None = Field(default=None, max_length=2000)

class RequestTestIn(BaseModel):
    facility_id: str

class NotificationReadIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)

def case_transition_allowed(cur: str, nxt: str) -> bool:
    return nxt in CASE_TRANSITIONS.get(cur, set())

def _record_case_event(db: Session, actor_id: str | None, case: Case, from_status: str | None, to_status: str, note: str | None):
    db.add(CaseEvent(case_id=case.id, from_status=from_status, to_status=to_status, actor_user_id=actor_id, note=note))

def _notify_case_agents(db: Session, case: Case, kind: str, recipients: list[str], body_minimal: bool = False,
                        title: str = "Case needs attention", body: str = ""):
    """Persist one notification row per recipient, transactionally with the case change."""
    for rid in set(recipients):
        if rid is None:
            continue
        db.add(Notification(recipient_user_id=rid, case_id=case.id, kind=kind,
                            title=title, body=body, body_minimal=body_minimal, delivered_at=now()))

def _clinician_recipients(db) -> list[str]:
    """District clinical routing: active clinicians without a narrower scope are
    the on-call medical officers of record. (Site/facility-specific clinician
    routing requires a facility assignment relation — flagged as pending design.)"""
    stmt = select(User.id).join(RoleAssignment, RoleAssignment.user_id == User.id).where(
        RoleAssignment.role == "clinician", RoleAssignment.revoked_at.is_(None), User.active)
    return [r[0] for r in db.execute(stmt).all()]

def _pathologist_recipients(db) -> list[str]:
    stmt = select(User.id).join(RoleAssignment, RoleAssignment.user_id == User.id).where(
        RoleAssignment.role.in_(("pathologist", "pathology")), RoleAssignment.revoked_at.is_(None), User.active)
    return [r[0] for r in db.execute(stmt).all()]


def _research_lab_recipients(db) -> list[str]:
    stmt = select(User.id).join(RoleAssignment, RoleAssignment.user_id == User.id).where(
        RoleAssignment.role == "research_lab", RoleAssignment.revoked_at.is_(None), User.active)
    return [r[0] for r in db.execute(stmt).all()]


def _health_worker_recipients(db, assigned_user_id: str | None = None) -> list[str]:
    if assigned_user_id:
        return [assigned_user_id]
    stmt = select(User.id).join(RoleAssignment, RoleAssignment.user_id == User.id).where(
        RoleAssignment.role == "health_worker", RoleAssignment.revoked_at.is_(None), User.active)
    return [r[0] for r in db.execute(stmt).all()]

def _contractor_recipients(db, site: Site) -> list[str]:
    """Contractors responsible for a site: its owning account plus any active
    contractor whose role is scoped to this site. Both receive the minimal body only."""
    scoped = db.scalars(select(RoleAssignment.user_id).join(User, User.id == RoleAssignment.user_id).where(
        RoleAssignment.role == "contractor", RoleAssignment.scope_type == "site",
        RoleAssignment.scope_id == site.id, RoleAssignment.revoked_at.is_(None), User.active)).all()
    return list({*scoped, *([site.contractor_user_id] if site.contractor_user_id else [])})

def case_summary(db, user: User, roles: set[str], case: Case, detail: bool = False) -> dict:
    report = db.scalar(select(SymptomReport).where(SymptomReport.case_id == case.id))
    site = db.get(Site, case.site_id) if case.site_id else None
    data = {
        "id": case.id, "case_code": case.case_code, "patient_id": case.patient_id,
        "status": case.status, "urgent": case.urgent, "source": case.source,
        "created_at": case.created_at, "acknowledged_at": case.acknowledged_at,
        "closed_at": case.closed_at, "site_id": case.site_id,
        "site_name": site.name if site else None,
    }
    if detail:
        data["assigned_user_id"] = case.assigned_user_id
        # Internal clinical trace (transition notes are clinician free-text) is
        # role-gated: only clinicians/pathologists get the event history.
        # Workers get the authoritative status timeline via to_status timestamps
        # on the closed subset, without notes. Admin reads provenance via the
        # audit log instead.
        clinical_viewer = bool(roles & {"clinician", "pathologist"})
        if clinical_viewer:
            data["events"] = [
                {"from_status": e.from_status, "to_status": e.to_status, "actor_user_id": e.actor_user_id,
                 "note": e.note, "created_at": e.created_at}
                for e in db.scalars(select(CaseEvent).where(CaseEvent.case_id == case.id).order_by(CaseEvent.created_at)).all()
            ]
        else:
            # Public-safe timeline: status changes only, no actor identifiers
            # and never the note content.
            data["status_timeline"] = [
                {"to_status": e.to_status, "created_at": e.created_at}
                for e in db.scalars(select(CaseEvent).where(CaseEvent.case_id == case.id).order_by(CaseEvent.created_at)).all()
            ]
    if detail and "clinician" in roles or detail and "pathologist" in roles:
        data["patient"] = patient_view(db.get(Patient, case.patient_id), roles)
        if report:
            data["report"] = {
                "symptoms": report.symptoms, "onset_category": report.onset_category,
                "temperature_c": report.temperature_c, "description": report.description,
                "attend_facility": report.attend_facility, "reported_at": report.reported_at,
                "approved_for_view": ["clinician", "pathologist"],
            }
        data["assessments"] = [
            {"id": a.id, "encounter_at": a.encounter_at, "admission_status": a.admission_status,
             "outcome": a.outcome} for a in db.scalars(select(ClinicalAssessment).where(ClinicalAssessment.case_id == case.id)).all()
        ]
        # Laboratory sample linkage is operational data pathologists act on;
        # workers receive follow-up tasks and status only (no lab-detail view).
        if clinical_viewer:
            data["samples"] = [
                {"id": s.id, "sample_code": s.sample_code, "status": s.status,
                 "case_id": s.case_id} for s in db.scalars(select(Sample).where(Sample.case_id == case.id)).all()
            ]
        data["followups"] = [
            {"id": f.id, "status": f.status, "due_at": f.due_at, "assignee": f.assigned_user_id}
            for f in db.scalars(select(FollowUp).where(FollowUp.case_id == case.id)).all()
        ]
    return data

@app.post("/api/v1/symptom-reports", status_code=201, tags=["cases"])
def submit_symptom_report(body: SymptomReportIn, response: Response = None,
                          user: User = Depends(require_roles("worker")), db: Session = Depends(get_db)):
    """Worker 'I feel unwell / need medical help'. Minimal data; creates one case.
    Idempotent by client_request_id (offline replay/safe retries)."""
    _assert_write_role(user, db, "questionnaire")
    if not user.patient_id:
        raise HTTPException(409, detail={"message": "A worker registration is required before a symptom report",
                                         "next": "complete the worker registration questionnaire"})
    patient = db.get(Patient, user.patient_id)
    if not patient:
        raise HTTPException(409, "Worker profile not found")
    # Replay: an ambiguous retry must never mint a second case.
    if body.client_request_id:
        prior = db.scalar(select(SymptomReport).where(SymptomReport.client_request_id == body.client_request_id))
        if prior and prior.patient_id != patient.id:
            _reject_foreign_replay(db, user, "symptom_reports.create", body.client_request_id)
        if prior:
            case = db.get(Case, prior.case_id)
            audit(db, user, "symptom_report.replayed_no_duplicate", "case", case.id); db.commit()
            if response is not None: response.status_code = status.HTTP_200_OK
            return {"duplicate": True, "case_id": case.id, "case_code": case.case_code,
                    "status": case.status, "urgent": case.urgent}
    symptoms = list(dict.fromkeys(s.strip() for s in body.symptoms if s.strip()))
    if not symptoms:
        raise HTTPException(422, "At least one symptom is required")
    # Same accepted vocabulary as the screening questionnaire, plus the danger
    # signals and 'other' (covering extra free-form coded symptoms).
    KNOWN_SYMPTOMS = {"no_other_symptoms", "breathing_difficulty", "chest_pain", "confusion", "other",
                      "chills_shivering", "headache", "sweating", "body_ache", "nausea_vomiting",
                      "weakness_fatigue", "fever"}
    unknown_symptoms = [s for s in symptoms if s not in KNOWN_SYMPTOMS]
    if unknown_symptoms:
        raise HTTPException(422, detail={"message": "Unrecognized symptom codes",
                                         "unknown": unknown_symptoms})
    site = None
    if body.site_id:
        site = db.get(Site, body.site_id)
        if not site:
            raise HTTPException(422, "Unknown site")
        assigned_ids = db.scalars(select(WorkerSiteAssignment.site_id).where(
            WorkerSiteAssignment.patient_id == patient.id, WorkerSiteAssignment.end_date.is_(None))).all()
        if site.id not in (assigned_ids or []):
            raise HTTPException(403, "Site is not an authorized assignment for this worker")
    else:
        # Default: the worker's single active site assignment gives the report
        # location context without adding a required field for the worker.
        assigned = db.scalars(select(WorkerSiteAssignment.site_id).where(
            WorkerSiteAssignment.patient_id == patient.id, WorkerSiteAssignment.end_date.is_(None))).all()
        if assigned and len(set(assigned)) == 1:
            site = db.get(Site, assigned[0])
    urgent = any(s in get_settings().urgent_symptoms for s in symptoms)
    case = Case(case_code="M3-CA-" + secrets.token_hex(4).upper(), patient_id=patient.id,
                site_id=site.id if site else None, status="awaiting_clinical_review",
                urgent=urgent, source="symptom_report", created_by_user_id=user.id,
                client_request_id=body.client_request_id)
    db.add(case)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        prior = db.scalar(select(SymptomReport).where(SymptomReport.client_request_id == body.client_request_id))
        if prior is None:
            prior_case = db.scalar(select(Case).where(Case.client_request_id == body.client_request_id))
            if prior_case is None:
                raise
            owner_ok, c = prior_case.patient_id == patient.id, prior_case
        else:
            owner_ok, c = prior.patient_id == patient.id, db.get(Case, prior.case_id)
        if not owner_ok:
            _reject_foreign_replay(db, user, "symptom_reports.create", body.client_request_id)
        audit(db, user, "symptom_report.replayed_no_duplicate", "case", c.id); db.commit()
        if response is not None: response.status_code = status.HTTP_200_OK
        return {"duplicate": True, "case_id": c.id, "case_code": c.case_code, "status": c.status, "urgent": c.urgent}
    report = SymptomReport(case_id=case.id, patient_id=patient.id, site_id=site.id if site else None,
                           location_note=body.location_note, symptoms=symptoms,
                           onset_category=body.onset_category, temperature_c=body.temperature_c,
                           description=body.description, attend_facility=body.attend_facility,
                           contact_pref=body.contact_pref, reported_at=now(),
                           client_request_id=body.client_request_id)
    db.add(report); db.flush()
    _record_case_event(db, user.id, case, "submitted", "awaiting_clinical_review",
                       "Report routed for clinical review")
    # Routing: district clinicians; site contractors receive MINIMAL info only;
    # repeated-tap safety is guaranteed by the unique client_request_id.
    contractor_ids = _contractor_recipients(db, site) if site else []
    _notify_case_agents(db, case, "case_clinical_review", _clinician_recipients(db),
                        title="Urgent case needs review" if urgent else "A case assigned to you needs review",
                        body=f"Symptom report at your district. Case {case.case_code} awaiting clinical review.")
    if contractor_ids:
        _notify_case_agents(db, case, "case_site_coordination", contractor_ids, body_minimal=True,
                            title="Site coordination notice",
                            body=f"A case was reported at {site.code} ({site.name}). No clinical data is shared here.")
    audit(db, user, "case.created", "case", case.id, detail={"urgent": urgent}); db.commit()
    kafka_producer.emit_event("symptom_report.created", {
        "case_id": case.id, "case_code": case.case_code, "patient_id": patient.id,
        "site_id": case.site_id, "urgent": urgent,
    })
    return {"case_id": case.id, "case_code": case.case_code, "status": case.status,
            "urgent": case.urgent, "reported_at": report.reported_at}

@app.get("/api/v1/cases", tags=["cases"])
def list_cases(status: str | None = Query(None, pattern="^(" + "|".join(CASE_STATUSES) + ")$"),
               urgent: bool | None = None, site_id: str | None = None, patient_id: str | None = None,
               offset: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Role-scoped case queues. Workers see own cases; clinicians see routed
    cases; pathologists see cases with orders awaiting results; contractors see
    only case_code/site/status at their sites; admin read-only; research none."""
    roles = effective(user, db)
    stmt = select(Case)
    if "clinician" in roles or "admin" in roles or "pathologist" in roles:
        pass  # district-wide routed work queue (they are the recorded recipients)
    elif "worker" in roles:
        stmt = stmt.where(Case.patient_id == user.patient_id)
    elif "contractor" in roles:
        site_ids = permissions.contractor_site_ids(db, user)
        stmt = stmt.where(Case.site_id.in_(site_ids or ["__none__"]))
    elif "health_worker" in roles:
        assigned = permissions.assigned_followup_patient_ids(db, user)
        stmt = stmt.where(Case.patient_id.in_(assigned or ["__none__"]))
    else:
        _die_forbidden_write()  # research_lab and others have no clinical case access
    if status: stmt = stmt.where(Case.status == status)
    if urgent is not None: stmt = stmt.where(Case.urgent == urgent)
    if site_id: stmt = stmt.where(Case.site_id == site_id)
    if patient_id and roles & {"clinician", "admin", "pathologist"}:
        patient = require_patient_scope(user, db, patient_id)
        stmt = stmt.where(Case.patient_id == patient.id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Case.created_at.desc()).offset(offset).limit(limit)).all()
    detail = False
    return page([case_summary(db, user, roles, c, detail) for c in rows], total, offset, limit)

@app.get("/api/v1/cases/{case_id}", tags=["cases"])
def case_detail(case_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = effective(user, db)
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if "clinician" in roles or "admin" in roles or "pathologist" in roles:
        allowed = True
    elif "worker" in roles:
        allowed = case.patient_id == user.patient_id
    elif "contractor" in roles:
        allowed = case.site_id in permissions.contractor_site_ids(db, user)
    elif "health_worker" in roles:
        allowed = case.patient_id in (permissions.assigned_followup_patient_ids(db, user) or [])
    else:
        allowed = False
    if not allowed:
        raise HTTPException(403, "You do not have access to this case")
    data = case_summary(db, user, roles, case, detail=True)
    if "contractor" in roles:
        # Contractors receive operational status only — strip clinical payload.
        data = {k: v for k, v in {
            "id": data["id"], "case_code": data["case_code"], "status": data["status"],
            "urgent": data["urgent"], "site_id": data["site_id"], "site_name": data["site_name"],
            "created_at": data["created_at"],
        }.items()}
    audit(db, user, "case.detail_viewed", "case", case.id); db.commit()
    return data

@app.post("/api/v1/cases/{case_id}/acknowledge", tags=["cases"])
def acknowledge_case(case_id: str, user: User = Depends(require_roles("clinician")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "clinical")
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if case.status != "awaiting_clinical_review":
        raise HTTPException(409, detail={"message": "Case is not awaiting clinical review",
                                         "current_status": case.status})
    case.status = "assigned"
    case.assigned_user_id = user.id
    case.acknowledged_at = now()
    _record_case_event(db, user.id, case, "awaiting_clinical_review", "assigned",
                       "Acked by clinician")
    audit(db, user, "case.acknowledged", "case", case.id); db.commit()
    return {"id": case.id, "status": case.status, "assigned_user_id": case.assigned_user_id,
            "acknowledged_at": case.acknowledged_at}

@app.post("/api/v1/cases/{case_id}/transition", tags=["cases"])
def transition_case(case_id: str, body: CaseTransitionIn,
                    user: User = Depends(require_roles("clinician")), db: Session = Depends(get_db)):
    _assert_write_role(user, db, "clinical")
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if not case_transition_allowed(case.status, body.to_status):
        raise HTTPException(422, detail={"message": "Invalid case transition",
                                         "from": case.status, "to": body.to_status,
                                         "allowed": sorted(CASE_TRANSITIONS.get(case.status, set()))})
    from_status = case.status
    case.status = body.to_status
    if body.to_status == "closed":
        case.closed_at = now()
    if body.to_status.startswith("followup") and not case.assigned_user_id:
        case.assigned_user_id = user.id
    _record_case_event(db, user.id, case, from_status, body.to_status, body.note)
    if body.to_status == "closed":
        # The reporting worker is told their case is closed (status only).
        if case.created_by_user_id:
            _notify_case_agents(db, case, "case_status_update", [case.created_by_user_id],
                                title="Case closed",
                                body=f"Your case {case.case_code} is closed. All instructions recorded remain available.")
    audit(db, user, "case.transitioned", "case", case.id, detail={"to": body.to_status})
    db.commit()
    return {"id": case.id, "status": case.status, "closed_at": case.closed_at}

@app.post("/api/v1/cases/{case_id}/request-test", status_code=201, tags=["cases"])
def request_diagnostic_test(case_id: str, body: RequestTestIn,
                            user: User = Depends(require_roles("clinician")), db: Session = Depends(get_db)):
    """Clinician orders a diagnostic test: creates the lab-linked Sample record
    (visible to pathology without clinical fields) and routes the order."""
    _assert_write_role(user, db, "clinical")
    case = db.get(Case, case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    if case.status not in ("assigned", "in_assessment"):
        raise HTTPException(409, detail={"message": "Testing can only be requested from an assigned/assessed case",
                                         "current_status": case.status})
    facility = db.get(Facility, body.facility_id)
    if not facility:
        raise HTTPException(422, "Unknown facility")
    existing = db.scalar(select(Sample).where(Sample.case_id == case.id))
    if existing:
        raise HTTPException(409, detail={"message": "A diagnostic order already exists for this case",
                                         "sample_id": existing.id})
    sample = Sample(sample_code="M3-S-" + secrets.token_hex(4).upper(), patient_id=case.patient_id,
                    facility_id=facility.id, status="pending", case_id=case.id)
    db.add(sample); db.flush()
    from_status = case.status
    if case_transition_allowed(from_status, "diagnostic_testing_requested"):
        case.status = "diagnostic_testing_requested"
        _record_case_event(db, user.id, case, from_status, "diagnostic_testing_requested",
                           f"Diagnostic order created ({facility.code})")
    _notify_case_agents(db, case, "case_diagnostic_order", _pathologist_recipients(db),
                        title="New diagnostic request",
                        body=f"Diagnostic order for case {case.case_code} routed to {facility.code} ({facility.name}).")
    audit(db, user, "case.test_requested", "case", case.id, detail={"sample_id": sample.id})
    db.commit()
    return {"case_id": case.id, "case_status": case.status, "sample_id": sample.id,
            "sample_code": sample.sample_code}

@app.get("/api/v1/notifications", tags=["cases"])
def list_notifications(after: datetime | None = None, unread_only: bool = False,
                       offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Authenticated in-app notification inbox (no push provider configured).
    `after` supports reconnect catch-up so no notification is missed."""
    stmt = select(Notification).where(Notification.recipient_user_id == user.id)
    if after: stmt = stmt.where(Notification.created_at > after)
    if unread_only: stmt = stmt.where(Notification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    unread = db.scalar(select(func.count()).select_from(Notification).where(
        Notification.recipient_user_id == user.id, Notification.read_at.is_(None))) or 0
    rows = db.scalars(stmt.order_by(Notification.created_at.desc()).offset(offset).limit(limit)).all()
    return {"items": [{"id": n.id, "case_id": n.case_id, "kind": n.kind, "title": n.title,
                       "body": n.body, "body_minimal": n.body_minimal, "created_at": n.created_at,
                       "delivered_at": n.delivered_at, "read_at": n.read_at} for n in rows],
            "total": total, "unread": unread}

@app.post("/api/v1/notifications/read", tags=["cases"])
def mark_notifications_read(body: NotificationReadIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Only the recipient can mark their own notifications read."""
    updated = 0
    for nid in body.ids:
        n = db.get(Notification, nid)
        if not n:
            raise HTTPException(404, "Notification not found")
        if n.recipient_user_id != user.id:
            raise HTTPException(403, "You do not have access to this notification")
        if n.read_at is None:
            n.read_at = now(); updated += 1
    db.commit()
    return {"updated": updated}

@app.get("/api/v1/admin/case-metrics", tags=["administration"])
def admin_case_metrics(user: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    """Real-query operational aggregates for the admin dashboard (read-only).
    Zero means a real count of zero; nothing is fabricated."""
    by_status = {s: (db.scalar(select(func.count()).select_from(Case).where(Case.status == s)) or 0) for s in CASE_STATUSES}
    tests_pos_7d = db.scalar(select(func.count()).select_from(DiagnosticTest).where(
        DiagnosticTest.result_status == "positive",
        DiagnosticTest.performed_at >= now() - timedelta(days=7))) or 0
    followups_due = db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due")) or 0
    followups_overdue = db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due", FollowUp.due_at < now())) or 0
    followups_completed = db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "completed")) or 0
    reports_24h = db.scalar(select(func.count()).select_from(SymptomReport).where(
        SymptomReport.reported_at >= now() - timedelta(days=1))) or 0
    reports_7d = db.scalar(select(func.count()).select_from(SymptomReport).where(
        SymptomReport.reported_at >= now() - timedelta(days=7))) or 0
    ack_avg = None
    result_avg = None
    acked = db.execute(select(Case.acknowledged_at, Case.created_at).where(Case.acknowledged_at.is_not(None))).all()  # noqa: E712
    ack_deltas = [(_aware(a) - _aware(c)).total_seconds() / 3600 for a, c in acked if a and c]
    if ack_deltas:
        ack_avg = round(sum(ack_deltas) / len(ack_deltas), 2)
    samples_case = db.execute(select(Sample.created_at, Case.created_at).join(
        Case, Case.id == Sample.case_id)).all()
    r_deltas = [(_aware(s) - _aware(c)).total_seconds() / 3600 for s, c in samples_case if s and c]
    if r_deltas:
        result_avg = round(sum(r_deltas) / len(r_deltas), 2)
    by_district = {}
    for site in db.scalars(select(Site)).all():
        n = db.scalar(select(func.count()).select_from(Case).where(Case.site_id == site.id)) or 0
        if n:
            by_district[site.district] = by_district.get(site.district, 0) + n
    return {
        "cases_by_status": by_status,
        "urgent_open": (db.scalar(select(func.count()).select_from(Case).where(
            Case.urgent == True, Case.status != "closed")) or 0),  # noqa: E712
        "new_symptom_reports_24h": reports_24h,
        "new_symptom_reports_7d": reports_7d,
        "test_results_positive_7d": tests_pos_7d,
        "followups_due": followups_due,
        "followups_overdue": followups_overdue,
        "followups_completed": followups_completed,
        "avg_hours_report_to_ack": ack_avg,
        "avg_hours_case_to_order": result_avg,
        "cases_by_district": by_district,
        "generated_at": now(),
        "note": "Real query aggregates from the operational database. Zero is a real zero.",
    }
