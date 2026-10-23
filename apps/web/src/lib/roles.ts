/** M3 single source of role truth (mirrors services/api/app/permissions.py).
 *  The legacy id "pathology" is accepted wherever a role string is compared
 *  so accounts seeded before the rename keep working. */

export const ROLES = ["worker", "contractor", "pathologist", "clinician", "health_worker", "research_lab", "admin"] as const;
export type Role = (typeof ROLES)[number];
/** Legacy identifier tolerated server-side. */
export const LEGACY_PATHOLOGIST = "pathology";

export const READ_ONLY_ROLES: ReadonlySet<string> = new Set(["health_worker", "research_lab", "admin"]);

export function isPathologist(role: string): boolean {
  return role === "pathologist" || role === LEGACY_PATHOLOGIST;
}
export function isReadOnlyRole(role: string): boolean {
  return READ_ONLY_ROLES.has(role);
}

export const ROLE_LABELS: Record<string, string> = {
  worker: "Labour Worker",
  contractor: "Contractor",
  pathologist: "Pathologist",
  pathology: "Pathologist",
  clinician: "Clinician / Medical Officer",
  health_worker: "Health Worker",
  research_lab: "Research Lab",
  admin: "Administrator",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

export function rolesLabel(roles: string[]): string {
  const clean = roles.map(roleLabel).join(", ");
  return clean || "No role";
}

/* ------------------------------------------------------------------ nav
 * Nav model: what each role may see on the web console. Server-side
 * authorization remains the real boundary; this only shapes navigation.
 */
export type NavSection = "overview" | "analytics" | "cases" | "workers" | "samples" | "followups" | "sites" | "research" | "reports" | "audit";

export const NAV_ACCESS: Record<Exclude<NavSection, "overview">, string[]> = {
  analytics: ["admin", "clinician", "research_lab", "pathologist", "pathology"],
  cases: ["clinician", "admin", "contractor", "health_worker", "pathologist", "pathology"],
  workers: ["health_worker", "contractor", "admin", "clinician"],
  samples: ["pathologist", "pathology", "clinician"],
  followups: ["health_worker", "clinician", "admin"],
  sites: ["contractor", "health_worker", "admin", "clinician"],
  research: ["research_lab", "clinician"],
  reports: ["health_worker", "research_lab", "admin", "clinician", "contractor", "worker"],
  audit: ["admin"],
};

export function visibleNav(roles: string[]): NavSection[] {
  const nav: NavSection[] = ["overview"];
  // Worker sees overview only — the worker console is the mobile app.
  if (roles.length === 1 && roles[0] === "worker") return ["overview"];
  for (const [section, allowed] of Object.entries(NAV_ACCESS) as Array<[Exclude<NavSection, "overview">, string[]]>) {
    if (roles.some((role) => allowed.includes(role))) nav.push(section);
  }
  return nav;
}

export function hasWriteRole(roles: string[]): boolean {
  // True when the user holds at least one role that can (per server policy)
  // write clinical/site data.
  return roles.some((r) => r === "clinician" || isPathologist(r) || r === "contractor");
}
