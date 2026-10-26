from datetime import datetime
from pydantic import BaseModel, Field, field_validator

# Provisionable roles include the PRD's seven roles; `pathology` remains accepted
# for backward compatibility with pre-existing accounts.
ROLES = {
    "worker", "contractor", "pathologist", "pathology", "clinician",
    "health_worker", "research_lab", "admin",
}
TEST_RESULTS = {"pending", "positive", "negative", "indeterminate", "cancelled"}
SPECIES = {"pf", "pv", "mixed", "other", "undetermined"}
RESEARCH_STATUS = {"not_tested", "pending", "inconclusive", "detected", "not_detected"}
DIAGNOSTIC_METHODS = {"rdt", "microscopy", "smp", "other"}
SLIDE_REASONS = {"patient_unavailable", "left_goa_migrated", "refused", "slide_broken_spoiled",
                 "not_collected_by_worker", "other"}
REPORTED_MALARIA = {"not_reported", "pv", "pf", "pv_pf", "other"}
REPORTED_TREATMENT = {"not_reported", "treated", "untreated"}

class LoginIn(BaseModel):
    phone: str = Field(min_length=8, max_length=24)
    pin: str = Field(pattern=r"^\d{4,12}$")

class SignupIn(BaseModel):
    phone: str = Field(min_length=8, max_length=24)
    pin: str = Field(pattern=r"^\d{4,12}$")
    display_name: str = Field(min_length=1, max_length=120)
    role: str = Field(default="worker")
    preferred_language: str = Field(default="en", pattern=r"^(en|hi)$")

    @field_validator("role")
    @classmethod
    def role_is_known(cls, value):
        if value not in ROLES:
            raise ValueError(f"Unknown role: {value}")
        return value

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: dict

class ProvisionIn(BaseModel):
    phone: str
    pin: str = Field(pattern=r"^\d{4,12}$")
    display_name: str = Field(min_length=1, max_length=120)
    roles: list[str] = Field(min_length=1, max_length=7)
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
    dob: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    age_years: int | None = Field(default=None, ge=0, le=120)
    gender: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=24)
    mobile: str | None = Field(default=None, max_length=24)
    alternate_contact: str | None = Field(default=None, max_length=120)
    id_type: str | None = Field(default=None, pattern=r"^(?i)(aadhaar|voter_id|voter id|other)$")
    id_other_details: str | None = Field(default=None, max_length=200)
    address_present: str | None = Field(default=None, max_length=400)
    address_permanent: str | None = Field(default=None, max_length=400)
    present_address: str | None = Field(default=None, max_length=400)
    permanent_address: str | None = Field(default=None, max_length=400)
    preferred_language: str = Field(default="en", max_length=30)
    occupation: str | None = Field(default=None, max_length=80)
    nativity: str | None = Field(default=None, max_length=120)
    consent_status: str = Field(default="pending", pattern=r"^(pending|documented|withdrawn)$")
    initial_symptoms: list[str] = Field(default_factory=list, max_length=20)
    site_id: str | None = Field(default=None, description="Optional; a worker profile may exist without site assignment")
    travel_origin: str | None = Field(default=None, max_length=120)
    # Offline queue reconciliation: repeated deliveries return the same profile, no duplicates.
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    travel_arrival_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

class AssessmentCreate(BaseModel):
    patient_id: str
    facility_id: str | None = None
    case_id: str | None = None
    medical_officer_name: str | None = Field(default=None, max_length=140)
    temperature_c: float | None = Field(default=None, ge=25, le=45)
    fever_duration_days: int | None = Field(default=None, ge=0, le=365)
    fever_duration_category: str | None = Field(default=None, pattern=r"^(<24h|1_3_days|4_7_days|>7_days)$")
    onset_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    symptoms: list[str] = Field(default_factory=list, max_length=20)
    symptoms_other_note: str | None = Field(default=None, max_length=200,
        description="Source questionnaire 'Others (specify)' free text for encounter symptoms")
    red_flags: list[str] = Field(default_factory=list, max_length=10)
    comorbidities: str | None = Field(default=None, max_length=2000)
    comorbidities_list: list[str] = Field(default_factory=list, max_length=20)
    general_condition: str | None = Field(default=None, max_length=80)
    systolic_bp: int | None = Field(default=None, ge=30, le=300)
    diastolic_bp: int | None = Field(default=None, ge=20, le=200)
    can_attend_testing: str | None = Field(default=None, pattern=r"^(yes|no|not_required)$")
    notes: str | None = Field(default=None, max_length=4000)
    treatment_documentation: str | None = Field(default=None, max_length=2000, description="Documented plan only; no treatment decision support")
    admission_status: str | None = Field(default=None, max_length=40)
    admission_species: str | None = None
    admission_species_other_note: str | None = Field(default=None, max_length=200,
        description="Source questionnaire 'Other' species free text at admission")
    admission_symptoms: list[str] = Field(default_factory=list, max_length=20)
    admission_severity: str | None = Field(default=None, pattern=r"^(mild|severe)$")
    # Source questionnaire: Yes (full course) / No (still on treatment) /
    # No (stopped early) / Referred to District or GMC.  Legacy codes
    # yes|no|not_applicable remain valid for backward compatibility.
    treatment_completed: str | None = Field(
        default=None, pattern=r"^(yes|no|not_applicable|no_still_on_treatment|no_stopped_early|referred_district_gmc)$")
    treatment_incomplete_reason: str | None = Field(default=None, max_length=500)
    discharge_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    outcome: str | None = Field(default=None, max_length=100)
    remarks: str | None = Field(default=None, max_length=4000)
    # Source questionnaire page 5, "IF ADMITTED = NO": treatment given and
    # health-worker follow-up assignment are recorded as explicit flags.
    treatment_given: str | None = Field(default=None, max_length=10, pattern=r"^(yes|no)$")
    follow_up_assigned: str | None = Field(default=None, max_length=10, pattern=r"^(yes|no)$")
    re_screening_reason: str | None = Field(default=None, max_length=1000,
        description="Required when the worker has already completed routine screening")

