"""Server-side surveillance analytics (read-only, aggregate + pseudonymized record drill-down).

Everything here is computed by parameterized SQL over the operational tables; nothing is
inferred. Where the schema does not store a value (client capture time, source channel,
sync state) the API says so under `provenance.gaps` instead of guessing.

Units of analysis are kept separate and labelled: TESTS (diagnostic_tests rows),
CASES (cases rows), PEOPLE (distinct patients) and SYMPTOM REPORTS. A positive test is
never presented as a unique malaria case.

Access policy (draft, pending privacy review): admin, research_lab, clinician and
pathologist only. Contractors, workers and health workers are refused at the API, not
just hidden in a client. All routes are GET (read-only) apart from audit rows appended
for record-level views and exports. Record references are pseudonymous: the worker
reference is a keyed hash, never a name, phone, ID number or clinical note.
"""
import csv
import hashlib
import hmac
import io
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, case, exists, func, literal, or_, select
from sqlalchemy.orm import Session, aliased

from .config import get_settings
from .database import get_db
from .models import (Case, DiagnosticTest, Facility, FollowUp, Patient, RoleAssignment, Sample, Site,
                     SlideFollowUp, SymptomReport, User, WorkerSiteAssignment, AuditEvent, now)
from .security import audit, require_roles

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

ANALYTICS_ROLES = ("admin", "research_lab", "clinician", "pathologist", "pathology")
KNOWN_RESULTS = ("positive", "negative", "pending", "indeterminate", "cancelled")
KNOWN_METHODS = ("rdt", "microscopy", "smp", "other")
KNOWN_SPECIES = ("pf", "pv", "mixed", "other", "undetermined")
COMPLETED_RESULTS = ("positive", "negative")           # denominator of the positive rate
EXPORT_MAX_ROWS = 20000
TIMEZONE = "UTC"

require_analytics = require_roles(*ANALYTICS_ROLES)


def _case_statuses():
    from .main import CASE_STATUSES  # lazy: main imports this module
    return CASE_STATUSES


# ------------------------------------------------------------------ filters

class Filters:
    """Validated query filters shared by every endpoint so all views agree."""

    def __init__(
        self,
        date_from: date | None = Query(None, description="Inclusive UTC start date"),
        date_to: date | None = Query(None, description="Inclusive UTC end date"),
        date_basis: str = Query("received", pattern="^(received|event)$"),
        district: str | None = Query(None, max_length=80),
        site_id: str | None = Query(None, max_length=36),
        facility_id: str | None = Query(None, max_length=36),
        method: str | None = Query(None, pattern="^(rdt|microscopy|smp|other)$"),
        result_status: str | None = Query(None, pattern="^[a-z_]{1,30}$"),
        species: str | None = Query(None, pattern="^[a-z_]{1,30}$"),
        case_status: str | None = Query(None, pattern="^[a-z_]{1,40}$"),
    ):
        if date_from and date_to and date_from > date_to:
            raise HTTPException(422, "date_from must not be after date_to")
        self.date_from, self.date_to, self.date_basis = date_from, date_to, date_basis
        self.district, self.site_id, self.facility_id = district, site_id, facility_id
        self.method, self.result_status, self.species, self.case_status = method, result_status, species, case_status
        self.start = datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc) if date_from else None
        self.end = (datetime(date_to.year, date_to.month, date_to.day, tzinfo=timezone.utc) + timedelta(days=1)) if date_to else None

    def applied(self) -> dict:
        return {k: (v.isoformat() if isinstance(v, date) else v) for k, v in {
            "date_from": self.date_from, "date_to": self.date_to, "date_basis": self.date_basis,
            "district": self.district, "site_id": self.site_id, "facility_id": self.facility_id,
            "method": self.method, "result_status": self.result_status, "species": self.species,
            "case_status": self.case_status}.items() if v is not None}

    def range(self, col):
        conds = []
        if self.start is not None:
            conds.append(col >= self.start)
        if self.end is not None:
            conds.append(col < self.end)
        return conds


def _pseudo(patient_id: str | None) -> str | None:
    if not patient_id:
        return None
    digest = hmac.new(get_settings().jwt_secret.encode(), patient_id.encode(), hashlib.sha256).hexdigest()
    return "W-" + digest[:12].upper()


def _day(db: Session, col):
    """UTC calendar-day bucket that works on SQLite and PostgreSQL."""
    if db.bind.dialect.name == "postgresql":
        return func.date(func.timezone("UTC", col))
    return func.date(col)


def _seconds_between(db: Session, later, earlier):
    if db.bind.dialect.name == "postgresql":
        return func.extract("epoch", later - earlier)
    return (func.julianday(later) - func.julianday(earlier)) * 86400.0


# ------------------------------------------------------------------ base queries

def _tests_from(stmt):
    return (stmt.select_from(DiagnosticTest)
            .join(Sample, Sample.id == DiagnosticTest.sample_id)
            .outerjoin(Facility, Facility.id == Sample.facility_id)
            .outerjoin(Case, Case.id == Sample.case_id)
            .outerjoin(Site, Site.id == Case.site_id))


def _district_expr():
    # Where the test happened: the testing facility's district, else the linked case's site district.
    return func.coalesce(Facility.district, Site.district)


