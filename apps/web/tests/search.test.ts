/** Unit tests: server-backed name search request logic (Workers/Diagnostics). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SearchSeq, normalizeQuery, isSearching, listPathFor, SEARCH_DEBOUNCE_MS } from "../src/lib/search.ts";

test("stale responses are never committed: older seq.isCurrent == false after newer begins", () => {
  const seq = new SearchSeq();
  const first = seq.begin();
  assert.ok(seq.isCurrent(first), "newest request is current");
  const second = seq.begin();
  assert.equal(seq.isCurrent(first), false, "older in-flight request becomes stale");
  assert.ok(seq.isCurrent(second), "newer request stays current");
});

test("a retried request after failure is a fresh current sequence", () => {
  const seq = new SearchSeq();
  const a = seq.begin();
  const b = seq.begin(); // e.g. rapid keystrokes
  assert.notEqual(a, b);
  assert.ok(seq.isCurrent(b));
});

test("normalizeQuery trims leading and trailing whitespace", () => {
  assert.equal(normalizeQuery("  ram  "), "ram");
  assert.equal(normalizeQuery("\tRama\n"), "Rama");
  assert.equal(normalizeQuery("   "), "");
});

test("whitespace-only query is not a search", () => {
  assert.ok(!isSearching("   "));
  assert.ok(isSearching(" r "));
});

test("empty query sends no q parameter (list returns to unfiltered state)", () => {
  assert.equal(listPathFor("workers", ""), "/workers?limit=50");
  assert.equal(listPathFor("workers", "   "), "/workers?limit=50");
  assert.equal(listPathFor("samples", ""), "/samples?limit=50");
});

test("query is URL-encoded once: full and partial names, case is preserved", () => {
  assert.equal(listPathFor("workers", "Rama K"), "/workers?limit=50&q=Rama+K");
  assert.equal(listPathFor("samples", "kumar"), "/samples?limit=50&q=kumar");
  // client passes the user's string through; server is case-insensitive
  assert.equal(listPathFor("workers", "RaMA"), "/workers?limit=50&q=RaMA");
});

test("trim happens before encoding: no leading/trailing %20 noise", () => {
  assert.equal(listPathFor("workers", "  ram "), "/workers?limit=50&q=ram");
});

test("debounce constant is a sane wait (not per-keystroke, not leisurely)", () => {
  assert.ok(SEARCH_DEBOUNCE_MS >= 200 && SEARCH_DEBOUNCE_MS <= 600);
});
