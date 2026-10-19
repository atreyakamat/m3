from datetime import timedelta
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload
from .config import get_settings
from .database import get_db
from .models import (ClinicalAssessment, DiagnosticTest, Facility, FollowUp, MolecularResult, Patient, RoleAssignment, Sample, Site, TravelEvent, User, WorkerSiteAssignment, now, uid)
from .schemas import AssessmentCreate, FollowUpCreate, LoginIn, MolecularCreate, ProvisionIn, SampleCreate, SiteCreate, TokenOut, WorkerCreate
from .security import active_roles, audit, create_token, get_current_user, hash_pin, normalize_phone, require_roles, verify_pin

app = FastAPI(title="M3 Malaria Surveillance API", version="0.1.0", description="Synthetic-data prototype. Not approved for clinical deployment.")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def page(items, total, offset, limit): return {"items": items, "total": total, "offset": offset, "limit": limit}
def user_view(user, db):
    return {"id": user.id, "display_name": user.display_name, "preferred_language": user.preferred_language, "roles": sorted(active_roles(user, db)), "patient_id": user.patient_id}
def patient_view(p, include_identity=True):
    data = {"id": p.id, "patient_code": p.patient_code, "age_years": p.age_years, "gender": p.gender, "occupation": p.occupation, "consent_status": p.consent_status, "initial_symptoms": p.initial_symptoms or [], "updated_at": p.updated_at}
    if include_identity: data["display_name"] = p.display_name
    return data
def sample_view(s):
    return {"id": s.id, "sample_code": s.sample_code, "patient_id": s.patient_id, "status": s.status, "specimen_type": s.specimen_type, "collected_at": s.collected_at, "tests": [{"id": t.id, "method": t.method, "result_status": t.result_status, "species": t.species, "smear_type": t.smear_type, "performed_at": t.performed_at} for t in s.tests]}
def resolve_patient(db: Session, identifier: str) -> Patient | None:
    if not identifier: return None
    clean = str(identifier).strip()
    if patient := db.get(Patient, clean): return patient
    return db.scalar(select(Patient).where(or_(func.upper(Patient.patient_code) == clean.upper(), Patient.id == clean)))

def can_view_patient(user, db, patient_id):
    roles = active_roles(user, db)
    p = resolve_patient(db, patient_id)
    actual_id = p.id if p else patient_id
    if "worker" in roles and user.patient_id == actual_id: return True
    if "contractor" in roles:
        scope_ids = set(db.scalars(select(RoleAssignment.scope_id).where(RoleAssignment.user_id == user.id, RoleAssignment.role == "contractor", RoleAssignment.revoked_at.is_(None))).all())
        q = select(WorkerSiteAssignment.id).where(WorkerSiteAssignment.patient_id == actual_id, WorkerSiteAssignment.end_date.is_(None))
        if scope_ids and db.scalar(q.where(WorkerSiteAssignment.site_id.in_(scope_ids))): return True
        return False
    return bool(roles.intersection({"clinician", "pathology", "health_worker", "research_lab"}))

def require_patient_scope(user, db, patient_id) -> Patient:
    patient = resolve_patient(db, patient_id)
    if not patient: raise HTTPException(404, "Patient record not found")
    if not can_view_patient(user, db, patient.id): raise HTTPException(403, "You do not have access to this record")
    return patient

@app.get("/health", tags=["operations"])
def health(db: Session = Depends(get_db)):
    db.execute(select(1)); return {"status": "ok", "service": "m3-api", "time": now()}

@app.post("/api/v1/auth/login", response_model=TokenOut, tags=["authentication"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    generic = HTTPException(status_code=401, detail="Unable to sign in with those credentials")
    try: phone = normalize_phone(body.phone)
    except ValueError: raise generic
    user = db.scalar(select(User).where(User.phone_e164 == phone))
    if not user or not user.active or (user.locked_until and user.locked_until > now()) or not verify_pin(body.pin, user.pin_hash):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= get_settings().failed_login_limit:
                user.locked_until = now() + timedelta(minutes=get_settings().lockout_minutes); user.failed_login_count = 0
            audit(db, user, "auth.login_failed", "user", user.id); db.commit()
        raise generic
    user.failed_login_count = 0; user.locked_until = None; user.last_login_at = now()
    token, expires = create_token(user, db); audit(db, user, "auth.login", "user", user.id); db.commit()
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

@app.get("/api/v1/sites", tags=["sites"])
def sites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Site).order_by(Site.name)).all(); return {"items": [{"id": x.id, "code": x.code, "name": x.name, "contractor_name": x.contractor_name, "district": x.district, "area": x.area, "status": x.status} for x in rows]}

