/** Overview — role-tailored landing. Uses the /dashboard payload (three
 *  documented shapes). No fabricated metrics: whatever the API does not
 *  return is shown as an explicit limitation, not as invented data. */
import { Badge, Button, Card, ErrorState, Metric, PageHeader, Page, Skeleton } from "../ui/components";
import type { DashboardPayload } from "../types";
import { useSession } from "../lib/session";

export function OverviewScreen({ data, loading, error, requestId, onRetry, onGo }: {
  data: DashboardPayload | null; loading: boolean; error: string; requestId: string | null;
  onRetry: () => void; onGo: (tab: string) => void;
  /** Navigating back to overview invalidates the payload (avoids stale records). */
  dataKey?: string;
}) {
  const { session } = useSession();
  const roles = session?.user?.roles ?? [];
  const scope = data?.scope;
  const title =
    roles.includes("admin") ? "Administrator Overview" :
    roles.includes("research_lab") ? "Research Workspace" :
    roles.includes("health_worker") ? "Field Surveillance Overview" :
    roles.includes("contractor") ? "Site & Workforce Overview" :
    roles.includes("clinician") ? "Clinical Overview" :
    roles.includes("pathologist") ? "Laboratory Overview" : "Overview";

  return (
    <Page>
      <PageHeader
        title={title}
        subtitle={data?.note ?? undefined}
        actions={<Button variant="ghost" size="sm" onClick={() => onGo("reports")}>Surveillance Reports →</Button>}
      />
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
      {!loading && data && scope === "own" && data.workers !== 1 ? (
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Card title="Complete your registration on the M3 mobile app">
            <p style={{ color: "var(--text-2)", fontSize: "var(--fs-md)" }}>
              Worker intake, symptom reporting and case tracking live in the M3 Android app.
              This web console shows your personal status only — it doesn’t accept worker questionnaires.
            </p>
          </Card>
        </div>
      ) : null}
      <div style={{ marginTop: "var(--sp-6)" }}>
        <Card title="Your workspace" subtitle="Navigate with the sidebar — tabs are limited to your role’s authorized scope.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {session?.user.roles.map((r) => <Badge key={r} tone="accent" dot={false}>{r}</Badge>)}
          </div>
          <p className="m3-hint" style={{ marginTop: 10 }}>
            Server-side authorization enforces every endpoint; this console simply never presents a tab your role cannot use.
          </p>
        </Card>
      </div>
    </Page>
  );
}
