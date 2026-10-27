/** Dashboard count-card navigation mapping (report §24).
 *
 *  Pure module (no DOM) so the card → list-screen routing decisions are
 *  unit-testable in `tests/metricNav.test.ts`.
 *
 *  Rule: a count card is tappable ONLY when the signed-in role can actually
 *  open the matching record list with server-side authorization intact.
 *  `visibleNav()` shapes navigation; the server remains the real boundary.
 *  Where a tab exists in navigation but the list endpoint itself refuses the
 *  role (GET /samples requires pathologist/pathology/research_lab), the card
 *  stays inert instead of navigating into a guaranteed authorization error.
 */
import type { NavSection } from "./roles.ts";
import { visibleNav } from "./roles.ts";

/** Roles the GET /samples list endpoint accepts (services/api/app/main.py).
 *  Clinicians keep their samples nav tab for per-worker lab context, but the
 *  bulk list endpoint is not opened for them, so "Samples pending" /
 *  "Tests positive" cards stay inert under a clinician-only session. */
export const SAMPLE_LIST_ROLES: ReadonlySet<string> = new Set([
  "pathologist",
  "pathology", // legacy identifier tolerated server-side
  "research_lab",
]);

export type ListMetric = "workers" | "samples" | "tests_positive" | "followups" | "followups_overdue" | "cases" | "research" | "sites";

/** The tab a count card opens, or null when the role has no authorized list
 *  destination for it (card renders non-interactive). */
export function metricDestination(metric: ListMetric, roles: string[]): NavSection | null {
  const nav = visibleNav(roles);
  switch (metric) {
    case "workers":
      return nav.includes("workers") ? "workers" : null;
    case "samples":
    case "tests_positive":
      return roles.some((r) => SAMPLE_LIST_ROLES.has(r)) ? "samples" : null;
    case "followups":
    case "followups_overdue":
      return nav.includes("followups") ? "followups" : null;
    case "cases":
      return nav.includes("cases") ? "cases" : null;
    case "research":
      return nav.includes("research") ? "research" : null;
    case "sites":
      return nav.includes("sites") ? "sites" : null;
  }
}

/** Accessibility label describing the DESTINATION (report §2 requirement 9). */
export function destinationLabel(dest: NavSection): string {
  switch (dest) {
    case "workers":
      return "Open the worker records list";
    case "samples":
      return "Open the diagnostic samples list";
    case "followups":
      return "Open the follow-up queue";
    case "cases":
      return "Open the case queue";
    case "research":
      return "Open the research results list";
    case "sites":
      return "Open the sites list";
    default:
      return `Open ${dest} list`;
  }
}