class SampleCreate(BaseModel):
    patient_id: str
    facility_id: str | None = None
    case_id: str | None = None
    specimen_type: str = Field(default="blood", max_length=60)
    method: str
    other_method_note: str | None = Field(default=None, max_length=500)
    result_status: str = Field(default="pending")
    species: str | None = None
    species_other_note: str | None = Field(default=None, max_length=200)
    smear_type: str | None = Field(default=None, max_length=30)
    notes: str | None = Field(default=None, max_length=2000)
    client_request_id: str | None = Field(default=None, max_length=64)

    @field_validator("method")
    @classmethod
    def method_value(cls, value):
        if value not in DIAGNOSTIC_METHODS: raise ValueError("Unsupported test method")
        return value
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
    @field_validator("smear_type")
    @classmethod
    def smear_value(cls, value):
        if value is not None and value not in ("thick", "thin", "both", "not_applicable"):
            raise ValueError("Unsupported smear type")
        return value

class SlideFollowUpSave(BaseModel):
    scheduled_day: str | None = Field(default=None, max_length=20)
    due_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    received: str = Field(pattern=r"^(yes|no)$")
    positive: str | None = Field(default=None, pattern=r"^(yes|no)$")
    positive_day: str | None = Field(default=None, max_length=20)
    not_received_reason: str | None = None
    other_reason: str | None = Field(default=None, max_length=300)
    # Optimistic concurrency guard (P3)
    base_updated_at: datetime | None = None

    @field_validator("not_received_reason")
    @classmethod
    def reason_value(cls, value):
        if value is not None and value not in SLIDE_REASONS:
            raise ValueError("Unsupported not-received reason")
        return value

class FollowUpCreate(BaseModel):
    patient_id: str
    assigned_user_id: str | None = None
    case_id: str | None = None
    due_at: datetime
    status: str = Field(default="due", pattern=r"^(due|completed|cancelled|missed)$")
    adherence: str | None = Field(default=None, max_length=40)
    outcome: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    scheduled_day: str | None = Field(default=None, max_length=20)


class FollowUpUpdate(BaseModel):
    """Health Worker may only update allowed completion/adherence fields."""
    model_config = {"extra": "forbid"}  # assignment/ownership/linkage fields are immutable -> 422
    status: str | None = Field(default=None, pattern=r"^(due|completed|cancelled|missed)$")
    adherence: str | None = Field(default=None, max_length=40)
    outcome: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    # Optimistic concurrency guard
    base_updated_at: datetime | None = None

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
    code: str | None = Field(default=None, min_length=2, max_length=32, pattern=r"^[A-Za-z0-9-]+$")
    name: str = Field(min_length=2, max_length=160)
    contractor_name: str | None = Field(default=None, max_length=160)
    district: str = Field(min_length=2, max_length=80)
    area: str = Field(min_length=2, max_length=80)
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")

class SiteWorkerAssignIn(BaseModel):
    qr_token: str | None = Field(default=None, max_length=64)
    worker_id: str | None = Field(default=None, max_length=64)
    client_request_id: str | None = Field(default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    confirm_transfer: bool = False

class QuestionnaireSave(BaseModel):
    data: dict

class QuestionnaireSubmitIn(BaseModel):
    data: dict
    client_request_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")

class MembershipCreate(BaseModel):
    site_id: str
    patient_id: str | None = None
    qr_token: str | None = None

class TravelEpisodeCreate(BaseModel):
    origin: str | None = Field(default=None, max_length=120)
    destination: str | None = Field(default=None, max_length=120)
    departure_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    return_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    arrival_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned: bool = False

class ReportedStatusIn(BaseModel):
    malaria_status: str = Field(pattern=r"^(not_reported|pv|pf|pv_pf|other|none|unknown)$")
    treatment_status: str = Field(pattern=r"^(not_reported|treated|untreated|unknown)$")
    # Optimistic concurrency guard (P3): reject stale overwrites with 409.
    base_updated_at: datetime | None = None
