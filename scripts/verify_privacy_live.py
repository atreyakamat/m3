#!/usr/bin/env python3
"""Live clinical-privacy and notification-routing verification (all seven roles).

Runs against a RUNNING API using only synthetic data it creates itself. It writes
rows (accounts, sites, cases), so point it at a disposable or development
database, never at pilot/production data.

  M3_E2E_BASE_URL=http://127.0.0.1:8011/api/v1 \
  M3_BOOTSTRAP_SECRET=... python scripts/verify_privacy_live.py

Requires the seeded demo accounts (+919000000001..7, PIN 2468) for the seven roles
and the bootstrap secret to provision two synthetic contractors. Clinical urgency
codes and wording are NOT asserted beyond what the server returns (they remain
pending formal clinical approval).

Checks: object-level case access per role, redaction of symptom text and clinician
free-text notes, cross-worker and cross-site denial, notification recipients and
minimal contractor bodies, read-receipt ownership, replay idempotency, and the
`after=` reconnect catch-up contract (response shape: items/total/unread).
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get("M3_E2E_BASE_URL", "http://127.0.0.1:8001/api/v1").rstrip("/")
SECRET = os.environ.get("M3_BOOTSTRAP_SECRET", "")
PIN = "2468"
RUN = uuid.uuid4().hex[:8]
SYMPTOM_MARKER = f"SYMPTOMTEXT-{RUN}"
NOTE_MARKER = f"CLINICIANNOTE-{RUN}"

results = []


def req(path, method="GET", body=None, token=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})}
    if token:
        h["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {}), raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw), raw
        except ValueError:
            return e.code, raw, raw


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  -> {detail}"))


def login(phone):
    s, b, _ = req("/auth/login", "POST", {"phone": phone, "pin": PIN})
    assert s == 200, f"login {phone}: {s} {b}"
    return b["access_token"], b["user"]


def phone():
    return "+9190" + str(uuid.uuid4().int)[:8]


def provision_contractor(label):
    p = phone()
    s, b, _ = req("/bootstrap/users", "POST", {
        "phone": p, "pin": PIN, "display_name": f"Synthetic Contractor {label}", "roles": ["contractor"],
        "preferred_language": "en", "technical_provisioner": False},
        headers={"X-Bootstrap-Secret": SECRET})
    assert s == 201, f"bootstrap contractor {label}: {s} {b}"
    return login(p)[0], b["id"]


def new_site(token, label):
    s, b, _ = req("/sites", "POST", {
        "code": f"V{RUN}{label}".upper()[:20], "name": f"Verify Site {label} {RUN}",
        "contractor_name": f"Verify Co {label}", "district": "North Goa", "area": "Panaji"}, token)
    assert s == 201, f"create site {label}: {s} {b}"
    return b["id"]


def new_worker(site_token=None, site_id=None):
    p = phone()
    s, b, _ = req("/auth/signup", "POST", {"phone": p, "pin": PIN, "display_name": f"Verify Worker {RUN}", "role": "worker"})
    assert s == 201, f"signup: {s} {b}"
    tok, pid = b["access_token"], b["user"]["patient_id"]
    if site_token:
        s, b, _ = req(f"/workers/{pid}/membership", "POST", {"site_id": site_id}, site_token)
        assert s in (200, 201), f"membership: {s} {b}"
    return tok, pid


def report(token, symptoms, rid=None):
    return req("/symptom-reports", "POST", {
        "symptoms": symptoms, "onset_category": "1_3_days", "description": SYMPTOM_MARKER,
        "attend_facility": "no", "contact_pref": "call",
        "client_request_id": rid or f"v-{RUN}-{uuid.uuid4().hex[:10]}"}, token)


def notes_for(token, case_id=None, **q):
    qs = ("?" + urllib.parse.urlencode(q)) if q else ""
    s, b, _ = req("/notifications" + qs, token=token)
    assert s == 200, f"notifications: {s} {b}"
    items = [n for n in b["items"] if case_id is None or n["case_id"] == case_id]
    return b, items


def main():
    s, _, _ = req("/health")
    check("API reachable", s == 200, s)

    # ---- seven roles authenticate ----
    seeded = {"worker": "+919000000001", "clinician": "+919000000002", "pathologist": "+919000000003",
              "health_worker": "+919000000004", "research_lab": "+919000000005", "contractor": "+919000000006",
              "admin": "+919000000007"}
    tok = {}
    for role, ph in seeded.items():
        tok[role], user = login(ph)
        have = set(user["roles"]) | ({"pathologist"} if "pathology" in user["roles"] else set())
        check(f"login as {role}", role in have, user["roles"])

    # ---- synthetic, properly configured topology ----
    tokA, idA = provision_contractor("A")
    tokB, idB = provision_contractor("B")
    siteA, siteB = new_site(tokA, "A"), new_site(tokB, "B")
    w1, p1 = new_worker(tokA, siteA)   # worker at site A
    w2, p2 = new_worker(tokB, siteB)   # worker at site B (cross-worker / cross-site subject)

    s, b, _ = report(w1, ["fever", "confusion"])
    check("worker1 symptom report creates case", s == 201, (s, b))
    case_id = b["case_id"]
    # replay idempotency: the same client_request_id must resolve to the same case
    rid = f"replay-{RUN}"
    s1, first, _ = report(w1, ["fever"], rid)
    s2, again, _ = report(w1, ["fever"], rid)
    check("replayed client_request_id returns same case, 200 duplicate",
          s1 == 201 and s2 == 200 and again.get("duplicate") and again["case_id"] == first["case_id"], (s1, s2, again))

    # ---- cross-account idempotency replay: non-disclosing 409, same-account retry still works ----
    xrid = f"xacct-{RUN}"
    s, mine1, _ = req("/symptom-reports", "POST", {"symptoms": ["fever"], "description": SYMPTOM_MARKER,
                                                    "client_request_id": xrid}, w1)
    s_own, own_again, _ = req("/symptom-reports", "POST", {"symptoms": ["fever"], "client_request_id": xrid}, w1)
    check("same-account symptom replay -> 200 same case", s == 201 and s_own == 200 and own_again["case_id"] == mine1["case_id"], (s, s_own))
    s, b, raw = req("/symptom-reports", "POST", {"symptoms": ["fever"], "client_request_id": xrid}, w2)
    check("other worker replaying the request id -> 409, nothing disclosed",
          s == 409 and mine1["case_id"] not in raw and mine1["case_code"] not in raw, (s, raw[:150]))
    s, b, raw = req("/symptom-reports", "POST", {"symptoms": ["fever"], "client_request_id": xrid}, tok["clinician"])
    check("clinician replaying a worker request id denied (role)", s == 403, s)
    rrid = f"xreg-{RUN}"
    reg_body = {"display_name": f"Replay Probe {RUN}", "consent_status": "documented", "client_request_id": rrid}
    s0, reg_first, _ = req("/workers", "POST", reg_body, tokA)             # contractor registers a worker
    s1, reg_again, _ = req("/workers", "POST", reg_body, tokA)
    check("same-account registration replay -> 200 same profile", s0 == 201 and s1 == 200 and reg_again["id"] == reg_first["id"], (s0, s1))
    for who, t in (("worker", w2), ("other contractor", tokB)):
        s, b, raw = req("/workers", "POST", reg_body, t)
        check(f"{who} replaying a registration request id -> 409, nothing disclosed",
              s == 409 and reg_first["id"] not in raw and reg_first["patient_code"] not in raw and "Replay Probe" not in raw, (s, raw[:150]))

    # ---- clinician can act; adds a free-text note that must stay clinical ----
    s, b, _ = req(f"/cases/{case_id}/acknowledge", "POST", token=tok["clinician"])
    check("clinician acknowledges case", s == 200, (s, b))
    s, b, _ = req(f"/cases/{case_id}/transition", "POST", {"to_status": "in_assessment", "note": NOTE_MARKER}, tok["clinician"])
    check("clinician transition with free-text note", s == 200, (s, b))

    # ---- object-level access + redaction per role ----
    def detail(token):
        return req(f"/cases/{case_id}", token=token)

    s, b, raw = detail(tok["clinician"])
    check("clinician sees symptoms and notes", s == 200 and SYMPTOM_MARKER in raw and NOTE_MARKER in raw, s)
    s, b, raw = detail(tok["pathologist"])
    check("pathologist allowed (clinical viewer)", s == 200, s)
    for who, token in (("worker (owner)", w1), ("contractor (own site)", tokA), ("admin", tok["admin"])):
        s, b, raw = detail(token)
        check(f"{who}: allowed, no symptom text / clinician note",
              s == 200 and SYMPTOM_MARKER not in raw and NOTE_MARKER not in raw, (s, raw[:200]))
    s, b, raw = detail(tokA)
    check("contractor payload is operational fields only",
          s == 200 and not ({"report", "patient", "events", "assessments", "samples", "followups"} & set(b)), sorted(b))
    s, b, raw = detail(w1)
    check("worker timeline carries no clinician note or actor ids",
          "events" not in b and all(set(e) <= {"to_status", "created_at"} for e in b.get("status_timeline", [])), b.keys())

    for who, token in (("other worker (cross-worker)", w2), ("other site's contractor (cross-site)", tokB),
                       ("unassigned health_worker", tok["health_worker"]), ("research_lab", tok["research_lab"]),
                       ("seeded site-less contractor", tok["contractor"]), ("seeded worker", tok["worker"])):
        s, b, raw = detail(token)
        check(f"{who}: denied", s in (403, 404) and SYMPTOM_MARKER not in raw, (s, raw[:120]))

    # list scoping
    def listed(token):
        s, b, _ = req("/cases?limit=100", token=token)
        return s, ({c["id"] for c in b["items"]} if s == 200 else set())
    for who, token, expect in (("worker1", w1, True), ("contractor A", tokA, True), ("clinician", tok["clinician"], True),
                               ("worker2", w2, False), ("contractor B", tokB, False)):
        s, ids = listed(token)
        check(f"case list scoping: {who} {'sees' if expect else 'does not see'} case", s == 200 and (case_id in ids) == expect, (s, len(ids)))
    s, _, _ = req("/cases", token=tok["research_lab"])
    check("research_lab case list denied", s == 403, s)

    # worker cannot read another worker's profile / questionnaires
    s, _, _ = req(f"/workers/{p1}", token=w2)
    check("cross-worker profile read denied", s in (403, 404), s)
    s, _, _ = req(f"/workers/{p1}", token=tokB)
    check("cross-site contractor profile read denied", s in (403, 404), s)

    # ---- notification routing ----
    nb, mine = notes_for(tok["clinician"], case_id)
    check("clinician notified (non-minimal)", len(mine) >= 1 and not mine[0]["body_minimal"], mine)
    nb, mine = notes_for(tokA, case_id)
    blob = json.dumps(mine).lower()
    check("site-A contractor gets exactly one MINIMAL notice, no clinical content",
          len(mine) == 1 and mine[0]["body_minimal"] and "confusion" not in blob and "fever" not in blob
          and SYMPTOM_MARKER.lower() not in blob and mine[0]["kind"] == "case_site_coordination", mine)
    for who, token in (("site-B contractor", tokB), ("worker2", w2), ("seeded contractor", tok["contractor"]),
                       ("research_lab", tok["research_lab"]), ("health_worker", tok["health_worker"]),
                       ("admin", tok["admin"])):
        _, mine = notes_for(token, case_id)
        check(f"{who}: no notification for the case", not mine, mine)
    _, mine = notes_for(w1, case_id)
    check("reporting worker gets no clinical-review notification", not [n for n in mine if n["kind"] == "case_clinical_review"], mine)

    # seeded demo topology: SYN-SITE-01 contractor is scoped/owner of the seeded worker's site,
    # so the seeded worker's report must reach the seeded contractor (minimal) and nobody at site A/B.
    s, sb, _ = report(tok["worker"], ["fever"])
    if s == 201:
        _, mine = notes_for(tok["contractor"], sb["case_id"])
        check("seeded contractor receives minimal notice for seeded site's case",
              len(mine) == 1 and mine[0]["body_minimal"], mine)
        _, mine = notes_for(tokA, sb["case_id"])
        check("site-A contractor gets nothing for the seeded site's case", not mine, mine)
    else:
        check("seeded worker can report (seeded site topology)", False, (s, sb))

    # read-receipt ownership
    _, cl_notes = notes_for(tok["clinician"], case_id)
    nid = cl_notes[0]["id"]
    s, _, _ = req("/notifications/read", "POST", {"ids": [nid]}, tokA)
    check("cannot mark another user's notification read", s == 403, s)
    s, b, _ = req("/notifications/read", "POST", {"ids": [nid]}, tok["clinician"])
    check("recipient can mark own notification read", s == 200 and b.get("updated") == 1, (s, b))

    # replay produced no extra clinician notice for the replayed request
    _, rep_notes = notes_for(tok["clinician"], first["case_id"])
    check("replayed report did not duplicate clinician notification",
          len([n for n in rep_notes if n["kind"] == "case_clinical_review"]) == 1, len(rep_notes))

    # ---- reconnect catch-up contract (actual schema: items/total/unread) ----
    base, all_items = notes_for(tok["clinician"])
    check("notification response schema", {"items", "total", "unread"} <= set(base), list(base))
    cursor = max(n["created_at"] for n in all_items)
    old_ids = {n["id"] for n in all_items}
    s, b3, _ = report(w1, ["fever"])
    new_case = b3["case_id"]
    after, missed = notes_for(tok["clinician"], after=cursor)
    got_ids = {n["id"] for n in after["items"]}
    check("catch-up returns the new notification", any(n["case_id"] == new_case for n in after["items"]), after)
    check("catch-up excludes everything at/before cursor", not (got_ids & old_ids), got_ids & old_ids)
    check("catch-up total matches items", after["total"] == len(after["items"]), (after["total"], len(after["items"])))
    far, _ = notes_for(tok["clinician"], after="2999-01-01T00:00:00Z")
    check("catch-up after far-future cursor is empty", far["items"] == [] and far["total"] == 0, far)
    unread_only, _ = notes_for(tok["clinician"], unread_only="true", after=cursor)
    check("unread_only+after filter works", all(n["read_at"] is None for n in unread_only["items"]) and unread_only["total"] >= 1, unread_only)
    p1_, _ = notes_for(tok["clinician"], limit=1, offset=0)
    p2_, _ = notes_for(tok["clinician"], limit=1, offset=1)
    check("pagination stable and non-overlapping", len(p1_["items"]) == 1 and len(p2_["items"]) == 1
          and p1_["items"][0]["id"] != p2_["items"][0]["id"], (p1_, p2_))

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("FAILED:", *failed, sep="\n  - ")
        sys.exit(1)


if __name__ == "__main__":
    if not SECRET:
        sys.exit("Set M3_BOOTSTRAP_SECRET (needed to provision two synthetic contractors).")
    main()