@app.post("/api/v1/sites", status_code=201, tags=["sites"])
def create_site(body: SiteCreate, user: User = Depends(require_roles("contractor")), db: Session = Depends(get_db)):
    if db.scalar(select(Site).where(Site.code == body.code)): raise HTTPException(409, "Site code already exists")
    site = Site(**body.model_dump()); db.add(site); db.flush(); audit(db, user, "site.created", "site", site.id); db.commit(); return {"id": site.id, "code": site.code}

@app.get("/api/v1/workers", tags=["workers"])
def workers(q: str | None = None, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Patient)
    roles = active_roles(user, db)
    if "worker" in roles: stmt = stmt.where(Patient.id == user.patient_id)
    elif "contractor" in roles:
        site_ids = [x for x in db.scalars(select(RoleAssignment.scope_id).where(RoleAssignment.user_id == user.id, RoleAssignment.role == "contractor", RoleAssignment.revoked_at.is_(None))).all() if x]
        stmt = stmt.join(WorkerSiteAssignment).where(WorkerSiteAssignment.end_date.is_(None), WorkerSiteAssignment.site_id.in_(site_ids or ["__none__"]))
    elif not roles.intersection({"clinician", "pathology", "health_worker", "research_lab"}): raise HTTPException(403, "You do not have permission for this action")
    if q: stmt = stmt.where(or_(Patient.patient_code.ilike(f"%{q}%"), Patient.display_name.ilike(f"%{q}%")))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Patient.updated_at.desc()).offset(offset).limit(limit)).all()
    audit(db, user, "worker.list_viewed", "worker", detail={"query": bool(q)}); db.commit()
    return page([patient_view(x, include_identity="contractor" not in roles) for x in rows], total, offset, limit)

@app.post("/api/v1/workers", status_code=201, tags=["workers"])
def create_worker(body: WorkerCreate, user: User = Depends(require_roles("worker", "contractor")), db: Session = Depends(get_db)):
    if not db.get(Site, body.site_id): raise HTTPException(422, "Unknown site")
    patient = Patient(patient_code="M3-" + uid().replace("-", "")[:8].upper(), display_name=body.display_name, age_years=body.age_years, gender=body.gender, preferred_language=body.preferred_language, occupation=body.occupation, nativity=body.nativity, consent_status=body.consent_status, initial_symptoms=body.initial_symptoms)
    db.add(patient); db.flush(); db.add(WorkerSiteAssignment(patient_id=patient.id, site_id=body.site_id, start_date=now().date().isoformat()))
    if body.travel_origin: db.add(TravelEvent(patient_id=patient.id, origin=body.travel_origin, arrival_date=body.travel_arrival_date))
    if "worker" in active_roles(user, db) and not user.patient_id: user.patient_id = patient.id
    audit(db, user, "worker.created", "worker", patient.id); db.commit(); return patient_view(patient)

@app.get("/api/v1/workers/{patient_id}", tags=["workers"])
def worker_detail(patient_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, patient_id)
    roles = active_roles(user, db); audit(db, user, "worker.viewed", "worker", patient.id); db.commit()
    result = patient_view(patient, include_identity="contractor" not in roles)
    result["site_assignments"] = [{"site_id": a.site_id, "site_name": a.site.name, "start_date": a.start_date, "end_date": a.end_date} for a in patient.assignments]
    if "contractor" not in roles:
        result["travel_history"] = [{"origin": t.origin, "destination": t.destination, "arrival_date": t.arrival_date} for t in patient.travels]
    return result

@app.get("/api/v1/assessments", tags=["clinical"])
def assessments(patient_id: str, user: User = Depends(require_roles("clinician")), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, patient_id)
    rows = db.scalars(select(ClinicalAssessment).where(ClinicalAssessment.patient_id == patient.id).order_by(ClinicalAssessment.encounter_at.desc())).all()
    return {"items": [{"id": x.id, "encounter_at": x.encounter_at, "temperature_c": x.temperature_c, "fever_duration_days": x.fever_duration_days, "symptoms": x.symptoms, "general_condition": x.general_condition, "notes": x.notes, "treatment_documentation": x.treatment_documentation, "admission_status": x.admission_status} for x in rows]}

@app.post("/api/v1/assessments", status_code=201, tags=["clinical"])
def create_assessment(body: AssessmentCreate, user: User = Depends(require_roles("clinician")), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, body.patient_id)
    payload = body.model_dump(); payload["patient_id"] = patient.id
    assessment = ClinicalAssessment(**payload, clinician_id=user.id); db.add(assessment); db.flush(); audit(db, user, "assessment.created", "assessment", assessment.id); db.commit(); return {"id": assessment.id}

@app.get("/api/v1/samples", tags=["pathology"])
def samples(patient_id: str | None = None, user: User = Depends(require_roles("pathology", "research_lab")), db: Session = Depends(get_db)):
    stmt = select(Sample).options(selectinload(Sample.tests)).order_by(Sample.collected_at.desc())
    if patient_id:
        patient = require_patient_scope(user, db, patient_id)
        stmt = stmt.where(Sample.patient_id == patient.id)
    return {"items": [sample_view(x) for x in db.scalars(stmt.limit(100)).all()]}

