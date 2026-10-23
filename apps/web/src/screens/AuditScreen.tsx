/** Audit Trail — admin-only tamper-evident log (PRD DATA-002) from
 *  GET /audit?offset&limit&action&entity_type. Filtering and paging are
 *  owned by the parent: the screen reports intent via onFilters/onPaging
 *  and never refetches locally (no echo of stale response data). */
import { useEffect, useRef, useState } from "react";
import { Badge, Button, DataTable, EmptyState, ErrorState, Field, Input, Page, PageHeader } from "../ui/components";
import type { AuditEventItem, PagePayload } from "../types";

export type AuditFilters = { action: string; entityType: string };

function fmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return s; }
}

function detailText(detail: AuditEventItem["detail"]): string {
  return typeof detail === "object" && detail !== null ? JSON.stringify(detail) : String(detail ?? "");
}

export function AuditScreen({ page, loading, error, requestId, onRefresh, filters, onFilters, onPaging }:
  {
    page: PagePayload<AuditEventItem> | null; loading: boolean; error: string; requestId: string | null;
    onRefresh: () => void;
    filters: AuditFilters; onFilters: (next: AuditFilters) => void;
    onPaging: (offset: number) => void;
  }) {
  // Local draft so typing stays responsive; committed to the parent
  // debounced (400ms) or flushed on blur — whichever comes first.
  const [draft, setDraft] = useState(filters);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(filters);
  }, [filters.action, filters.entityType]);

  useEffect(() => () => { if (timerRef.current != null) window.clearTimeout(timerRef.current); }, []);

  function commit(next: AuditFilters) {
    if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (next.action !== filters.action || next.entityType !== filters.entityType) onFilters(next);
  }

  function onEdit(patch: Partial<AuditFilters>) {
    const next = { action: draft.action, entityType: draft.entityType, ...patch };
    setDraft(next);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { timerRef.current = null; commit(next); }, 400);
  }

  const limit = page?.limit ?? 50;
  const total = page?.total ?? 0;
  const offset = page?.offset ?? 0;
  const from = total > 0 ? offset + 1 : 0;
  const to = Math.min(offset + limit, total);
  const hasFilters = !!(filters.action || filters.entityType);

  return (
    <Page>
      <PageHeader title="Audit Trail"
        subtitle="Tamper-evident log of every provision, submission, diagnosis and session event."
        actions={<Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>} />

      <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--sp-4)" }}>
        <div style={{ minWidth: 220 }}><Field label="Action filter" htmlFor="audit-action-filter">
          <Input id="audit-action-filter" value={draft.action} placeholder="e.g. case.acknowledge"
            onChange={(e) => onEdit({ action: e.target.value })} onBlur={() => commit(draft)} />
        </Field></div>
        <div style={{ minWidth: 220 }}><Field label="Entity type filter" htmlFor="audit-entity-filter">
          <Input id="audit-entity-filter" value={draft.entityType} placeholder="e.g. worker, sample"
            onChange={(e) => onEdit({ entityType: e.target.value })} onBlur={() => commit(draft)} />
        </Field></div>
        {hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => commit({ action: "", entityType: "" })}>Reset filters</Button>
        ) : null}
      </div>

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !page}
        caption="Tamper-evident audit log for surveillance compliance"
        rows={page?.items ?? []}
        rowKey={(ev) => ev.id}
        emptyState={<EmptyState title={hasFilters ? "No matching audit events" : "No audit events yet"}
          message={hasFilters
            ? "Nothing matches these action/entity filters — try resetting them."
            : "Every account provision, screening submission, lab diagnosis and session lifecycle event is permanently recorded."} />}
        columns={[
          { key: "occurred_at", label: "Timestamp", render: (ev) => <span style={{ whiteSpace: "nowrap" }}>{fmtDate(ev.occurred_at)}</span> },
          { key: "action", label: "Action", render: (ev) => <Badge tone="neutral" dot={false}>{ev.action}</Badge> },
          {
            key: "entity", label: "Entity",
            render: (ev) => <span className="m3-cell-main">{ev.entity_type ?? "—"}</span>,
            sub: (ev) => (ev.entity_id ? ev.entity_id.slice(0, 16) : undefined),
          },
          { key: "actor_user_id", label: "Actor", render: (ev) => ev.actor_user_id || "System" },
          {
            key: "detail", label: "Detail",
            render: (ev) => {
              const text = detailText(ev.detail);
              if (!text) return <span className="m3-hint">—</span>;
              return (
                <span className="m3-cell-sub" title={text} style={{ display: "inline-block", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
                  {text.length > 120 ? `${text.slice(0, 120)}…` : text}
                </span>
              );
            },
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: "var(--sp-3)" }}>
        <span className="m3-hint">Showing {from} – {to} of {total} audit event(s)</span>
        <span style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" disabled={offset === 0 || loading || !page}
            onClick={() => onPaging(Math.max(0, offset - limit))}>← Previous</Button>
          <Button variant="secondary" size="sm" disabled={offset + limit >= total || loading || !page}
            onClick={() => onPaging(offset + limit)}>Next →</Button>
        </span>
      </div>
      <p className="m3-hint" style={{ marginTop: "var(--sp-3)" }}>
        Tamper-evident audit log for surveillance compliance (PRD DATA-002). Every recorded event is permanent,
        with actor identity and timestamp.
      </p>
    </Page>
  );
}
