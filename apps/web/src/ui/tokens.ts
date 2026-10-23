/** M3 Design System — TS mirror of ui/tokens.css (for component logic only;
 *  styling itself must use the CSS variables so theming stays in one place). */

export const sp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "violet" | "accent";

/** Semantic tone per known status vocabulary (server enums; presentation only). */
export const STATUS_TONES: Record<string, Tone> = {
  // case / screening
  screened: "ok", pending: "warn", open: "info", acknowledged: "info",
  closed: "ok", resolved: "ok", positive: "danger", negative: "ok",
  unavailable: "neutral", unknown: "neutral", failed: "danger",
  // drafts / sync (mobile parity)
  queued: "warn", syncing: "info",
};

export function toneForStatus(status: string): Tone {
  if (STATUS_TONES[status]) return STATUS_TONES[status];
  const s = status?.toLowerCase() ?? "";
  if (/(^|_)(ok|clean|pass|connected|ready)/.test(s)) return "ok";
  // Danger outranks warn: "overdue" must not be swallowed by the "due" branch.
  if (/(fail|error|critical|overdue|reject|expire)/.test(s)) return "danger";
  if (/(warn|pending|due|stale|partial|queued)/.test(s)) return "warn";
  if (/(info|active|open|in_progress|acknowledged)/.test(s)) return "info";
  return "neutral";
}

/** Shared split for contractor UX: self-reported vs laboratory-confirmed. */
export const REPORTED_VS_CONFIRMED = {
  self_reported: "Self-reported",
  laboratory_confirmed: "Lab-confirmed",
} as const;

export const BREAKPOINTS = { mobile: 720, tablet: 1080 } as const;
