from datetime import datetime
from pydantic import BaseModel, Field, field_validator

ROLES = {"worker", "clinician", "pathology", "health_worker", "research_lab", "contractor"}
TEST_RESULTS = {"pending", "positive", "negative", "indeterminate", "cancelled"}
SPECIES = {"pf", "pv", "mixed", "other", "undetermined"}
RESEARCH_STATUS = {"not_tested", "pending", "inconclusive", "detected", "not_detected"}

class LoginIn(BaseModel):
    phone: str = Field(min_length=8, max_length=24)
    pin: str = Field(pattern=r"^\d{4,12}$")

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: dict

class ProvisionIn(BaseModel):
    phone: str
    pin: str = Field(pattern=r"^\d{4,12}$")
    display_name: str = Field(min_length=1, max_length=120)
    roles: list[str] = Field(min_length=1, max_length=6)
    preferred_language: str = Field(default="en", pattern=r"^(en|hi)$")
    technical_provisioner: bool = False

    @field_validator("roles")
    @classmethod
    def roles_are_known(cls, values):
        if unknown := set(values) - ROLES:
            raise ValueError(f"Unknown role: {', '.join(sorted(unknown))}")
        return values

class WorkerCreate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120, description="Minimum necessary display name; no government identifier")
    age_years: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = Field(default=None, max_length=30)
    preferred_language: str = Field(default="en", pattern=r"^(en|hi)$")
    occupation: str | None = Field(default=None, max_length=80)
    nativity: str | None = Field(default=None, max_length=120)
    consent_status: str = Field(default="pending", pattern=r"^(pending|documented|withdrawn)$")
    initial_symptoms: list[str] = Field(default_factory=list, max_length=20)
    site_id: str
    travel_origin: str | None = Field(default=None, max_length=120)
    travel_arrival_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

class AssessmentCreate(BaseModel):
    patient_id: str
    facility_id: str | None = None
    temperature_c: float | None = Field(default=None, ge=25, le=45)
    fever_duration_days: int | None = Field(default=None, ge=0, le=365)
    symptoms: list[str] = Field(default_factory=list, max_length=20)
    comorbidities: str | None = Field(default=None, max_length=2000)
    general_condition: str | None = Field(default=None, max_length=80)
    systolic_bp: int | None = Field(default=None, ge=30, le=300)
    diastolic_bp: int | None = Field(default=None, ge=20, le=200)
    notes: str | None = Field(default=None, max_length=4000)
    treatment_documentation: str | None = Field(default=None, max_length=2000, description="Documented plan only; no treatment decision support")
    admission_status: str | None = Field(default=None, max_length=40)

class SampleCreate(BaseModel):
    patient_id: str
    specimen_type: str = Field(default="blood", max_length=60)
    method: str = Field(pattern=r"^(rdt|microscopy)$")
    result_status: str = Field(default="pending")
    species: str | None = None
    smear_type: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("result_status")
    @classmethod
    def test_status(cls, value):
        if value not in TEST_RESULTS: raise ValueError("Unsupported result status")
        return value
    @field_validator("species")
    @classmethod
    def species_value(cls, value):
        if value is not None and value not in SPECIES: raise ValueError("Unsupported species")
        return value

class FollowUpCreate(BaseModel):
    patient_id: str
    assigned_user_id: str | None = None
    due_at: datetime
    status: str = Field(default="due", pattern=r"^(due|completed|cancelled|missed)$")
    adherence: str | None = Field(default=None, max_length=40)
    outcome: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)

class MolecularCreate(BaseModel):
    sample_id: str
    pcr_status: str = "pending"
    species_confirmation: str | None = None
    parasite_density: float | None = Field(default=None, ge=0)
    parasite_density_unit: str | None = Field(default=None, max_length=40)
    gametocyte_presence: str = "not_tested"
    resistance_markers: dict | None = None
    pfhrp2_status: str = "not_tested"
    pfhrp3_status: str = "not_tested"

    @field_validator("pcr_status", "gametocyte_presence", "pfhrp2_status", "pfhrp3_status")
    @classmethod
    def research_state(cls, value):
        if value not in RESEARCH_STATUS: raise ValueError("Unsupported research result state")
        return value
    @field_validator("species_confirmation")
    @classmethod
    def research_species(cls, value):
        if value is not None and value not in SPECIES: raise ValueError("Unsupported species")
        return value

class SiteCreate(BaseModel):
    code: str = Field(min_length=2, max_length=32, pattern=r"^[A-Za-z0-9-]+$")
    name: str = Field(min_length=2, max_length=160)
    contractor_name: str = Field(min_length=2, max_length=160)
    district: str = Field(min_length=2, max_length=80)
    area: str = Field(min_length=2, max_length=80)