def _test_conditions(f: Filters):
    c = []
    c += f.range(DiagnosticTest.performed_at if f.date_basis == "event" else DiagnosticTest.created_at)
    if f.district: c.append(_district_expr() == f.district)
    if f.site_id: c.append(Case.site_id == f.site_id)
    if f.facility_id: c.append(Sample.facility_id == f.facility_id)
    if f.method: c.append(DiagnosticTest.method == f.method)
    if f.result_status: c.append(DiagnosticTest.result_status == f.result_status)
    if f.species: c.append(DiagnosticTest.species == f.species)
    if f.case_status: c.append(Case.status == f.case_status)
    return c


def _cases_from(stmt):
    return (stmt.select_from(Case)
            .outerjoin(Site, Site.id == Case.site_id)
            .outerjoin(SymptomReport, SymptomReport.case_id == Case.id))


def _case_conditions(f: Filters):
    c = []
    c += f.range(SymptomReport.reported_at if f.date_basis == "event" else Case.created_at)
    if f.district: c.append(Site.district == f.district)
    if f.site_id: c.append(Case.site_id == f.site_id)
    if f.case_status: c.append(Case.status == f.case_status)
    return c


def _worker_conditions(f: Filters):
    c = list(f.range(Patient.created_at))
    if f.site_id or f.district:
        sub = select(WorkerSiteAssignment.patient_id).join(Site, Site.id == WorkerSiteAssignment.site_id)
        if f.site_id: sub = sub.where(WorkerSiteAssignment.site_id == f.site_id)
        if f.district: sub = sub.where(Site.district == f.district)
        c.append(Patient.id.in_(sub))
    return c


def _report_conditions(f: Filters):
    c = []
    c += f.range(SymptomReport.reported_at if f.date_basis == "event" else SymptomReport.created_at)
    if f.district: c.append(Site.district == f.district)
    if f.site_id: c.append(SymptomReport.site_id == f.site_id)
    if f.case_status: c.append(Case.status == f.case_status)
    return c


def _followup_conditions(f: Filters):
    c = []
    c += f.range(FollowUp.due_at if f.date_basis == "event" else FollowUp.created_at)
    if f.district: c.append(Site.district == f.district)
    if f.site_id: c.append(Case.site_id == f.site_id)
    if f.case_status: c.append(Case.status == f.case_status)
    return c


def _bucket(rows, known):
    """rows: (value, n). Known vocabulary first; anything else is reported as `unmapped`, never merged."""
    out = {k: 0 for k in known}
    unmapped: dict = {}
    for value, n in rows:
        if value in out:
            out[value] += n
        else:
            unmapped[str(value)] = unmapped.get(str(value), 0) + n
    return out, unmapped


# ------------------------------------------------------------------ data-quality catalogue

def _test_checks():
    dup = aliased(DiagnosticTest)
    return {
        "test_unmapped_result_status": dict(
            label="Result status outside the recognised vocabulary", severity="high",
            expr=DiagnosticTest.result_status.notin_(KNOWN_RESULTS),
            remediation="Review the record; correct via the pathology workflow. Not auto-repaired.", safe=False),
        "test_unmapped_method": dict(
            label="Test method outside the recognised vocabulary", severity="high",
            expr=DiagnosticTest.method.notin_(KNOWN_METHODS),
            remediation="Review and correct the method.", safe=False),
        "test_positive_missing_species": dict(
            label="Positive result with no species recorded", severity="medium",
            expr=and_(DiagnosticTest.result_status == "positive", DiagnosticTest.species.is_(None)),
            remediation="Pathologist to record species or 'undetermined'. Absence is NOT treated as 'undetermined'.", safe=False),
        "test_species_on_non_positive": dict(
            label="Species recorded on a result that is not positive", severity="medium",
            expr=and_(DiagnosticTest.species.is_not(None), DiagnosticTest.result_status != "positive"),
            remediation="Clinical/lab review: either the result or the species is wrong.", safe=False),
        "test_completed_without_performed_at": dict(
            label="Completed result with no performed timestamp", severity="medium",
            expr=and_(DiagnosticTest.result_status.in_(("positive", "negative", "indeterminate")), DiagnosticTest.performed_at.is_(None)),
            remediation="Investigate how the result was recorded.", safe=False),
        "test_timestamp_out_of_range": dict(
            label="Performed time in the future or before sample collection", severity="medium",
            expr=or_(DiagnosticTest.performed_at > now() + timedelta(minutes=5), DiagnosticTest.performed_at < Sample.collected_at),
            remediation="Check clock/entry errors; correct through an audited edit.", safe=False),
        "test_unlinked_to_case": dict(
            label="Test not linked to a case", severity="medium",
            expr=Sample.case_id.is_(None),
            remediation="Link to the correct case through the clinical workflow (human decision).", safe=False),
        "test_broken_case_link": dict(
            label="Sample points at a case that does not exist", severity="high",
            expr=and_(Sample.case_id.is_not(None), Case.id.is_(None)),
            remediation="samples.case_id has no foreign key; find the intended case or clear the link by audited edit.", safe=False),
        "test_case_worker_mismatch": dict(
            label="Sample's worker differs from the linked case's worker", severity="high",
            expr=and_(Case.id.is_not(None), Case.patient_id != Sample.patient_id),
            remediation="Identity/linkage review before any correction.", safe=False),
        "test_missing_facility": dict(
            label="No testing facility recorded", severity="low",
            expr=Sample.facility_id.is_(None),
            remediation="Record the facility on the sample.", safe=False),
        "test_missing_site": dict(
            label="No site resolvable (unlinked, or linked case has no site)", severity="low",
            expr=Case.site_id.is_(None),
            remediation="Resolved when the case is linked and the worker's site is known.", safe=False),
        "test_potential_duplicate": dict(
            label="Another test with the same sample and method exists", severity="medium",
            expr=exists().where(dup.sample_id == DiagnosticTest.sample_id, dup.method == DiagnosticTest.method, dup.id != DiagnosticTest.id),
            remediation="Review whether it is a legitimate repeat or a duplicate entry. Never auto-merged.", safe=False),
    }


