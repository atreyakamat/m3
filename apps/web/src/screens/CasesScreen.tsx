/** Case Queue — role-scoped by the server (workers see own; clinicians see
 *  routed; contractors site_code/status minimal; research has no access).
 *  Workflow preserved: POST /cases/{id}/acknowledge. */
import { useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, ChipPicker, DataTable, EmptyState, ErrorState, Page, PageHeader, StatusBadge, useToast, Modal } from "../ui/components";
import type { CaseItem, PagePayload } from "../types";
import { useSession } from "../lib/session";

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return s; }
}

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "awaiting_clinical_review", label: "Awaiting clinical review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_assessment", label: "In assessment" },
  { value: "diagnostic_testing_requested", label: "Test requested" },
  { value: "awaiting_diagnostic_result", label: "Awaiting result" },
  { value: "plan_recorded", label: "Plan recorded" },
  { value: "followup_due", label: "Follow-up due" },
  { value: "followup_completed", label: "Follow-up completed" },
  { value: "closed", label: "Closed" },
];

export function CasesScreen({ page, loading, error, requestId, canAcknowledge, onRefresh }:
  {
    page: PagePayload<CaseItem> | null; loading: boolean; error: string; requestId: string | null;
    canAcknowledge: boolean; onRefresh: () => void;
  }) {
  const { session } = useSession();
  const token = session?.access_token;
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<CaseItem | null>(null);

  async function acknowledge(c: CaseItem) {
    if (!token || busyId) return;
    setBusyId(c.id);
    try {
      await api(`/cases/${c.id}/acknowledge`, token, { method: "POST" });
      toast(`Case ${c.case_code ?? ""} acknowledged`, "ok");
      onRefresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to acknowledge case", "danger");
    } finally {
      setBusyId(null);
    }
  }

  const rows = (page?.items ?? []).filter((c) => !statusFilter || c.status === statusFilter);

  const renderRow = (c: CaseItem) => ({
    code: <span className="m3-cell-main">{c.case_code ?? c.id.slice(0, 8)}</span>,
    status: <StatusBadge status={c.status} />,
    site: c.site_name ?? "—",
    when: fmtDate(c.created_at),
    urgent: c.urgent ? <Badge tone="danger">Urgent</Badge> : <Badge tone="neutral">Normal</Badge>,
    action: canAcknowledge && c.status === "submitted" && !c.acknowledged_at ? (
      <Button size="sm" variant="subtle" loading={busyId === c.id}
        onClick={(e) => { e.stopPropagation(); void acknowledge(c); }}
        aria-label={`Acknowledge case ${c.case_code ?? c.id}`}>
        Acknowledge
      </Button>
    ) : c.acknowledged_at ? <Badge tone="info" dot={false}>Acknowledged</Badge> : <span className="m3-hint">—</span>,
  });

  return (
    <Page>
      <PageHeader title="Case Queue"
        subtitle="One case per health episode. Acknowledge new cases to signal handover; the server enforces transitions."
        actions={<Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>} />

      <div style={{ maxWidth: 340, marginBottom: "var(--sp-4)" }}>
        <ChipPicker ariaPrefix="Filter cases by status" options={STATUS_FILTERS} value={statusFilter}
          onChange={setStatusFilter} />
      </div>

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !page}
        caption="Role-scoped case queue"
        rows={rows}
        rowKey={(c) => c.id}
        onRowClick={(c) => setDetail(c)}
        emptyState={<EmptyState title="No cases match"
          message={statusFilter ? "No cases with this status right now." : "Nothing routed to you at the moment."} />}
        columns={[
          { key: "code", label: "Case", render: (r) => renderRow(r).code, sub: (r) => r.site_name ?? undefined },
          { key: "urgent", label: "Priority", render: (r) => renderRow(r).urgent },
          { key: "status", label: "Status", render: (r) => renderRow(r).status },
          { key: "when", label: "Opened", render: (r) => renderRow(r).when },
          { key: "action", label: "", align: "right", render: (r) => renderRow(r).action },
        ]}
      />
      {page ? <p className="m3-hint" style={{ marginTop: 8 }}>
        Showing {page.items.length} of {page.total} case(s). Older cases: refresh after acknowledging or use a status filter.
      </p> : null}

      <Modal open={!!detail} title={`Case ${detail?.case_code ?? ""}`} onClose={() => setDetail(null)}>
        {detail ? (
          <Card title={detail.site_name ?? "No site recorded"} subtitle={`Opened ${fmtDate(detail.created_at)}`}>
            <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", fontSize: "var(--fs-md)" }}>
              <dt className="m3-hint">Status</dt><dd style={{ margin: 0 }}><StatusBadge status={detail.status} /></dd>
              <dt className="m3-hint">Priority</dt><dd style={{ margin: 0 }}>{detail.urgent ? "Urgent" : "Normal"}</dd>
              <dt className="m3-hint">Source</dt><dd style={{ margin: 0 }}>{detail.source ?? "—"}</dd>
              <dt className="m3-hint">Acknowledged</dt><dd style={{ margin: 0 }}>{fmtDate(detail.acknowledged_at)}</dd>
              <dt className="m3-hint">Closed</dt><dd style={{ margin: 0 }}>{fmtDate(detail.closed_at)}</dd>
            </dl>
            {canAcknowledge && detail.status === "submitted" && !detail.acknowledged_at ? (
              <div style={{ marginTop: "var(--sp-4)" }}>
                <Button loading={busyId === detail.id} onClick={() => void acknowledge(detail)}>Acknowledge case</Button>
              </div>
            ) : null}
          </Card>
        ) : null}
      </Modal>
    </Page>
  );
}
