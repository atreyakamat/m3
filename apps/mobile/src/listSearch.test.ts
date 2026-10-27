/**
 * List name-search regression tests (node:test, `npm run test`).
 *
 * Covers §25 search behaviour guarantees:
 * - exact/partial names pass through; case is preserved for the server to
 *   handle case-insensitively;
 * - leading/trailing whitespace is trimmed and a whitespace-only query is
 *   treated as empty (no q parameter — list returns to unfiltered state);
 * - pagination offset is included and reset by the caller;
 * - stale network responses cannot overwrite newer results (SearchSeq).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SearchSeq, normalizeQuery, isSearching,
  workersListPath, samplesListPath, LIST_PAGE_SIZE, SEARCH_DEBOUNCE_MS,
} from './listSearch.ts'

test('exact full name and partial name both send a q parameter', () => {
  assert.equal(workersListPath('Rama Kumar Singh'), '/workers?limit=50&offset=0&q=Rama+Kumar+Singh')
  assert.equal(workersListPath('ram kum'), '/workers?limit=50&offset=0&q=ram+kum')
  assert.equal(samplesListPath('Priya'), '/samples?limit=50&offset=0&q=Priya')
})

test('case differences travel to the server unchanged (server is case-insensitive)', () => {
  assert.equal(workersListPath('RAMA'), '/workers?limit=50&offset=0&q=RAMA')
  assert.equal(workersListPath('rama'), '/workers?limit=50&offset=0&q=rama')
})

test('leading/trailing spaces are trimmed before the request', () => {
  assert.equal(workersListPath('  rama  '), '/workers?limit=50&offset=0&q=rama')
  assert.equal(samplesListPath('\tpriya\n'), '/samples?limit=50&offset=0&q=priya')
})

test('empty and whitespace-only queries omit q entirely (unfiltered list)', () => {
  assert.equal(workersListPath(''), '/workers?limit=50&offset=0')
  assert.equal(workersListPath('   '), '/workers?limit=50&offset=0')
  assert.equal(samplesListPath(''), '/samples?limit=50&offset=0')
})

test('pagination offset travels with the same query (no duplicate-record pressure)', () => {
  assert.equal(workersListPath('rama', 50), '/workers?limit=50&offset=50&q=rama')
  assert.equal(workersListPath('rama', 100, 25), '/workers?limit=25&offset=100&q=rama')
})

test('default page size and debounce stay sane for bounded server queries', () => {
  assert.ok(LIST_PAGE_SIZE >= 20 && LIST_PAGE_SIZE <= 100)
  assert.ok(SEARCH_DEBOUNCE_MS >= 200 && SEARCH_DEBOUNCE_MS <= 600)
})

test('normalizeQuery + isSearching gate the clear control and empty state', () => {
  assert.equal(normalizeQuery(' x '), 'x')
  assert.equal(isSearching('  '), false)
  assert.equal(isSearching('y'), true)
})

test('stale responses cannot overwrite newer results (SearchSeq)', () => {
  const seq = new SearchSeq()
  const first = seq.begin()
  assert.ok(seq.isCurrent(first))
  const second = seq.begin()
  assert.equal(seq.isCurrent(first), false, 'older request is now stale')
  assert.ok(seq.isCurrent(second), 'newest request commits')
  // a retry after failure gets a fresh sequence
  assert.notEqual(seq.begin(), second)
})
