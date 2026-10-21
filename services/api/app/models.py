import uuid
from datetime import date, datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, false as sa_false, text as sa_text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def uid() -> str:
    return str(uuid.uuid4())

def now() -> datetime:
    return datetime.now(timezone.utc)

class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)

class User(Timestamped, Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    phone_e164: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    pin_hash: Mapped[str] = mapped_column(String(255))
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    technical_provisioner: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # use_alter + name: users <-> patients circular FK pair must be ALTER-managed on PostgreSQL.
    patient_id: Mapped[str | None] = mapped_column(ForeignKey("patients.id", use_alter=True, name="fk_users_patient"), nullable=True)
    roles: Mapped[list["RoleAssignment"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    # Stable worker identity: a profile belongs to at most one account (partial unique
    # index; parity with migration 20261023_01). NULL for non-worker accounts.
    __table_args__ = (
        Index("uq_users_patient_id", patient_id, unique=True,
              postgresql_where=sa_text("patient_id IS NOT NULL"),
              sqlite_where=sa_text("patient_id IS NOT NULL")),
    )

class RoleAssignment(Timestamped, Base):
    __tablename__ = "role_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(32), index=True)
    scope_type: Mapped[str] = mapped_column(String(20), default="global")
    scope_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user: Mapped[User] = relationship(back_populates="roles")
    __table_args__ = (UniqueConstraint("user_id", "role", "scope_type", "scope_id", name="uq_role_scope"),)

class Facility(Timestamped, Base):
    __tablename__ = "facilities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    district: Mapped[str] = mapped_column(String(80))
    facility_type: Mapped[str] = mapped_column(String(30))

class Site(Timestamped, Base):
    __tablename__ = "sites"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    contractor_name: Mapped[str] = mapped_column(String(160))
    contractor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    district: Mapped[str] = mapped_column(String(80))
    area: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="active")
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)

class Patient(Timestamped, Base):
    __tablename__ = "patients"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_as_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    age_flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false())
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # Mobile is a searchable lookup attribute, never a primary identity key.
    phone_e164: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    alternate_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)
    id_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    id_other_details: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_present: Mapped[str | None] = mapped_column(String(400), nullable=True)
    address_permanent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    occupation: Mapped[str | None] = mapped_column(String(80), nullable=True)
    nativity: Mapped[str | None] = mapped_column(String(120), nullable=True)
    consent_status: Mapped[str] = mapped_column(String(20), default="pending")
    initial_symptoms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Offline-replay reconciliation identity: set by the creating account.
    # use_alter: patients <-> users form a circular FK pair (users.patient_id); the
    # named ALTER-managed constraint lets PostgreSQL drop/create in the right order.
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", use_alter=True, name="fk_patients_created_by"), nullable=True, index=True)
    # Parity with migration 20261021_01: unique partial index on the replay
    # identity so two concurrent request retries of the same offline worker can
    # never both insert (the application replay check alone cannot win the race).
    __table_args__ = (
        Index("uq_patients_client_request_id", client_request_id, unique=True,
              postgresql_where=sa_text("client_request_id IS NOT NULL")),
    )
    assignments: Mapped[list["WorkerSiteAssignment"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    travels: Mapped[list["TravelEvent"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    assessments: Mapped[list["ClinicalAssessment"]] = relationship(back_populates="patient")
    samples: Mapped[list["Sample"]] = relationship(back_populates="patient")
    followups: Mapped[list["FollowUp"]] = relationship(back_populates="patient")
    questionnaires: Mapped[list["QuestionnaireSubmission"]] = relationship(back_populates="patient", cascade="all, delete-orphan")

class QuestionnaireSubmission(Timestamped, Base):
    __tablename__ = "questionnaire_submissions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    state: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    respondent_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    patient: Mapped[Patient] = relationship(back_populates="questionnaires")

class WorkerSiteAssignment(Timestamped, Base):
    __tablename__ = "worker_site_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"), index=True)
    start_date: Mapped[str] = mapped_column(String(10))
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Contractor-reported status stays visibly separate from authoritative clinical/lab records.
    reported_malaria_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reported_treatment_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reported_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    client_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    __table_args__ = (
        Index("uq_worker_site_assignments_active_worker", patient_id, unique=True,
              postgresql_where=sa_text("end_date IS NULL"), sqlite_where=sa_text("end_date IS NULL")),
    )
    patient: Mapped[Patient] = relationship(back_populates="assignments")
    site: Mapped[Site] = relationship()

class TravelEvent(Timestamped, Base):
    __tablename__ = "travel_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    origin: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str | None] = mapped_column(String(120), nullable=True)
    arrival_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    departure_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    return_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    planned: Mapped[bool] = mapped_column(Boolean, default=False)
    patient: Mapped[Patient] = relationship(back_populates="travels")

class ClinicalAssessment(Timestamped, Base):
    __tablename__ = "clinical_assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"), nullable=True, index=True)
    clinician_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    encounter_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    medical_officer_name: Mapped[str | None] = mapped_column(String(140), nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    fever_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fever_duration_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    onset_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    symptoms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    red_flags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    comorbidities_list: Mapped[list | None] = mapped_column(JSON, nullable=True)
    comorbidities: Mapped[str | None] = mapped_column(Text, nullable=True)
    general_condition: Mapped[str | None] = mapped_column(String(80), nullable=True)
    systolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    diastolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    can_attend_testing: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_documentation: Mapped[str | None] = mapped_column(Text, nullable=True)
    admission_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    admission_species: Mapped[str | None] = mapped_column(String(30), nullable=True)
    admission_symptoms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    admission_severity: Mapped[str | None] = mapped_column(String(30), nullable=True)
    treatment_completed: Mapped[str | None] = mapped_column(String(30), nullable=True)
    treatment_incomplete_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    discharge_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    case_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    patient: Mapped[Patient] = relationship(back_populates="assessments")

class Sample(Timestamped, Base):
    __tablename__ = "samples"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    sample_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"), nullable=True, index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    case_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    specimen_type: Mapped[str] = mapped_column(String(60), default="blood")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    patient: Mapped[Patient] = relationship(back_populates="samples")
    tests: Mapped[list["DiagnosticTest"]] = relationship(back_populates="sample", cascade="all, delete-orphan")
    slide_followups: Mapped[list["SlideFollowUp"]] = relationship(back_populates="sample", cascade="all, delete-orphan")

class DiagnosticTest(Timestamped, Base):
    __tablename__ = "diagnostic_tests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    sample_id: Mapped[str] = mapped_column(ForeignKey("samples.id"), index=True)
    method: Mapped[str] = mapped_column(String(30))
    other_method_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    result_status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    species: Mapped[str | None] = mapped_column(String(30), nullable=True)
    species_other_note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    smear_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample: Mapped[Sample] = relationship(back_populates="tests")

class SlideFollowUp(Timestamped, Base):
    __tablename__ = "slide_follow_ups"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    sample_id: Mapped[str] = mapped_column(ForeignKey("samples.id"), index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    scheduled_day: Mapped[str | None] = mapped_column(String(20), nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    received: Mapped[str] = mapped_column(String(10), default="unknown")
    positive: Mapped[str | None] = mapped_column(String(10), nullable=True)
    positive_day: Mapped[str | None] = mapped_column(String(20), nullable=True)
    not_received_reason: Mapped[str | None] = mapped_column(String(60), nullable=True)
    other_reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    recorded_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    sample: Mapped[Sample] = relationship(back_populates="slide_followups")

class FollowUp(Timestamped, Base):
    __tablename__ = "follow_ups"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    assigned_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    scheduled_day: Mapped[str | None] = mapped_column(String(20), nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(30), default="due", index=True)
    case_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    adherence: Mapped[str | None] = mapped_column(String(40), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    patient: Mapped[Patient] = relationship(back_populates="followups")

class Case(Timestamped, Base):
    """Shared surveillance case: one lifecycle per health event.

    Links a symptom report (or future trigger) to the clinical assessment,
    diagnostic orders/results and follow-ups for the same health episode, so
    every role reads one consistent status. Serving multiple triggers keeps and
    routes via this record with stable identifiers (worker + case) — new
    workflows must reuse the case, never duplicate the worker profile.
    State machine lives in main.py CASE_TRANSITIONS; transitions are written
    only through authorized endpoints and are always journaled in CaseEvent.
    """
    __tablename__ = "cases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="submitted", index=True)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(24), default="symptom_report", index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    assigned_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    client_request_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)

class SymptomReport(Timestamped, Base):
    """Worker-initiated 'I feel unwell / need medical help' report (Phase 2).

    Deliberately minimal: every field is optional except at least one symptom,
    so a distressed worker can always request assistance. One report opens one
    case; client_request_id is the offline-replay idempotency key."""
    __tablename__ = "symptom_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), unique=True, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("sites.id"), nullable=True, index=True)
    location_note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    symptoms: Mapped[list] = mapped_column(JSON)
    onset_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    attend_facility: Mapped[str | None] = mapped_column(String(16), nullable=True)
    contact_pref: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    client_request_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    case: Mapped[Case] = relationship()

class CaseEvent(Timestamped, Base):
    """Journal of every authorized case transition (who, from, to, when, note)."""
    __tablename__ = "case_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40))
    actor_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

class Notification(Timestamped, Base):
    """Persisted, per-recipient case notification.

    Delivery here is authenticated in-app polling (no push provider configured
    in this deployment); a row is written transactionally with the case
    change, so reconnect/replay neverloses a notification. Bodies are GENERIC
    (never symptom details) for safe previews, per privacy policy."""
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    recipient_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    case_id: Mapped[str | None] = mapped_column(ForeignKey("cases.id"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(String(300))
    body_minimal: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=now)

class WorkerQrToken(Base):
    __tablename__ = "worker_qr_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    created_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class MolecularResult(Timestamped, Base):
    __tablename__ = "molecular_results"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    sample_id: Mapped[str] = mapped_column(ForeignKey("samples.id"), index=True)
    pcr_status: Mapped[str] = mapped_column(String(30), default="pending")
    species_confirmation: Mapped[str | None] = mapped_column(String(30), nullable=True)
    parasite_density: Mapped[float | None] = mapped_column(Float, nullable=True)
    parasite_density_unit: Mapped[str | None] = mapped_column(String(40), nullable=True)
    gametocyte_presence: Mapped[str] = mapped_column(String(30), default="not_tested")
    resistance_markers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pfhrp2_status: Mapped[str] = mapped_column(String(30), default="not_tested")
    pfhrp3_status: Mapped[str] = mapped_column(String(30), default="not_tested")
    performed_by: Mapped[str] = mapped_column(ForeignKey("users.id"))

class Session(Timestamped, Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)

Index("ix_assignment_site_current", WorkerSiteAssignment.site_id, WorkerSiteAssignment.end_date)
