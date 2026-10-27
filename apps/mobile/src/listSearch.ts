/**
 * List name-search request logic (Workers / Diagnostics lists), node:testable.
 *
 * Guarantees recorded in the validation report §25:
 * - one request per settled query (debounced upstream), never one per keystroke;
 * - a stale response can never replace a newer result (monotonic sequence);
 * - the query is trimmed before it reaches the URL, and an empty query sends
 *   no q parameter at all (list returns to its unfiltered state);
 * - pagination offset stays in sync with the query so a cleared/re-typed
 *   search does not page into a bucket that no longer exists.
 */

export const SEARCH_DEBOUNCE_MS = 350
export const LIST_PAGE_SIZE = 50

/** Monotonic sequence guard shared between in-flight list requests: only the
 *  newest request may commit its result. */
export class SearchSeq {
  private n = 0
  begin(): number { this.n += 1; return this.n }
  /** True when `k` is still the newest request (may commit). */
  isCurrent(k: number): boolean { return k === this.n }
}

/** Trim leading/trailing whitespace. Server trims too; the client must not
 *  even display or send a whitespace-only query. */
export function normalizeQuery(q: string): string {
  return q.trim()
}

/** True when a real search is active (controls clear-button and empty state). */
export function isSearching(q: string): boolean {
  return normalizeQuery(q).length > 0
}

/** Query path for GET /workers (server-scoped: role, assignment, site, and
 *  research-eligibility filters are added by the backend, never the client). */
export function workersListPath(q: string, offset = 0, limit = LIST_PAGE_SIZE): string {
  const query = normalizeQuery(q)
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (query) params.set('q', query)
  return `/workers?${params.toString()}`
}

/** Query path for GET /samples (Diagnostics list; lab-scope authorization is
 *  backend-enforced; research_lab stays eligibility-gated and PII-stripped). */
export function samplesListPath(q: string, offset = 0, limit = LIST_PAGE_SIZE): string {
  const query = normalizeQuery(q)
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (query) params.set('q', query)
  return `/samples?${params.toString()}`
}
