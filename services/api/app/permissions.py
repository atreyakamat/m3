"""Server-side permission policy: role -> resource -> action -> scope.

Single source of truth for authorization decisions.  Route handlers must not
make ad-hoc role checks; they call the predicates here so the matrix stays
auditable (PRD 3, 9, 10; AUTH-001..005).
"""

# Role vocabulary used by account provisioning, policy, and clients.
ROLES = ("worker", "contractor", "pathologist", "clinician", "health_worker", "research_lab", "admin")

# Only Admin remains fully read-only. Health Worker and Research Lab have
# narrowly scoped writes (follow-up updates / molecular results) implemented in
# can_write() below; they are deliberately NOT general-purpose writers.
READ_ONLY_ROLES = frozenset({"admin"})

# Legacy role identifier found in the pre-existing schema/seed data.
_LEGACY_PATHOLOGIST = "pathology"

# Preliminary Research Lab eligibility rule (stakeholder-approved direction):
# a positive RDT OR a positive microscopy result qualifies. SMP is deliberately
# excluded pending lab-owner confirmation. Pending, indeterminate, cancelled,
# negative and missing results never qualify.
RESEARCH_ELIGIBLE_METHODS = ("rdt", "microscopy")
RESEARCH_ELIGIBLE_RESULT = "positive"

def effective_roles(active: set[str]) -> set[str]:
    roles = set(active)
    if _LEGACY_PATHOLOGIST in roles:
        roles.add("pathologist")
    return roles

def is_read_only(active_roles: set[str]) -> bool:
    roles = effective_roles(active_roles)
    return bool(roles) and roles <= READ_ONLY_ROLES | {_LEGACY_PATHOLOGIST}

def contractor_site_ids(db, user):
    """Sites authorized to a contractor account: explicit scope grants plus owned sites."""
    from sqlalchemy import select
    from .models import RoleAssignment, Site
    scoped = set(db.scalars(
        select(RoleAssignment.scope_id).where(
            RoleAssignment.user_id == user.id,
            RoleAssignment.role.in_(("contractor",)),
            RoleAssignment.revoked_at.is_(None),
        )).all())
    owned = set(db.scalars(select(Site.id).where(Site.contractor_user_id == user.id)).all())
    return scoped | owned

def worker_ids_at_sites(db, site_ids, only_active=True):
    from sqlalchemy import select
    from .models import WorkerSiteAssignment
    if not site_ids:
        return set()
    stmt = select(WorkerSiteAssignment.patient_id).where(WorkerSiteAssignment.site_id.in_(site_ids))
    if only_active:
        stmt = stmt.where(WorkerSiteAssignment.end_date.is_(None))
    return set(db.scalars(stmt).all())

def assigned_followup_patient_ids(db, user):
    from sqlalchemy import select
    from .models import FollowUp
    return set(db.scalars(
        select(FollowUp.patient_id).where(FollowUp.assigned_user_id == user.id)).all())

def eligible_research_sample_ids(db):
    """Sample ids with at least one positive RDT or microscopy result."""
    from sqlalchemy import select
    from .models import DiagnosticTest
    return set(db.scalars(
        select(DiagnosticTest.sample_id).where(
            DiagnosticTest.method.in_(RESEARCH_ELIGIBLE_METHODS),
            DiagnosticTest.result_status == RESEARCH_ELIGIBLE_RESULT,
        )).all())

def patient_is_research_eligible(db, patient_id) -> bool:
    """True only when the worker has an eligible positive sample.

    Enforced on every Research Lab read path (lists and direct-by-id), so a
    negative/pending/indeterminate worker cannot be reached by guessing an id.
    """
    from sqlalchemy import select
    from .models import Sample
    return db.scalar(
        select(Sample.id).where(
            Sample.patient_id == patient_id,
            Sample.id.in_(eligible_research_sample_ids(db) or {"__none__"}),
        ).limit(1)) is not None

def sample_is_research_eligible(db, sample_id) -> bool:
    from sqlalchemy import select
    from .models import DiagnosticTest
    return db.scalar(
        select(DiagnosticTest.id).where(
            DiagnosticTest.sample_id == sample_id,
            DiagnosticTest.method.in_(RESEARCH_ELIGIBLE_METHODS),
            DiagnosticTest.result_status == RESEARCH_ELIGIBLE_RESULT,
        ).limit(1)) is not None

def can_read_patient(db, user, patient, roles):  # roles: effective role set
    if "admin" in roles or "clinician" in roles or "pathologist" in roles:
        return True
    if "worker" in roles:
        return user.patient_id == patient.id
    if "contractor" in roles:
        return patient.id in worker_ids_at_sites(db, contractor_site_ids(db, user))
    if "health_worker" in roles:
        return patient.id in assigned_followup_patient_ids(db, user)
    if "research_lab" in roles:
        # Research Lab reaches ONLY eligible positive cases; field filtering is
        # applied by the explicit response allowlists in main.py.
        return patient_is_research_eligible(db, patient.id)
    return False

def can_write(data_kind, roles):
    """data_kind in: questionnaire, clinical, lab, membership, contractor_status,
    travel, followup_assign, followup_update, research, site."""
    roles = effective_roles(roles)
    if "clinician" in roles:
        return data_kind in {"clinical", "travel", "followup_assign", "followup_update", "qr"}
    if "pathologist" in roles:
        return data_kind == "lab"
    if "contractor" in roles:
        return data_kind in {"membership", "contractor_status", "travel", "site"}
    if "worker" in roles:
        return data_kind in {"questionnaire", "qr"}
    if "health_worker" in roles:
        # Only the assigned follow-up's completion fields; never creation,
        # assignment, clinical or lab writes.
        return data_kind == "followup_update"
    if "research_lab" in roles:
        # Only molecular results for eligible positive samples.
        return data_kind == "research"
    return False
