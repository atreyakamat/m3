/** Surveillance Reports — role-scoped dashboard summary (GET /dashboard
 *  payload, three documented shapes). Honest about what the console can
 *  and cannot deliver: no aggregate download lives in this API. */
import { Button, Card, ErrorState, Metric, Page, PageHeader, Skeleton } from "../ui/components";
import { visibleNav } from "../lib/roles";
import { useSession } from "../lib/session";
import type { DashboardPayload } from "../types";

export function ReportsScreen({ data, loading, error, requestId, onRetry, onGo }:
  {
    data: DashboardPayload | null; loading: boolean; error: string; requestId: string | null;
    onRetry: () => void; onGo: (tab: string) => void;
  }) {
  const { session } = useSession();
  const roles = session?.user?.roles ?? [];
  const nav = visibleNav(roles);
  const scope = data?.scope;

  return (
    <Page>
      <PageHeader title="Surveillance Reports"
        subtitle={data?.note ?? "Role-scoped operational summary of the malaria elimination programme."}
        actions={<Button variant="secondary" size="sm" onClick={onRetry}>Refresh</Button>} />

      {error ? <ErrorState message={error} onRetry={onRetry} requestId={requestId} /> : null}
      {loading && !data ? <Skeleton card /> : null}

      {!loading && data && scope === "authorized_operational" && "samples_pending" in data ? (
        <div className="metric-grid">
          <Metric label="Workers on record" value={data.workers} hint="Registered patient profiles" />
          <Metric label="Samples pending" value={data.samples_pending} tone={data.samples_pending > 0 ? "warn" : undefined} hint="Awaiting diagnostic results" />
          <Metric label="Tests positive" value={data.tests_positive} tone="danger" hint="Cumulative lab-confirmed positives" />
          <Metric label="Follow-ups due" value={data.followups_due} tone={data.followups_due > 0 ? "warn" : "ok"} />
          <Metric label="Overdue" value={data.followups_overdue} tone={data.followups_overdue > 0 ? "danger" : "ok"} />
        </div>
      ) : null}
      {!loading && data && scope === "managed_sites" ? (
        <div className="metric-grid">
          <Metric label="Active sites" value={data.sites} hint="Sites under your management" />
          <Metric label="Workers on roster" value={data.workers} hint="Currently assigned at your sites" />
        </div>
      ) : null}
      {!loading && data && scope === "own" ? (
        <div className="metric-grid">
          <Metric label="Registered" value={data.workers === 1 ? "Yes" : "Not yet"} tone={data.workers === 1 ? "ok" : "warn"} hint="Worker registration questionnaire" />
          <Metric label="Follow-ups due" value={data.followups_due} tone={data.followups_due > 0 ? "warn" : "ok"} />
        </div>
      ) : null}

      <div style={{ marginTop: "var(--sp-5)" }}>
        <Card title="Reporting limitations"
          subtitle="What this report does and does not contain — stated plainly.">
          <ul style={{ margin: "0 0 var(--sp-4)", paddingLeft: 20, color: "var(--text-2)", fontSize: "var(--fs-md)" }}>
            <li style={{ marginBottom: 6 }}>
              No downloadable aggregate PDF/CSV is available from this API — these metrics cannot be exported
              as a file from this screen.
            </li>
            <li style={{ marginBottom: 6 }}>
              Surveillance Analytics (when your role includes it) provides CSV export of test and case data —
              use it for anything you need as a spreadsheet.
            </li>
            <li>
              The metrics above are operational counts (records processed by this programme), not
              epidemiological rates. They are not incidence or prevalence measures and should not be
              presented as such.
            </li>
          </ul>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {nav.includes("analytics") ? (
              <Button variant="primary" size="sm" onClick={() => onGo("analytics")}>Open Surveillance Analytics</Button>
            ) : null}
            {nav.includes("cases") ? (
              <Button variant="secondary" size="sm" onClick={() => onGo("cases")}>Review case queue →</Button>
            ) : null}
            {nav.includes("research") ? (
              <Button variant="secondary" size="sm" onClick={() => onGo("research")}>Research results →</Button>
            ) : null}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: "var(--sp-6)" }}>
        <Card title="Goa Malaria Elimination Surveillance Protocol">
          <p style={{ color: "var(--text-2)", fontSize: "var(--fs-md)", marginTop: 0 }}>
            Under the Goa State Comprehensive Malaria Surveillance Framework (M3), active screening
            questionnaires, point-of-care RDTs, and confirmatory laboratory microscopy are tracked
            chronologically. Diagnostic findings inform clinician care plans without automated override.
            Health workers dispatch follow-up visits on Day 3, 7, 14, and 28 to ensure radical cure and
            prevent secondary transmission in migrant labour settlements.
          </p>
        </Card>
      </div>
    </Page>
  );
}
