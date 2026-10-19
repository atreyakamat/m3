import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
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
    patient_id: Mapped[str | None] = mapped_column(ForeignKey("patients.id"), nullable=True)
    roles: Mapped[list["RoleAssignment"]] = relationship(back_populates="user", cascade="all, delete-orphan")

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
    district: Mapped[str] = mapped_column(String(80))
    area: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="active")

class Patient(Timestamped, Base):
    __tablename__ = "patients"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    occupation: Mapped[str | None] = mapped_column(String(80), nullable=True)
    nativity: Mapped[str | None] = mapped_column(String(120), nullable=True)
    consent_status: Mapped[str] = mapped_column(String(20), default="pending")
    initial_symptoms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    assignments: Mapped[list["WorkerSiteAssignment"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    travels: Mapped[list["TravelEvent"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    assessments: Mapped[list["ClinicalAssessment"]] = relationship(back_populates="patient")
    samples: Mapped[list["Sample"]] = relationship(back_populates="patient")
    followups: Mapped[list["FollowUp"]] = relationship(back_populates="patient")

class WorkerSiteAssignment(Timestamped, Base):
    __tablename__ = "worker_site_assignments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    site_id: Mapped[str] = mapped_column(ForeignKey("sites.id"), index=True)
    start_date: Mapped[str] = mapped_column(String(10))
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    patient: Mapped[Patient] = relationship(back_populates="assignments")
    site: Mapped[Site] = relationship()

class TravelEvent(Timestamped, Base):
    __tablename__ = "travel_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    origin: Mapped[str] = mapped_column(String(120))
    destination: Mapped[str | None] = mapped_column(String(120), nullable=True)
    arrival_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    patient: Mapped[Patient] = relationship(back_populates="travels")

class ClinicalAssessment(Timestamped, Base):
    __tablename__ = "clinical_assessments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id"), nullable=True, index=True)
    clinician_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    encounter_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    fever_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    symptoms: Mapped[list | None] = mapped_column(JSON, nullable=True)
    comorbidities: Mapped[str | None] = mapped_column(Text, nullable=True)
    general_condition: Mapped[str | None] = mapped_column(String(80), nullable=True)
    systolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    diastolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_documentation: Mapped[str | None] = mapped_column(Text, nullable=True)
    admission_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    patient: Mapped[Patient] = relationship(back_populates="assessments")

class Sample(Timestamped, Base):
    __tablename__ = "samples"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    sample_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    specimen_type: Mapped[str] = mapped_column(String(60), default="blood")
    status: Mapped[str] = mapped_column(String(30), default="pending")
    patient: Mapped[Patient] = relationship(back_populates="samples")
    tests: Mapped[list["DiagnosticTest"]] = relationship(back_populates="sample", cascade="all, delete-orphan")

class DiagnosticTest(Timestamped, Base):
    __tablename__ = "diagnostic_tests"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    sample_id: Mapped[str] = mapped_column(ForeignKey("samples.id"), index=True)
    method: Mapped[str] = mapped_column(String(30))
    result_status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    species: Mapped[str | None] = mapped_column(String(30), nullable=True)
    smear_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    performed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample: Mapped[Sample] = relationship(back_populates="tests")

class FollowUp(Timestamped, Base):
    __tablename__ = "follow_ups"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.id"), index=True)
    assigned_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[str] = mapped_column(String(30), default="due", index=True)
    adherence: Mapped[str | None] = mapped_column(String(40), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    patient: Mapped[Patient] = relationship(back_populates="followups")

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