def _case_checks():
    statuses = _case_statuses()
    return {
        "case_unknown_status": dict(
            label="Case status not in the lifecycle definition", severity="high",
            expr=Case.status.notin_(statuses),
            remediation="Review; do not remap automatically.", safe=False),
        "case_missing_site": dict(
            label="Case has no site", severity="low",
            expr=Case.site_id.is_(None),
            remediation="Record the site where known.", safe=False),
        "case_lifecycle_inconsistent": dict(
            label="closed_at and status disagree", severity="medium",
            expr=or_(and_(Case.status == "closed", Case.closed_at.is_(None)),
                     and_(Case.status != "closed", Case.closed_at.is_not(None))),
            remediation="Review the case journal.", safe=False),
        "case_awaiting_test_without_sample": dict(
            label="Status says a diagnostic test is pending but no sample is linked", severity="medium",
            expr=and_(Case.status.in_(("diagnostic_testing_requested", "awaiting_diagnostic_result")),
                      ~exists().where(Sample.case_id == Case.id)),
            remediation="Check the diagnostic order was created.", safe=False),
        "case_missing_symptom_report": dict(
            label="Symptom-report case with no report row", severity="medium",
            expr=and_(Case.source == "symptom_report", SymptomReport.id.is_(None)),
            remediation="Data-integrity investigation.", safe=False),
    }


def _worker_checks():
    claimed = select(User.patient_id).where(User.patient_id.is_not(None))
    worker_accounts = select(RoleAssignment.user_id).where(RoleAssignment.role == "worker", RoleAssignment.revoked_at.is_(None))
    return {
        "worker_orphaned_profile": dict(
            label="Profile created by a worker account but claimed by no account", severity="high",
            expr=and_(Patient.id.notin_(claimed), Patient.created_by_user_id.in_(worker_accounts)),
            remediation="Owner decision, then scripts/reconcile_worker_identity.py (audited). Never auto-merged.", safe=False),
    }


def _followup_checks():
    return {
        "followup_unlinked_to_case": dict(
            label="Follow-up not linked to a case", severity="low",
            expr=FollowUp.case_id.is_(None), remediation="Link where applicable.", safe=False),
        "followup_broken_case_link": dict(
            label="Follow-up points at a case that does not exist", severity="high",
            expr=and_(FollowUp.case_id.is_not(None), Case.id.is_(None)), remediation="Audited correction.", safe=False),
    }


def _run_checks(db, entity, checks, from_fn, conds, total_label_col):
    cols = [func.count().label("_total")] + [
        func.coalesce(func.sum(case((c["expr"], 1), else_=0)), 0).label(k) for k, c in checks.items()]
    row = db.execute(from_fn(select(*cols)).where(*conds)).one()
    checked = int(row._total or 0)
    out = []
    for k, c in checks.items():
        affected = int(getattr(row, k) or 0)
        out.append({"key": k, "entity": entity, "label": c["label"], "severity": c["severity"],
                    "affected": affected, "checked": checked,
                    "pct": round(100.0 * affected / checked, 2) if checked else None,
                    "remediation": c["remediation"], "automated_repair_safe": c["safe"],
                    "source": total_label_col,
                    "records": f"/api/v1/analytics/data-quality/{k}/records"})
    return out


def _all_checks(db, f: Filters):
    results = []
    results += _run_checks(db, "test", _test_checks(), _tests_from, _test_conditions(f), "diagnostic_tests (+samples, cases)")
    results += _run_checks(db, "case", _case_checks(), _cases_from, _case_conditions(f), "cases (+symptom_reports)")
    wf = lambda stmt: stmt.select_from(Patient)
    results += _run_checks(db, "worker", _worker_checks(), wf, _worker_conditions(f), "patients, users, role_assignments")
    ff = lambda stmt: stmt.select_from(FollowUp).outerjoin(Case, Case.id == FollowUp.case_id).outerjoin(Site, Site.id == Case.site_id)
    results += _run_checks(db, "followup", _followup_checks(), ff, _followup_conditions(f), "follow_ups")
    return results


# ------------------------------------------------------------------ endpoints

