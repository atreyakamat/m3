/** Follow-ups Queue — treatment follow-up visits. Ported from the legacy
 *  `followups` records table: patient, due date, protocol day, status,
 *  adherence and outcome. Scheduling is a parent-owned flow (canSchedule). */
import { Badge, Button, DataTable, EmptyState, ErrorState, Page, PageHeader } from "../ui/components";
import type { FollowUpItem, PagePayload } from "../types";

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return s; }
}

const FOLLOWUPS_EMPTY: React.ReactNode = <EmptyState title="No follow-ups match"
  message="No follow-up visits matched your role permissions. Scheduled visits appear here as treatment courses progress." />;

export function FollowUpsScreen({ page, loading, error, requestId, onRefresh, canSchedule, onSchedule }:
  {
    page: PagePayload<FollowUpItem> | null; loading: boolean; error: string; requestId: string | null;
    onRefresh: () => void;
    /** Scheduling is worker-context (worker drawer) in the legacy app; optional. */
    canSchedule?: boolean; onSchedule?: () => void;
  }) {
  const rows = page?.items ?? [];

  const renderRow = (f: FollowUpItem) => {
    const isOverdue = new Date(f.due_at).getTime() < Date.now() && f.status !== "completed";
    return {
      patient: <span className="m3-hint">{f.patient_id.slice(0, 8)}…</span>,
      due: fmtDate(f.due_at),
      day: <span className="m3-cell-main">{f.scheduled_day || "Routine"}</span>,
      status: <Badge tone={isOverdue ? "danger" : f.status === "completed" ? "ok" : "neutral"}>
        {isOverdue ? "Overdue" : f.status?.toUpperCase() || "Due"}
      </Badge>,
      adherence: f.adherence
        ? <Badge tone="neutral" dot={false}>{f.adherence}</Badge>
        : <span className="m3-hint">—</span>,
      outcome: f.outcome
        ? <Badge tone="neutral" dot={false}>{f.outcome}</Badge>
        : <span className="m3-hint">—</span>,
    };
  };

  return (
    <Page>
      <PageHeader title="Follow-ups Queue"
        subtitle="Treatment follow-up visits. Overdue items escalate automatically once their due date passes without completion."
        actions={<>
          {canSchedule && onSchedule ? (
            <Button variant="primary" size="sm" onClick={onSchedule} aria-label="Schedule follow-up">
              Schedule follow-up
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>
        </>} />

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !page}
        caption="Follow-up visits (role-scoped)"
        rows={rows}
        rowKey={(f) => f.id}
        emptyState={FOLLOWUPS_EMPTY}
        columns={[
          { key: "patient", label: "Patient", render: (r) => renderRow(r).patient },
          { key: "due", label: "Due", render: (r) => renderRow(r).due },
          { key: "day", label: "Protocol Day", render: (r) => renderRow(r).day },
          { key: "status", label: "Status", render: (r) => renderRow(r).status },
          { key: "adherence", label: "Adherence", render: (r) => renderRow(r).adherence },
          { key: "outcome", label: "Outcome", render: (r) => renderRow(r).outcome },
        ]}
      />
      {page ? <p className="m3-hint" style={{ marginTop: 8 }}>
        Showing {page.items.length} of {page.total} follow-up(s). Records are identified by opaque patient IDs — open the worker roster for details.
      </p> : null}
    </Page>
  );
}
