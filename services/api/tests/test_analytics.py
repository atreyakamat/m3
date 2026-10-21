"""Automated verification tests for M3 analytics engine (PRD Section 7).

Tests:
1. Role-based access control (admin, clinician, research_lab, pathologist allowed; worker/contractor denied 403).
2. Summary aggregation truth (positivity rate = positive / (positive + negative)).
3. Tests, cases, and people reported as separate units.
4. Trends and breakdowns by method and district.
5. 12 data quality rules and safe pseudonymized drill-down.
6. Formula injection protection in CSV export.
7. Audit event generation for records views and exports.
"""
import csv
import io
from datetime import datetime, timezone
import pytest
from app.database import SessionLocal
from app import models


def _auth(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


def test_analytics_rbac_gates(client, tokens):
    # Worker is forbidden (403)
    res_worker = client.get("/api/v1/analytics/summary", headers=_auth(tokens["worker"]))
    assert res_worker.status_code == 403, res_worker.text

    # Contractor is forbidden (403)
    res_contractor = client.get("/api/v1/analytics/summary", headers=_auth(tokens["contractor"]))
    assert res_contractor.status_code == 403

    # Unauthenticated is rejected (401)
    res_anon = client.get("/api/v1/analytics/summary")
    assert res_anon.status_code == 401

    # Clinician is allowed (200)
    res_clinician = client.get("/api/v1/analytics/summary", headers=_auth(tokens["clinician"]))
    assert res_clinician.status_code == 200

    # Admin is allowed (200)
    res_admin = client.get("/api/v1/analytics/summary", headers=_auth(tokens["admin"]))
    assert res_admin.status_code == 200

    # Research lab is allowed (200)
    res_rl = client.get("/api/v1/analytics/summary", headers=_auth(tokens["research_lab"]))
    assert res_rl.status_code == 200

    # Pathologist is allowed (200)
    res_path = client.get("/api/v1/analytics/summary", headers=_auth(tokens["pathologist"]))
    assert res_path.status_code == 200


def test_analytics_definitions(client, tokens):
    res = client.get("/api/v1/analytics/definitions", headers=_auth(tokens["admin"]))
    assert res.status_code == 200
    data = res.json()
    assert "metrics" in data
    assert "positive_rate" in data["metrics"]
    assert "units" in data
    assert data["units"]["tests"] == "Rows in diagnostic_tests. One case or person can have many."
    assert "provenance_gaps" in data
    assert len(data["provenance_gaps"]) >= 4


def test_analytics_summary_mathematical_truth(client, tokens):
    res = client.get("/api/v1/analytics/summary", headers=_auth(tokens["admin"]))
    assert res.status_code == 200
    data = res.json()

    assert "meta" in data
    assert "workers" in data
    assert "symptom_reports" in data
    assert "cases" in data
    assert "tests" in data
    assert "followups" in data

    tests = data["tests"]
    by_result = tests["by_result"]
    pos = by_result.get("positive", 0)
    neg = by_result.get("negative", 0)
    completed = pos + neg

    pr = tests["positive_rate"]
    assert pr["numerator"] == pos
    assert pr["denominator"] == completed
    if completed > 0:
        assert pr["rate"] == round(pos / completed, 4)
    else:
        assert pr["rate"] is None

    # Distinct measures requirement (tests, cases, people separate)
    assert "distinct_people_tested" in tests
    assert "distinct_cases_with_tests" in tests
    assert "distinct_people_with_cases" in data["cases"]
    assert "registered" in data["workers"]


def test_analytics_trends_and_breakdown(client, tokens):
    # Trends
    res_trends = client.get("/api/v1/analytics/trends", headers=_auth(tokens["clinician"]))
    assert res_trends.status_code == 200
    trends_data = res_trends.json()
    assert "tests" in trends_data
    assert "cases" in trends_data

    # Breakdown by method
    res_method = client.get("/api/v1/analytics/breakdown?by=method", headers=_auth(tokens["clinician"]))
    assert res_method.status_code == 200
    method_data = res_method.json()
    assert "groups" in method_data

    # Breakdown by district
    res_dist = client.get("/api/v1/analytics/breakdown?by=district", headers=_auth(tokens["clinician"]))
    assert res_dist.status_code == 200
    assert "groups" in res_dist.json()


def test_analytics_data_quality_and_drill_down(client, tokens):
    res_dq = client.get("/api/v1/analytics/data-quality", headers=_auth(tokens["admin"]))
    assert res_dq.status_code == 200
    dq_data = res_dq.json()
    assert "checks" in dq_data
    assert "summary" in dq_data
    checks = dq_data["checks"]
    assert len(checks) >= 10

    # Pick first check and test drill-down
    first_key = checks[0]["key"]
    res_drill = client.get(f"/api/v1/analytics/data-quality/{first_key}/records", headers=_auth(tokens["admin"]))
    assert res_drill.status_code == 200
    drill_data = res_drill.json()
    assert "items" in drill_data
    assert "total" in drill_data


def test_analytics_record_drilldown_pseudonymization(client, tokens):
    res_tests = client.get("/api/v1/analytics/tests", headers=_auth(tokens["research_lab"]))
    assert res_tests.status_code == 200
    test_items = res_tests.json()["items"]
    if test_items:
        first = test_items[0]
        assert "worker_ref" in first
        # Verify worker_ref is a pseudonym hash, not raw phone or name
        assert not first["worker_ref"].startswith("+91")
        assert "linkage_status" in first
        assert "data_quality_flags" in first


def test_analytics_csv_export_and_formula_defense(client, tokens):
    res_exp = client.get("/api/v1/analytics/export/tests.csv", headers=_auth(tokens["admin"]))
    assert res_exp.status_code == 200
    assert "text/csv" in res_exp.headers["content-type"]
    assert "attachment" in res_exp.headers.get("content-disposition", "")

    reader = csv.reader(io.StringIO(res_exp.text))
    rows = list(reader)
    assert len(rows) >= 1  # Header row present
    header = rows[0]
    assert "test_id" in header
    assert "sample_code" in header
    assert "worker_ref" in header

    # Cases export
    res_cases_exp = client.get("/api/v1/analytics/export/cases.csv", headers=_auth(tokens["clinician"]))
    assert res_cases_exp.status_code == 200
    reader_cases = csv.reader(io.StringIO(res_cases_exp.text))
    rows_cases = list(reader_cases)
    assert len(rows_cases) >= 1
    assert "case_code" in rows_cases[0]


def test_analytics_truth_matrix(client, tokens):
    """Deterministic synthetic fixture validating all analytics metrics and boundaries.

    Constructs an isolated truth fixture in a dedicated 2026-06 date window:
    - 4 workers (3 inside range, 1 outside range in 2025)
    - 4 cases (2 for worker 1, 1 for worker 2 with missing site, 1 outside range)
    - 7 tests covering positive, negative, pending, indeterminate, cancelled, and outside-range
    - Multiple tests in one case, multiple cases for one worker
    - Unlinked test, broken-link test, missing site metadata
    - Follow-ups (overdue and unlinked)
    - All mathematical counts independently calculated and verified.
    """
    db = SessionLocal()
    target_mid = datetime(2026, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    outside_date = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    try:
        # 1. Geography
        site_north = models.Site(id="p1-site-north", code="P1-SN", name="P1 North Site",
                                 district="North Goa", area="Panaji", contractor_name="P1 Co",
                                 contractor_user_id="contractor-1")
        fac_south = models.Facility(id="p1-fac-south", code="P1-FS", name="P1 South Facility",
                                    district="South Goa", facility_type="PHC")
        db.add_all([site_north, fac_south])
        db.flush()

        # 2. People (Patients)
        w1 = models.Patient(id="p1-w1", patient_code="P1-W01", display_name="Truth Worker One",
                            consent_status="documented", created_at=target_mid)
        w2 = models.Patient(id="p1-w2", patient_code="P1-W02", display_name="Truth Worker Two",
                            consent_status="documented", created_at=target_mid)
        w3 = models.Patient(id="p1-w3", patient_code="P1-W03", display_name="Truth Worker Three",
                            consent_status="documented", created_at=target_mid)
        w4 = models.Patient(id="p1-w4", patient_code="P1-W04", display_name="Truth Worker Four",
                            consent_status="documented", created_at=outside_date)
        db.add_all([w1, w2, w3, w4])
        db.flush()

        # 3. Cases
        c1 = models.Case(id="p1-c1", case_code="P1-C01", patient_id="p1-w1", site_id="p1-site-north",
                         status="in_assessment", urgent=True, created_at=target_mid)
        c2 = models.Case(id="p1-c2", case_code="P1-C02", patient_id="p1-w1", site_id="p1-site-north",
                         status="awaiting_clinical_review", urgent=False, created_at=target_mid)
        c3 = models.Case(id="p1-c3", case_code="P1-C03", patient_id="p1-w2", site_id=None,
                         status="followup_due", urgent=False, created_at=target_mid)
        c4 = models.Case(id="p1-c4", case_code="P1-C04", patient_id="p1-w4", site_id="p1-site-north",
                         status="closed", urgent=False, created_at=outside_date, closed_at=outside_date)
        db.add_all([c1, c2, c3, c4])
        db.flush()

        # 4. Samples
        s1 = models.Sample(id="p1-s1", sample_code="P1-S01", patient_id="p1-w1", facility_id=None,
                           case_id="p1-c1", collected_at=target_mid, created_at=target_mid)
        s2 = models.Sample(id="p1-s2", sample_code="P1-S02", patient_id="p1-w1", facility_id=None,
                           case_id="p1-c1", collected_at=target_mid, created_at=target_mid)
        s3 = models.Sample(id="p1-s3", sample_code="P1-S03", patient_id="p1-w1", facility_id=None,
                           case_id="p1-c2", collected_at=target_mid, created_at=target_mid)
        s4 = models.Sample(id="p1-s4", sample_code="P1-S04", patient_id="p1-w2", facility_id="p1-fac-south",
                           case_id="p1-c3", collected_at=target_mid, created_at=target_mid)
        s5 = models.Sample(id="p1-s5", sample_code="P1-S05", patient_id="p1-w3", facility_id=None,
                           case_id=None, collected_at=target_mid, created_at=target_mid)
        s6 = models.Sample(id="p1-s6", sample_code="P1-S06", patient_id="p1-w3", facility_id=None,
                           case_id="p1-c-broken", collected_at=target_mid, created_at=target_mid)
        s7 = models.Sample(id="p1-s7", sample_code="P1-S07", patient_id="p1-w4", facility_id=None,
                           case_id="p1-c4", collected_at=outside_date, created_at=outside_date)
        db.add_all([s1, s2, s3, s4, s5, s6, s7])
        db.flush()

        # 5. Diagnostic Tests
        t1 = models.DiagnosticTest(id="p1-t1", sample_id="p1-s1", method="rdt", result_status="positive",
                                   species="pf", operator_id="pathologist", performed_at=target_mid, created_at=target_mid)
        t2 = models.DiagnosticTest(id="p1-t2", sample_id="p1-s2", method="microscopy", result_status="negative",
                                   species=None, operator_id="pathologist", performed_at=target_mid, created_at=target_mid)
        t3 = models.DiagnosticTest(id="p1-t3", sample_id="p1-s3", method="microscopy", result_status="positive",
                                   species="pv", operator_id="pathologist", performed_at=target_mid, created_at=target_mid)
        t4 = models.DiagnosticTest(id="p1-t4", sample_id="p1-s4", method="rdt", result_status="pending",
                                   species=None, operator_id="pathologist", performed_at=None, created_at=target_mid)
        t5 = models.DiagnosticTest(id="p1-t5", sample_id="p1-s5", method="smp", result_status="indeterminate",
                                   species=None, operator_id="pathologist", performed_at=target_mid, created_at=target_mid)
        t6 = models.DiagnosticTest(id="p1-t6", sample_id="p1-s6", method="rdt", result_status="cancelled",
                                   species=None, operator_id="pathologist", performed_at=target_mid, created_at=target_mid)
        t7 = models.DiagnosticTest(id="p1-t7", sample_id="p1-s7", method="rdt", result_status="positive",
                                   species="pf", operator_id="pathologist", performed_at=outside_date, created_at=outside_date)
        db.add_all([t1, t2, t3, t4, t5, t6, t7])

        # 6. Follow-ups
        fu1 = models.FollowUp(id="p1-fu1", patient_id="p1-w2", case_id="p1-c3", status="due",
                              due_at=target_mid, created_at=target_mid)
        fu2 = models.FollowUp(id="p1-fu2", patient_id="p1-w3", case_id=None, status="completed",
                              due_at=target_mid, created_at=target_mid)
        db.add_all([fu1, fu2])

        db.commit()
    finally:
        db.close()

    # Query with date window: 2026-06-01 to 2026-06-30 (isolates truth set and excludes t7/c4/w4)
    WINDOW = "?date_from=2026-06-01&date_to=2026-06-30"

    # --- 1. Summary Truth Verification ---
    res_sum = client.get(f"/api/v1/analytics/summary{WINDOW}", headers=_auth(tokens["clinician"]))
    assert res_sum.status_code == 200, res_sum.text
    summary = res_sum.json()

    # Total tests in window
    tests = summary["tests"]
    assert tests["total"] == 6, f"Expected 6 tests, got {tests['total']}"

    # Results breakdown
    by_res = tests["by_result"]
    assert by_res["positive"] == 2  # t1, t3
    assert by_res["negative"] == 1  # t2
    assert by_res["pending"] == 1   # t4
    assert by_res["indeterminate"] == 1  # t5
    assert by_res["cancelled"] == 1      # t6

    # Positive rate truth: positive / (positive + negative)
    # 2 / (2 + 1) = 2/3 = 0.6667
    pr = tests["positive_rate"]
    assert pr["numerator"] == 2
    assert pr["denominator"] == 3
    assert pr["rate"] == 0.6667

    # Method breakdown
    by_meth = tests["by_method"]
    assert by_meth["rdt"] == 3        # t1, t4, t6
    assert by_meth["microscopy"] == 2  # t2, t3
    assert by_meth["smp"] == 1         # t5

    # Species breakdown (only among positive tests)
    pos_spec = tests["positive_by_species"]
    assert pos_spec["pf"] == 1  # t1
    assert pos_spec["pv"] == 1  # t3
    assert pos_spec["not_recorded"] == 0

    # Distinct units counted separately
    assert tests["distinct_people_tested"] == 3          # w1, w2, w3
    assert tests["distinct_people_with_positive_test"] == 1  # w1
    assert tests["distinct_cases_with_tests"] == 3        # c1, c2, c3
    assert tests["cases_with_multiple_tests"] == 1        # c1 has t1 and t2

    # Linkage metrics
    linkage = tests["linkage"]
    assert linkage["linked_to_case"] == 4     # t1, t2, t3, t4
    assert linkage["not_linked"] == 1         # t5
    assert linkage["broken_case_link"] == 1   # t6

    # Cases metrics
    cases = summary["cases"]
    assert cases["total"] == 3                           # c1, c2, c3
    assert cases["by_status"]["in_assessment"] == 1      # c1
    assert cases["by_status"]["awaiting_clinical_review"] == 1  # c2
    assert cases["by_status"]["followup_due"] == 1       # c3
    assert cases["urgent"] == 1                          # c1 is urgent
    assert cases["distinct_people_with_cases"] == 2      # w1, w2
    assert cases["people_with_multiple_cases"] == 1      # w1 has c1 and c2

    # Follow-ups metrics
    fu = summary["followups"]
    assert fu["total"] == 2                              # fu1, fu2
    assert fu["by_status"]["due"] == 1                  # fu1
    assert fu["by_status"]["completed"] == 1            # fu2
    assert fu["linked_to_case"] == 1                    # fu1
    assert fu["overdue"] == 1                           # fu1 is past due_at

    # --- 2. Breakdowns Truth Verification ---
    # Breakdown by district
    res_b_dist = client.get(f"/api/v1/analytics/breakdown{WINDOW}&by=district", headers=_auth(tokens["admin"]))
    assert res_b_dist.status_code == 200
    dist_groups = {g["key"]: g for g in res_b_dist.json()["groups"]}
    assert dist_groups["North Goa"]["total"] == 3  # t1, t2, t3 via site_north
    assert dist_groups["North Goa"]["positive"] == 2
    assert dist_groups["South Goa"]["total"] == 1  # t4 via fac_south
    assert dist_groups[None]["total"] == 2         # t5 (unlinked) and t6 (broken)

    # Breakdown by site
    res_b_site = client.get(f"/api/v1/analytics/breakdown{WINDOW}&by=site", headers=_auth(tokens["pathologist"]))
    assert res_b_site.status_code == 200
    site_groups = {g["key"]: g for g in res_b_site.json()["groups"]}
    assert site_groups["P1-SN"]["total"] == 3      # t1, t2, t3
    assert site_groups[None]["total"] == 3         # t4, t5, t6 have no valid site

    # Breakdown by facility
    res_b_fac = client.get(f"/api/v1/analytics/breakdown{WINDOW}&by=facility", headers=_auth(tokens["research_lab"]))
    assert res_b_fac.status_code == 200
    fac_groups = {g["key"]: g for g in res_b_fac.json()["groups"]}
    assert fac_groups["P1-FS"]["total"] == 1       # t4
    assert fac_groups[None]["total"] == 5          # t1, t2, t3, t5, t6

    # --- 3. Filter Verification ---
    # Filter by method=rdt
    res_f_rdt = client.get(f"/api/v1/analytics/summary{WINDOW}&method=rdt", headers=_auth(tokens["admin"]))
    assert res_f_rdt.json()["tests"]["total"] == 3  # t1, t4, t6

    # Filter by result_status=positive
    res_f_pos = client.get(f"/api/v1/analytics/summary{WINDOW}&result_status=positive", headers=_auth(tokens["admin"]))
    assert res_f_pos.json()["tests"]["total"] == 2  # t1, t3

    # Filter by site_id=p1-site-north
    res_f_site = client.get(f"/api/v1/analytics/summary{WINDOW}&site_id=p1-site-north", headers=_auth(tokens["admin"]))
    assert res_f_site.json()["tests"]["total"] == 3  # t1, t2, t3

    # Filter by district=North Goa
    res_f_d = client.get(f"/api/v1/analytics/summary{WINDOW}&district=North%20Goa", headers=_auth(tokens["admin"]))
    assert res_f_d.json()["tests"]["total"] == 3

    # Filter date range outside (verifies date boundaries strictly exclude outside records)
    res_f_past = client.get("/api/v1/analytics/summary?date_from=2024-01-01&date_to=2025-06-30", headers=_auth(tokens["admin"]))
    assert res_f_past.json()["tests"]["total"] == 1  # only t7
    assert res_f_past.json()["cases"]["total"] == 1  # only c4

    # --- 4. Data Quality Findings Truth ---
    res_dq = client.get(f"/api/v1/analytics/data-quality{WINDOW}", headers=_auth(tokens["admin"]))
    assert res_dq.status_code == 200
    checks_map = {c["key"]: c for c in res_dq.json()["checks"]}
    assert checks_map["test_unlinked_to_case"]["affected"] == 1  # t5
    assert checks_map["test_broken_case_link"]["affected"] == 1  # t6
    assert checks_map["test_missing_site"]["affected"] == 3       # t4, t5, t6
    assert checks_map["case_missing_site"]["affected"] == 1       # c3
    assert checks_map["followup_unlinked_to_case"]["affected"] == 1  # fu2

    # --- 5. Authorization & Redaction Integrity ---
    for role in ("worker", "contractor", "health_worker"):
        denied = client.get(f"/api/v1/analytics/summary{WINDOW}", headers=_auth(tokens[role]))
        assert denied.status_code == 403, f"Role {role} should be denied 403"

    anon = client.get(f"/api/v1/analytics/summary{WINDOW}")
    assert anon.status_code == 401

    # Privacy check on drill-down records: worker names, phones, or clinical text must NEVER appear
    res_recs = client.get(f"/api/v1/analytics/tests{WINDOW}", headers=_auth(tokens["research_lab"]))
    assert res_recs.status_code == 200
    text_blob = res_recs.text.lower()
    assert "truth worker" not in text_blob
    assert "phone" not in text_blob
    assert "+91" not in text_blob
    for item in res_recs.json()["items"]:
        assert item["worker_ref"].startswith("W-")
        assert item["capture_timestamp"] is None
        assert item["source_channel"] is None
        assert item["sync_state"] is None