@router.get("/definitions")
def definitions(user: User = Depends(require_analytics)):
    """What every metric counts. The dashboard renders these as tooltips."""
    return {
        "timezone": TIMEZONE,
        "date_basis": {
            "received": "Server-received time: tests/cases/follow-ups use created_at, symptom reports use created_at.",
            "event": "Event time: tests use performed_at, cases and reports use the symptom report's reported_at, follow-ups use due_at. Rows with no event time are excluded when a date range is set and counted as `no_event_date`.",
        },
        "units": {
            "tests": "Rows in diagnostic_tests. One case or person can have many.",
            "cases": "Rows in cases (one per health episode).",
            "people": "Distinct patients (worker profiles).",
            "symptom_reports": "Rows in symptom_reports (each opens one case).",
        },
        "metrics": {
            "positive_rate": "positive / (positive + negative). Pending, indeterminate, cancelled and unmapped results are excluded from the denominator. Null when the denominator is 0. Descriptive only: no significance is implied.",
            "species": "Counted only among positive tests, as recorded. A positive with no species is `not_recorded`; it is never assigned a species.",
            "overdue_followups": "status = 'due' and due_at earlier than the as_of time. Uses the stored due_at; the clinical definition of 'overdue' is pending approval.",
            "district": "For tests: the testing facility's district, else the linked case's site district. For cases/reports/follow-ups: the site's district.",
            "unmapped": "Values outside the documented vocabulary are reported separately and flagged as data-quality findings.",
        },
        "roles": {"allowed": list(ANALYTICS_ROLES), "note": "Draft access policy pending privacy review. Contractors, workers and health workers are refused."},
        "provenance_gaps": [
            "Client-side capture timestamp is not stored.",
            "Source channel (mobile / web / import) is not stored.",
            "Synchronisation state and offline-delay are not stored server-side.",
            "performed_at is assigned by the server when the result is recorded; it is not an independent bench time.",
        ],
        "proposed_instrumentation": "Add client_captured_at, source_channel and synced_at to diagnostic_tests (and cases) in an approved migration.",
    }


def _scalar(db, stmt):
    return db.scalar(stmt) or 0


