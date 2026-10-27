/** Server-backed name search — shared logic for the Workers and Diagnostics
 *  lists. Pure, dependency-free helpers so the request behavior is testable:
 *  - one monotonic sequence guard shared between in-flight requests so a
 *    slower OLDER response can never overwrite a NEWER one;
 *  - the exact query-string building for GET /workers and GET /samples
 *    (trimmed query, cleared query omits the parameter entirely). */

/** Monotonic request sequence guard. `begin()` bumps and marks a new request;
 *  only the most recent request may commit its result. */
export class SearchSeq {
  private n = 0;
  begin(): number { this.n += 1; return this.n; }
  /** True when `k` is still the newest request (may commit). */
  isCurrent(k: number): boolean { return k === this.n; }
}

/** Client-side trim: the server also trims, but the UI must not even send
 *  (or badge_count on) a whitespace-only query. */
export function normalizeQuery(q: string): string {
  return q.trim();
}

/** True when the normalized query is a real search (affects showing the
 *  clear control and the "no match" empty state vs the plain empty list). */
export function isSearching(q: string): boolean {
  return normalizeQuery(q).length > 0;
}

/** Query string for the authorized list endpoints. Keeps ONE construction
 *  point so the web Workers and Diagnostics lists behave identically and the
 *  server-side scope is the only filter. */
export function listPathFor(tab: "workers" | "samples", query: string, limit = 50): string {
  const q = normalizeQuery(query);
  const base = tab === "workers" ? "/workers" : "/samples";
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (q) params.set("q", q);
  return `${base}?${params.toString()}`;
}

/** Milliseconds to wait for the user to stop typing before the server is
 *  queried (avoids one request per keystroke on large rosters). */
export const SEARCH_DEBOUNCE_MS = 350;
