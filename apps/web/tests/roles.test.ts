/** Role/navigation permission tests — node --test (pure module, no DOM/API). */
import test from "node:test";
import assert from "node:assert/strict";
import { visibleNav, hasWriteRole, isPathologist, isReadOnlyRole } from "../src/lib/roles.ts";

test("labour worker sees only the overview (worker console is mobile)", () => {
  assert.deepEqual(visibleNav(["worker"]), ["overview"]);
});

test("clinician gets clinical navigation", () => {
  const nav = visibleNav(["clinician"]);
  for (const expected of ["overview", "cases", "workers", "samples", "followups", "sites", "research", "reports", "analytics"]) {
    assert.ok(nav.includes(expected as never), `clinician missing ${expected}`);
  }
  assert.ok(!nav.includes("audit" as never), "clinician must not see audit");
});

test("admin is the only role with the audit trail", () => {
  for (const role of ["worker", "clinician", "pathologist", "health_worker", "research_lab", "contractor"]) {
    assert.ok(!visibleNav([role]).includes("audit" as never), `${role} must not see audit`);
  }
  assert.ok(visibleNav(["admin"]).includes("audit" as never));
});

test("legacy pathology id keeps the pathologist navigation", () => {
  const nav = visibleNav(["pathology"]);
  assert.ok(nav.includes("samples" as never), "legacy pathology must see samples");
  assert.ok(nav.includes("cases" as never));
});

test("health worker is read-only: no write-workspace tabs", () => {
  const nav = visibleNav(["health_worker"]);
  assert.ok(!nav.includes("samples" as never));
  assert.ok(nav.includes("cases" as never) && nav.includes("followups" as never));
});

test("research lab sees research results only (plus reads)", () => {
  const nav = visibleNav(["research_lab"]);
  assert.ok(nav.includes("research" as never));
  assert.ok(!nav.includes("samples" as never));
  assert.ok(!nav.includes("workers" as never));
});

test("contractor is site-scoped", () => {
  const nav = visibleNav(["contractor"]);
  assert.ok(nav.includes("sites" as never) && nav.includes("cases" as never));
  assert.ok(!nav.includes("research" as never));
});

test("role helpers", () => {
  assert.equal(isPathologist("pathology"), true);
  assert.equal(isPathologist("pathologist"), true);
  assert.equal(isPathologist("clinician"), false);
  assert.equal(isReadOnlyRole("admin"), true);
  assert.equal(isReadOnlyRole("research_lab"), true);
  assert.equal(isReadOnlyRole("health_worker"), true);
  assert.equal(isReadOnlyRole("clinician"), false);
  assert.equal(hasWriteRole(["clinician"]), true);
  assert.equal(hasWriteRole(["health_worker"]), false);
  assert.equal(hasWriteRole(["admin"]), false);
  assert.equal(hasWriteRole(["worker"]), false);
});