@router.get("/summary")
def summary(f: Filters = Depends(), user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    as_of = now()
    # ---- tests
    tc = _test_conditions(f)
    def tq(*cols): return _tests_from(select(*cols)).where(*tc)
    total_tests = _scalar(db, tq(func.count()))
    by_result, unmapped_result = _bucket(db.execute(tq(DiagnosticTest.result_status, func.count()).group_by(DiagnosticTest.result_status)).all(), KNOWN_RESULTS)
    by_method, unmapped_method = _bucket(db.execute(tq(DiagnosticTest.method, func.count()).group_by(DiagnosticTest.method)).all(), KNOWN_METHODS)
    pos_species_rows = db.execute(tq(DiagnosticTest.species, func.count()).where(DiagnosticTest.result_status == "positive").group_by(DiagnosticTest.species)).all()
    species, unmapped_species = _bucket([(v, n) for v, n in pos_species_rows if v is not None], KNOWN_SPECIES)
    species["not_recorded"] = sum(n for v, n in pos_species_rows if v is None)
    completed = by_result["positive"] + by_result["negative"]
    method_result = {}
    for m, r, n in db.execute(tq(DiagnosticTest.method, DiagnosticTest.result_status, func.count()).group_by(DiagnosticTest.method, DiagnosticTest.result_status)).all():
        method_result.setdefault(m, {})[r] = n
    linked = _scalar(db, tq(func.count()).where(Sample.case_id.is_not(None), Case.id.is_not(None)))
    broken = _scalar(db, tq(func.count()).where(Sample.case_id.is_not(None), Case.id.is_(None)))
    people_tested = _scalar(db, tq(func.count(func.distinct(Sample.patient_id))))
    people_positive = _scalar(db, tq(func.count(func.distinct(Sample.patient_id))).where(DiagnosticTest.result_status == "positive"))
    cases_tested = _scalar(db, tq(func.count(func.distinct(Case.id))))
    multi = _tests_from(select(Case.id, func.count().label("n"))).where(*tc, Case.id.is_not(None)).group_by(Case.id).having(func.count() > 1).subquery()
    cases_multi = _scalar(db, select(func.count()).select_from(multi))
    no_event = _scalar(db, _tests_from(select(func.count())).where(*[c for c in tc if True]).where(DiagnosticTest.performed_at.is_(None))) if f.date_basis == "event" else None
    tests = {
        "total": total_tests, "by_result": by_result, "unmapped_result_status": unmapped_result,
        "by_method": by_method, "unmapped_method": unmapped_method, "by_method_and_result": method_result,
        "positive_by_species": species, "unmapped_species": unmapped_species,
        "positive_rate": {"numerator": by_result["positive"], "denominator": completed,
                          "rate": round(by_result["positive"] / completed, 4) if completed else None,
                          "definition": "positive / (positive + negative)"},
        "linkage": {"linked_to_case": linked, "not_linked": total_tests - linked - broken, "broken_case_link": broken},
        "distinct_people_tested": people_tested, "distinct_people_with_positive_test": people_positive,
        "distinct_cases_with_tests": cases_tested, "cases_with_multiple_tests": cases_multi,
        "no_event_date": no_event,
        "provenance": {
            "event_time_field": "diagnostic_tests.performed_at (server-assigned when the result is recorded)",
            "server_received_field": "diagnostic_tests.created_at",
            "gaps": ["client_capture_timestamp: not stored", "source_channel: not stored", "sync_state: not stored"],
        },
        "filters_applied": [k for k in f.applied() if k != "date_basis"],
    }
    # ---- cases
    cc = _case_conditions(f)
    def cq(*cols): return _cases_from(select(*cols)).where(*cc)
    statuses = _case_statuses()
    case_total = _scalar(db, cq(func.count()))
    by_status, unmapped_status = _bucket(db.execute(cq(Case.status, func.count()).group_by(Case.status)).all(), statuses)
    people_cases = _scalar(db, cq(func.count(func.distinct(Case.patient_id))))
    multi_cases = cq(Case.patient_id).group_by(Case.patient_id).having(func.count() > 1).subquery()
    first_ack = _seconds_between(db, Case.acknowledged_at, Case.created_at)
    to_close = _seconds_between(db, Case.closed_at, Case.created_at)
    first_result = (select(Sample.case_id.label("cid"), func.min(DiagnosticTest.performed_at).label("t"))
                    .join(DiagnosticTest, DiagnosticTest.sample_id == Sample.id)
                    .where(DiagnosticTest.result_status.in_(("positive", "negative", "indeterminate")), DiagnosticTest.performed_at.is_not(None), Sample.case_id.is_not(None))
                    .group_by(Sample.case_id).subquery())

    def duration(expr, *extra, join_result=False):
        stmt = _cases_from(select(func.count(), func.avg(expr), func.min(expr), func.max(expr)))
        if join_result: stmt = stmt.join(first_result, first_result.c.cid == Case.id)
        n, avg, lo, hi = db.execute(stmt.where(*cc, *extra)).one()
        return {"available": bool(n), "n": int(n or 0), "avg_seconds": float(avg) if avg is not None else None,
                "min_seconds": float(lo) if lo is not None else None, "max_seconds": float(hi) if hi is not None else None}
    cases = {
        "total": case_total, "by_status": by_status, "unmapped_status": unmapped_status,
        "urgent": _scalar(db, cq(func.count()).where(Case.urgent.is_(True))),
        "distinct_people_with_cases": people_cases,
        "people_with_multiple_cases": _scalar(db, select(func.count()).select_from(multi_cases)),
        "durations": {
            "submission_to_acknowledgement": duration(first_ack, Case.acknowledged_at.is_not(None)),
            "submission_to_first_completed_result": duration(_seconds_between(db, first_result.c.t, Case.created_at), join_result=True),
            "submission_to_closure": duration(to_close, Case.closed_at.is_not(None)),
            "note": "Computed only from persisted timestamps; unavailable when n = 0.",
        },
        "filters_applied": [k for k in f.applied() if k in ("date_from", "date_to", "district", "site_id", "case_status")],
    }
    # ---- symptom reports
    rc = _report_conditions(f)
    rstmt = lambda *cols: (select(*cols).select_from(SymptomReport).join(Case, Case.id == SymptomReport.case_id)
                           .outerjoin(Site, Site.id == SymptomReport.site_id).where(*rc))
    reports = {"total": _scalar(db, rstmt(func.count())), "distinct_people": _scalar(db, rstmt(func.count(func.distinct(SymptomReport.patient_id)))),
               "filters_applied": [k for k in f.applied() if k in ("date_from", "date_to", "district", "site_id", "case_status")]}
    # ---- follow-ups
    fc = _followup_conditions(f)
    fstmt = lambda *cols: (select(*cols).select_from(FollowUp).outerjoin(Case, Case.id == FollowUp.case_id)
                           .outerjoin(Site, Site.id == Case.site_id).where(*fc))
    fu_status = {}
    for s, n in db.execute(fstmt(FollowUp.status, func.count()).group_by(FollowUp.status)).all():
        fu_status[str(s)] = n
    followups = {"total": sum(fu_status.values()), "by_status": fu_status,
                 "overdue": _scalar(db, fstmt(func.count()).where(FollowUp.status == "due", FollowUp.due_at < as_of)),
                 "linked_to_case": _scalar(db, fstmt(func.count()).where(Case.id.is_not(None))),
                 "overdue_definition": "status = 'due' and due_at < as_of (clinical definition pending approval)",
                 "filters_applied": [k for k in f.applied() if k in ("date_from", "date_to", "district", "site_id", "case_status")]}
    slide = {}
    sstmt = (select(SlideFollowUp.received, SlideFollowUp.positive, func.count()).select_from(SlideFollowUp)
             .join(Sample, Sample.id == SlideFollowUp.sample_id).outerjoin(Facility, Facility.id == Sample.facility_id)
             .outerjoin(Case, Case.id == Sample.case_id).outerjoin(Site, Site.id == Case.site_id)
             .where(*f.range(SlideFollowUp.created_at)))
    if f.district: sstmt = sstmt.where(_district_expr() == f.district)
    if f.site_id: sstmt = sstmt.where(Case.site_id == f.site_id)
    if f.facility_id: sstmt = sstmt.where(Sample.facility_id == f.facility_id)
    for received, positive, n in db.execute(sstmt.group_by(SlideFollowUp.received, SlideFollowUp.positive)).all():
        slide[f"received={received},positive={positive}"] = n
    # ---- workers
    wc = _worker_conditions(f)
    registered = _scalar(db, select(func.count()).select_from(Patient).where(*wc))
    assigned = _scalar(db, select(func.count(func.distinct(WorkerSiteAssignment.patient_id))).select_from(WorkerSiteAssignment)
                       .join(Patient, Patient.id == WorkerSiteAssignment.patient_id)
                       .join(Site, Site.id == WorkerSiteAssignment.site_id)
                       .where(WorkerSiteAssignment.end_date.is_(None), *wc,
                              *([WorkerSiteAssignment.site_id == f.site_id] if f.site_id else []),
                              *([Site.district == f.district] if f.district else [])))
    workers = {"registered": registered, "with_active_site_assignment": assigned,
               "definition": "registered = patient rows; assigned = distinct patients with an assignment whose end_date is empty",
               "filters_applied": [k for k in f.applied() if k in ("date_from", "date_to", "district", "site_id")]}
    # ---- audit-observable replay protection
    guard = {}
    for action in ("idempotency.cross_account_rejected", "worker.replayed_no_duplicate", "symptom_report.replayed_no_duplicate",
                   "questionnaire.duplicate_submit_rejected", "worker.reregistration_blocked"):
        guard[action] = _scalar(db, select(func.count()).select_from(AuditEvent).where(AuditEvent.action == action, *f.range(AuditEvent.occurred_at)))
    return {
        "meta": {"as_of": as_of, "timezone": TIMEZONE, "filters": f.applied(), "definitions": "/api/v1/analytics/definitions",
                 "scope": "all authorized records" if "admin" in _roles(user, db) else "authorized aggregate"},
        "workers": workers, "symptom_reports": reports, "cases": cases, "tests": tests,
        "followups": followups, "slide_followups": slide,
        "duplicate_and_replay_protection": {"audit_event_counts": guard,
                                            "note": "Counts of blocked/replayed submissions recorded in audit_events."},
        "not_observable": [
            "Unsynchronised records held only on devices (no server-side record exists).",
            "Rejected submissions (4xx responses are not persisted).",
            "Failed imports (no import pipeline exists).",
        ],
    }


def _roles(user, db):
    return set(db.scalars(select(RoleAssignment.role).where(RoleAssignment.user_id == user.id, RoleAssignment.revoked_at.is_(None))).all())


@router.get("/trends")
def trends(f: Filters = Depends(), user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    """Daily (UTC) counts of tests by result, plus cases and symptom reports."""
    col = DiagnosticTest.performed_at if f.date_basis == "event" else DiagnosticTest.created_at
    day = _day(db, col)
    rows = db.execute(_tests_from(select(day, DiagnosticTest.result_status, func.count()))
                      .where(*_test_conditions(f), col.is_not(None)).group_by(day, DiagnosticTest.result_status)).all()
    series: dict = {}
    for d, r, n in rows:
        s = series.setdefault(str(d), {"date": str(d), "total": 0, **{k: 0 for k in KNOWN_RESULTS}, "unmapped": 0})
        s["total"] += n
        s[r if r in KNOWN_RESULTS else "unmapped"] += n
    ccol = SymptomReport.reported_at if f.date_basis == "event" else Case.created_at
    cday = _day(db, ccol)
    crow = db.execute(_cases_from(select(cday, func.count())).where(*_case_conditions(f), ccol.is_not(None)).group_by(cday)).all()
    return {"meta": {"timezone": TIMEZONE, "date_basis": f.date_basis, "filters": f.applied()},
            "tests": [series[k] for k in sorted(series)],
            "cases": [{"date": str(d), "total": n} for d, n in sorted(crow, key=lambda r: str(r[0]))]}


BREAKDOWNS = ("district", "site", "facility", "method", "species", "case_status")


@router.get("/breakdown")
def breakdown(by: str = Query(..., pattern="^(district|site|facility|method|species|case_status)$"),
              f: Filters = Depends(), user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    """Tests grouped by a dimension with result counts and the positive-rate numerator/denominator."""
    dims = {
        "district": (_district_expr(), None), "site": (Site.code, Site.name), "facility": (Facility.code, Facility.name),
        "method": (DiagnosticTest.method, None), "species": (DiagnosticTest.species, None), "case_status": (Case.status, None),
    }
    key, label = dims[by]
    cols = [key, DiagnosticTest.result_status, func.count()] if label is None else [key, label, DiagnosticTest.result_status, func.count()]
    stmt = _tests_from(select(*cols)).where(*_test_conditions(f)).group_by(*[c for c in cols if c is not cols[-1]])
    groups: dict = {}
    for row in db.execute(stmt).all():
        k = row[0]
        name = row[1] if label is not None else None
        r, n = row[-2], row[-1]
        g = groups.setdefault(k, {"key": k, "label": name, "total": 0, **{x: 0 for x in KNOWN_RESULTS}, "unmapped": 0})
        g["total"] += n
        g[r if r in KNOWN_RESULTS else "unmapped"] += n
    out = []
    for g in groups.values():
        den = g["positive"] + g["negative"]
        g["positive_rate"] = {"numerator": g["positive"], "denominator": den, "rate": round(g["positive"] / den, 4) if den else None}
        if g["key"] is None:
            g["key_note"] = "not recorded"
        out.append(g)
    out.sort(key=lambda g: (-g["total"], str(g["key"])))
    return {"meta": {"by": by, "filters": f.applied(), "timezone": TIMEZONE}, "groups": out,
            "note": "Rates are descriptive. Groups with small denominators are unreliable; no significance is implied."}


@router.get("/data-quality")
def data_quality(f: Filters = Depends(), user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    checks = _all_checks(db, f)
    return {"meta": {"as_of": now(), "filters": f.applied(), "timezone": TIMEZONE}, "checks": checks,
            "summary": {"checks_run": len(checks), "checks_with_findings": sum(1 for c in checks if c["affected"]),
                        "high_severity_findings": sum(c["affected"] for c in checks if c["severity"] == "high")},
            "not_observable": ["Unsynchronised device-only records", "Rejected submissions", "Failed imports"],
            "note": "A missing value is reported as missing; it is never treated as a negative or as 'unknown'."}


# ------------------------------------------------------------------ record-level drill-down

def _test_record_stmt(f, flag_cols, extra=()):
    stmt = _tests_from(select(
        DiagnosticTest.id, Sample.sample_code, Case.case_code, Sample.patient_id, Site.code.label("site_code"), Site.name.label("site_name"),
        Facility.code.label("facility_code"), Facility.name.label("facility_name"), _district_expr().label("district"),
        DiagnosticTest.method, DiagnosticTest.result_status, DiagnosticTest.species, DiagnosticTest.performed_at,
        DiagnosticTest.created_at, Sample.case_id, Case.id.label("case_row_id"), *flag_cols))
    return stmt.where(*_test_conditions(f), *extra)


def _test_record(row, flag_keys):
    link = "linked" if row.case_row_id else ("broken_case_link" if row.case_id else "unlinked_no_case")
    return {
        "test_id": row.id, "sample_code": row.sample_code, "case_code": row.case_code, "worker_ref": _pseudo(row.patient_id),
        "site": {"code": row.site_code, "name": row.site_name} if row.site_code else None,
        "facility": {"code": row.facility_code, "name": row.facility_name} if row.facility_code else None,
        "district": row.district, "method": row.method, "result_status": row.result_status, "species": row.species,
        "performed_at": row.performed_at, "server_received_at": row.created_at,
        "capture_timestamp": None, "source_channel": None, "sync_state": None,
        "linkage_status": link, "data_quality_flags": [k for k in flag_keys if getattr(row, k)],
    }


def _flag_cols(checks):
    return [case((c["expr"], 1), else_=0).label(k) for k, c in checks.items()]


@router.get("/tests")
def test_records(f: Filters = Depends(), flagged_only: bool = False,
                 offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
                 user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    checks = _test_checks()
    extra = [or_(*[c["expr"] for c in checks.values()])] if flagged_only else []
    total = _scalar(db, _tests_from(select(func.count())).where(*_test_conditions(f), *extra))
    rows = db.execute(_test_record_stmt(f, _flag_cols(checks), extra)
                      .order_by(DiagnosticTest.created_at.desc(), DiagnosticTest.id).offset(offset).limit(limit)).all()
    audit(db, user, "analytics.records_viewed", "analytics", None, {"dataset": "tests", "rows": len(rows), "filters": f.applied()}); db.commit()
    return {"items": [_test_record(r, checks) for r in rows], "total": total, "offset": offset, "limit": limit,
            "sort": "server_received_at desc, test_id"}


@router.get("/cases")
def case_records(f: Filters = Depends(), offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
                 user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    checks = _case_checks()
    total = _scalar(db, _cases_from(select(func.count())).where(*_case_conditions(f)))
    stmt = _cases_from(select(Case.id, Case.case_code, Case.patient_id, Case.status, Case.urgent, Case.source, Case.created_at,
                              Case.acknowledged_at, Case.closed_at, Site.code.label("site_code"), Site.name.label("site_name"),
                              Site.district, SymptomReport.reported_at, *_flag_cols(checks))).where(*_case_conditions(f))
    rows = db.execute(stmt.order_by(Case.created_at.desc(), Case.id).offset(offset).limit(limit)).all()
    audit(db, user, "analytics.records_viewed", "analytics", None, {"dataset": "cases", "rows": len(rows), "filters": f.applied()}); db.commit()
    items = [{"case_id": r.id, "case_code": r.case_code, "worker_ref": _pseudo(r.patient_id), "status": r.status, "urgent": r.urgent,
              "source": r.source, "site": {"code": r.site_code, "name": r.site_name} if r.site_code else None, "district": r.district,
              "reported_at": r.reported_at, "server_received_at": r.created_at, "acknowledged_at": r.acknowledged_at,
              "closed_at": r.closed_at, "data_quality_flags": [k for k in checks if getattr(r, k)]} for r in rows]
    return {"items": items, "total": total, "offset": offset, "limit": limit, "sort": "server_received_at desc, case_id"}


@router.get("/data-quality/{check_key}/records")
def data_quality_records(check_key: str, f: Filters = Depends(), offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100),
                         user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    """Safe drill-down: record references only (no names, phones, IDs or clinical text)."""
    tests, cases, workers, followups = _test_checks(), _case_checks(), _worker_checks(), _followup_checks()
    if check_key in tests:
        expr = tests[check_key]["expr"]
        total = _scalar(db, _tests_from(select(func.count())).where(*_test_conditions(f), expr))
        rows = db.execute(_tests_from(select(DiagnosticTest.id, Sample.sample_code, Case.case_code, Sample.patient_id))
                          .where(*_test_conditions(f), expr).order_by(DiagnosticTest.created_at.desc(), DiagnosticTest.id).offset(offset).limit(limit)).all()
        items = [{"record_type": "test", "test_id": r[0], "sample_code": r[1], "case_code": r[2], "worker_ref": _pseudo(r[3])} for r in rows]
    elif check_key in cases:
        expr = cases[check_key]["expr"]
        total = _scalar(db, _cases_from(select(func.count())).where(*_case_conditions(f), expr))
        rows = db.execute(_cases_from(select(Case.id, Case.case_code, Case.patient_id, Case.status)).where(*_case_conditions(f), expr)
                          .order_by(Case.created_at.desc(), Case.id).offset(offset).limit(limit)).all()
        items = [{"record_type": "case", "case_id": r[0], "case_code": r[1], "worker_ref": _pseudo(r[2]), "status": r[3]} for r in rows]
    elif check_key in workers:
        expr = workers[check_key]["expr"]
        total = _scalar(db, select(func.count()).select_from(Patient).where(*_worker_conditions(f), expr))
        rows = db.execute(select(Patient.id, Patient.patient_code, Patient.created_at).where(*_worker_conditions(f), expr)
                          .order_by(Patient.created_at.desc(), Patient.id).offset(offset).limit(limit)).all()
        items = [{"record_type": "worker", "worker_ref": _pseudo(r[0]), "patient_code": r[1], "created_at": r[2]} for r in rows]
    elif check_key in followups:
        expr = followups[check_key]["expr"]
        base = lambda s: s.select_from(FollowUp).outerjoin(Case, Case.id == FollowUp.case_id).outerjoin(Site, Site.id == Case.site_id)
        total = _scalar(db, base(select(func.count())).where(*_followup_conditions(f), expr))
        rows = db.execute(base(select(FollowUp.id, FollowUp.patient_id, FollowUp.status)).where(*_followup_conditions(f), expr)
                          .order_by(FollowUp.created_at.desc(), FollowUp.id).offset(offset).limit(limit)).all()
        items = [{"record_type": "followup", "followup_id": r[0], "worker_ref": _pseudo(r[1]), "status": r[2]} for r in rows]
    else:
        raise HTTPException(404, "Unknown data-quality check")
    audit(db, user, "analytics.records_viewed", "analytics", None, {"dataset": check_key, "rows": len(items), "filters": f.applied()}); db.commit()
    return {"items": items, "total": total, "offset": offset, "limit": limit}


# ------------------------------------------------------------------ export

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value) -> str:
    """Neutralise spreadsheet formula injection: cells that could be read as formulas get a leading apostrophe."""
    if value is None:
        return ""
    text = value.isoformat() if isinstance(value, (datetime, date)) else str(value)
    return "'" + text if text.startswith(_FORMULA_PREFIXES) else text


@router.get("/export/{dataset}.csv")
def export_csv(dataset: str, f: Filters = Depends(), user: User = Depends(require_analytics), db: Session = Depends(get_db)):
    """Same filters and same pseudonymous fields as the on-screen tables; audited."""
    if dataset not in ("tests", "cases"):
        raise HTTPException(404, "Unknown export dataset")
    buf = io.StringIO()
    w = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    truncated = False
    if dataset == "tests":
        checks = _test_checks()
        w.writerow(["test_id", "sample_code", "case_code", "worker_ref", "site_code", "facility_code", "district", "method",
                    "result_status", "species", "performed_at", "server_received_at", "linkage_status", "data_quality_flags"])
        stmt = _test_record_stmt(f, _flag_cols(checks)).order_by(DiagnosticTest.created_at.desc(), DiagnosticTest.id)
        rows = db.execute(stmt.limit(EXPORT_MAX_ROWS + 1)).all()
        truncated = len(rows) > EXPORT_MAX_ROWS
        for r in rows[:EXPORT_MAX_ROWS]:
            rec = _test_record(r, checks)
            w.writerow([csv_safe(x) for x in (rec["test_id"], rec["sample_code"], rec["case_code"], rec["worker_ref"],
                        (rec["site"] or {}).get("code"), (rec["facility"] or {}).get("code"), rec["district"], rec["method"],
                        rec["result_status"], rec["species"], rec["performed_at"], rec["server_received_at"],
                        rec["linkage_status"], ";".join(rec["data_quality_flags"]))])
        n = min(len(rows), EXPORT_MAX_ROWS)
    else:
        checks = _case_checks()
        w.writerow(["case_id", "case_code", "worker_ref", "status", "urgent", "source", "site_code", "district", "reported_at",
                    "server_received_at", "acknowledged_at", "closed_at", "data_quality_flags"])
        stmt = _cases_from(select(Case.id, Case.case_code, Case.patient_id, Case.status, Case.urgent, Case.source, Case.created_at,
                                  Case.acknowledged_at, Case.closed_at, Site.code.label("site_code"), Site.district,
                                  SymptomReport.reported_at, *_flag_cols(checks))).where(*_case_conditions(f))
        rows = db.execute(stmt.order_by(Case.created_at.desc(), Case.id).limit(EXPORT_MAX_ROWS + 1)).all()
        truncated = len(rows) > EXPORT_MAX_ROWS
        for r in rows[:EXPORT_MAX_ROWS]:
            w.writerow([csv_safe(x) for x in (r.id, r.case_code, _pseudo(r.patient_id), r.status, r.urgent, r.source, r.site_code,
                        r.district, r.reported_at, r.created_at, r.acknowledged_at, r.closed_at, ";".join(k for k in checks if getattr(r, k)))])
        n = min(len(rows), EXPORT_MAX_ROWS)
    audit(db, user, "analytics.export", "analytics", None, {"dataset": dataset, "rows": n, "truncated": truncated, "filters": f.applied()}); db.commit()
    headers = {"Content-Disposition": f'attachment; filename="m3-{dataset}.csv"', "Cache-Control": "no-store",
               "X-Export-Rows": str(n), "X-Export-Truncated": "true" if truncated else "false"}
    return Response(buf.getvalue(), media_type="text/csv; charset=utf-8", headers=headers)
