/** Dashboard count-card navigation tests (report §24) — node --test, pure module.
 *  Verifies that each count card's route decision matches the server's list
 *  authorization: a card is tappable only when the role can actually open the
 *  matching record list (WorkersScreen / SamplesScreen / FollowUpsScreen /
 *  CasesScreen / ResearchScreen / SitesScreen), and null elsewhere. */
import test from "node:test";
import assert from "node:assert/strict";
import { destinationLabel, metricDestination } from "../src/lib/metricNav.ts";

test("pathologist: diagnostics (samples) card opens its list; workers card stays inert (no workers tab in nav)", () => {
  assert.equal(metricDestination("workers", ["pathologist"]), null);
  assert.equal(metricDestination("samples", ["pathologist"]), "samples");
  assert.equal(metricDestination("tests_positive", ["pathologist"]), "samples");
  assert.equal(metricDestination("followups", ["pathologist"]), null); // no follow-ups tab for pathologist
  assert.equal(metricDestination("followups", ["pathologist", "clinician"]), "followups");
});

test("legacy pathology identifier keeps the diagnostics card tappable", () => {
  assert.equal(metricDestination("samples", ["pathology"]), "samples");
  assert.equal(metricDestination("tests_positive", ["pathology"]), "samples");
});

test("clinician: workers + follow-up cards open lists; samples cards stay inert (GET /samples refuses clinicians)", () => {
  assert.equal(metricDestination("workers", ["clinician"]), "workers");
  assert.equal(metricDestination("samples", ["clinician"]), null);
  assert.equal(metricDestination("tests_positive", ["clinician"]), null);
  assert.equal(metricDestination("followups", ["clinician"]), "followups");
  assert.equal(metricDestination("followups_overdue", ["clinician"]), "followups");
});

test("labour worker: no count card opens a list (worker console is the mobile app)", () => {
  for (const metric of ["workers", "samples", "tests_positive", "followups", "cases"] as const) {
    assert.equal(metricDestination(metric, ["worker"]), null), `worker card ${metric} must be inert`;
  }
});

test("health worker: assigned workers + follow-up cards open lists; samples stays inert", () => {
  assert.equal(metricDestination("workers", ["health_worker"]), "workers");
  assert.equal(metricDestination("followups", ["health_worker"]), "followups");
  assert.equal(metricDestination("samples", ["health_worker"]), null);
});

test("research lab: diagnostics cards open the samples list; workers card does not appear", () => {
  assert.equal(metricDestination("samples", ["research_lab"]), "samples");
  assert.equal(metricDestination("tests_positive", ["research_lab"]), "samples");
  assert.equal(metricDestination("workers", ["research_lab"]), null); // research nav has no workers tab
});

test("contractor: roster card opens the worker list and no samples card", () => {
  assert.equal(metricDestination("workers", ["contractor"]), "workers");
  assert.equal(metricDestination("sites", ["contractor"]), "sites");
  assert.equal(metricDestination("samples", ["contractor"]), null);
});

test("admin: workers + follow-up cards open lists; samples cards stay inert (read-only lab boundary)", () => {
  assert.equal(metricDestination("workers", ["admin"]), "workers");
  assert.equal(metricDestination("followups", ["admin"]), "followups");
  assert.equal(metricDestination("samples", ["admin"]), null);
  assert.equal(metricDestination("tests_positive", ["admin"]), null);
});

test("worker samples card opens the samples list when worker holds BOTH worker and pathologist roles", () => {
  assert.equal(metricDestination("samples", ["worker", "pathologist"]), "samples");
  assert.equal(metricDestination("workers", ["worker", "pathologist"]), null); // combined worker+pathology has no workers tab
});

test("accessibility labels describe the destination, not the metric", () => {
  assert.equal(destinationLabel("workers"), "Open the worker records list");
  assert.equal(destinationLabel("samples"), "Open the diagnostic samples list");
  assert.equal(destinationLabel("followups"), "Open the follow-up queue");
});