@app.post("/api/v1/samples", status_code=201, tags=["pathology"])
def create_sample(body: SampleCreate, user: User = Depends(require_roles("pathology")), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, body.patient_id)
    sample = Sample(sample_code="M3-S-" + uid().replace("-", "")[:8].upper(), patient_id=patient.id, specimen_type=body.specimen_type, status=body.result_status)
    db.add(sample); db.flush(); test = DiagnosticTest(sample_id=sample.id, method=body.method, result_status=body.result_status, species=body.species, smear_type=body.smear_type, operator_id=user.id, performed_at=now() if body.result_status != "pending" else None, notes=body.notes); db.add(test); audit(db, user, "sample.created", "sample", sample.id); db.commit(); return sample_view(sample)

@app.get("/api/v1/follow-ups", tags=["follow ups"])
def followups(queue: str = Query("all", pattern="^(all|due|overdue|completed)$"), user: User = Depends(require_roles("health_worker")), db: Session = Depends(get_db)):
    stmt = select(FollowUp).where(FollowUp.assigned_user_id == user.id).order_by(FollowUp.due_at)
    if queue == "due": stmt = stmt.where(FollowUp.status == "due", FollowUp.due_at >= now())
    elif queue == "overdue": stmt = stmt.where(FollowUp.status == "due", FollowUp.due_at < now())
    elif queue == "completed": stmt = stmt.where(FollowUp.status == "completed")
    rows = db.scalars(stmt).all(); return {"items": [{"id": x.id, "patient_id": x.patient_id, "due_at": x.due_at, "status": x.status, "adherence": x.adherence, "outcome": x.outcome, "notes": x.notes} for x in rows]}

@app.post("/api/v1/follow-ups", status_code=201, tags=["follow ups"])
def create_followup(body: FollowUpCreate, user: User = Depends(require_roles("health_worker")), db: Session = Depends(get_db)):
    patient = require_patient_scope(user, db, body.patient_id)
    data = body.model_dump()
    data["patient_id"] = patient.id
    if not data.get("assigned_user_id"):
        data["assigned_user_id"] = user.id
    followup = FollowUp(**data)
    if followup.status == "completed": followup.completed_at = now()
    db.add(followup); db.flush(); audit(db, user, "followup.created", "followup", followup.id); db.commit(); return {"id": followup.id}

@app.post("/api/v1/research-results", status_code=201, tags=["research laboratory"])
def create_research_result(body: MolecularCreate, user: User = Depends(require_roles("research_lab")), db: Session = Depends(get_db)):
    clean_sample = body.sample_id.strip()
    sample = db.get(Sample, clean_sample) or db.scalar(select(Sample).where(func.upper(Sample.sample_code) == clean_sample.upper()))
    if not sample: raise HTTPException(404, "Sample record not found")
    require_patient_scope(user, db, sample.patient_id)
    payload = body.model_dump(); payload["sample_id"] = sample.id
    result = MolecularResult(**payload, performed_by=user.id); db.add(result); db.flush(); audit(db, user, "research_result.created", "molecular_result", result.id); db.commit(); return {"id": result.id}

@app.get("/api/v1/dashboard", tags=["reports"])
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    roles = active_roles(user, db)
    if roles == {"worker"}:
        return {"scope": "own", "workers": 1 if user.patient_id else 0, "followups_due": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.patient_id == user.patient_id, FollowUp.status == "due")) or 0, "note": "Personal view; counts are not surveillance indicators."}
    if roles == {"contractor"}:
        site_ids = [x for x in db.scalars(select(RoleAssignment.scope_id).where(RoleAssignment.user_id == user.id, RoleAssignment.role == "contractor")).all() if x]
        workers = db.scalar(select(func.count(func.distinct(WorkerSiteAssignment.patient_id))).where(WorkerSiteAssignment.site_id.in_(site_ids or ["__none__"]), WorkerSiteAssignment.end_date.is_(None))) or 0
        return {"scope": "managed_sites", "workers": workers, "sites": len(site_ids), "note": "Roster totals only; clinical and research data are restricted."}
    return {"scope": "authorized_operational", "workers": db.scalar(select(func.count()).select_from(Patient)) or 0, "samples_pending": db.scalar(select(func.count()).select_from(Sample).where(Sample.status == "pending")) or 0, "tests_positive": db.scalar(select(func.count()).select_from(DiagnosticTest).where(DiagnosticTest.result_status == "positive")) or 0, "followups_due": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due")) or 0, "followups_overdue": db.scalar(select(func.count()).select_from(FollowUp).where(FollowUp.status == "due", FollowUp.due_at < now())) or 0, "note": "Synthetic operational counts. Not epidemiological rates."}
