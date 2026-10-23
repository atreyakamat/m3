/** Semantic status→tone mapping tests — node --test. */
import test from "node:test";
import assert from "node:assert/strict";
import { toneForStatus } from "../src/ui/tokens.ts";

test("known status vocabulary maps to documented tones", () => {
  assert.equal(toneForStatus("screened"), "ok");
  assert.equal(toneForStatus("positive"), "danger");
  assert.equal(toneForStatus("negative"), "ok");
  assert.equal(toneForStatus("pending"), "warn");
  assert.equal(toneForStatus("queued"), "warn");
  assert.equal(toneForStatus("acknowledged"), "info");
  assert.equal(toneForStatus("unknown"), "neutral");
});

test("unknown statuses degrade to neutral, not to error tones", () => {
  assert.equal(toneForStatus("some_future_status"), "neutral");
});

test("keyword fallbacks for statuses added later by the backend", () => {
  assert.equal(toneForStatus("test_failed"), "danger");
  assert.equal(toneForStatus("in_progress"), "info");
  assert.equal(toneForStatus("overdue"), "danger");
});

test("empty/undefined-ish input is safe", () => {
  assert.equal(toneForStatus(""), "neutral");
});
