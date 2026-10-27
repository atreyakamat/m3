/** Diagnostics & Pathology — pathologist lab workspace. Ported from the
 *  legacy `samples` records table: sample code, patient, specimen, test
 *  results (method / result / species), slide follow-up state. Row actions
 *  are gated at the parent (canRecord / canSlideFollowup). */
import { Badge, Button, DataTable, EmptyState, ErrorState, Page, PageHeader, SearchInput, StatusBadge } from "../ui/components";
import type { DiagnosticSampleItem, PagePayload } from "../types";

/** Tone parity with the legacy sample result badge: positive = danger,
 *  negative = success, anything else = warn. */
function resultTone(sample: DiagnosticSampleItem, resultStatus?: string): "ok" | "warn" | "danger" {
  const isPositive = sample.status === "positive" || resultStatus === "positive";
  if (isPositive) return "danger";
  return (resultStatus || sample.status) === "negative" ? "ok" : "warn";
}

const SAMPLE_EMPTY: React.ReactNode = <EmptyState title="Lab queue is clear"
  message="No diagnostic samples awaiting results or slide follow-up right now. New samples appear as clinicians request testing." />;

export function SamplesScreen({ page, loading, error, requestId, onRefresh, query, onQuery, canRecord, onRecord, onSlideFollowup, canSlideFollowup, onOpenPatient }:
  {
    page: PagePayload<DiagnosticSampleItem> | null; loading: boolean; error: string; requestId: string | null;
    onRefresh: () => void;
    /** Server-backed name search (de-identifiable linked worker's name). The
     *  query state lives in the parent so a refresh preserves it. */
    query: string; onQuery: (q: string) => void;
    canRecord?: boolean; onRecord?: () => void;
    onSlideFollowup: (s: DiagnosticSampleItem) => void; canSlideFollowup: boolean;
    /** Row click: open the patient's worker record (sample recording happens in worker context). */
    onOpenPatient?: (patientId: string) => void;
  }) {
  const rows = page?.items ?? [];
  const searching = query.trim().length > 0;

  /** Empty state differs: a search with no result is not the same as a clear queue. */
  const emptyState = searching ? (
    <EmptyState title="No samples match"
      message={`No diagnostic sample belongs to a worker whose name matches “${query.trim()}” for your scope.`} />
  ) : SAMPLE_EMPTY;

  return (
    <Page>
      <PageHeader title="Diagnostics & Pathology"
        subtitle="Laboratory samples and results. Positive samples require a slide follow-up to be scheduled and reconciled."
        actions={<>
          {canRecord && onRecord ? (
            <Button variant="primary" size="sm" onClick={onRecord} aria-label="Record diagnostic sample">
              Record diagnostic sample
            </Button>
          ) : null}
          {!error ? <Badge tone="neutral" dot={false}>{rows.length} of {page?.total ?? 0} sample(s)</Badge> : null}
        </>} />

      <div style={{ maxWidth: 340, marginBottom: "var(--sp-4)" }}>
        <SearchInput
          label="Search diagnostics"
          value={query}
          onChange={onQuery}
          placeholder="Search diagnostics by name..."
          aria-label="Search diagnostics by the linked worker's name" />
      </div>

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !page}
        caption="Diagnostic samples (pathologist scope)"
        rows={rows}
        rowKey={(s) => s.id}
        emptyState={emptyState}
        columns={[
          {
            key: "sample_code", label: "Sample",
            render: (s) => <span className="m3-cell-main">{s.sample_code}</span>,
          },
          {
            key: "patient", label: "Patient",
            render: (s) => (s.patient_display_name
              ? <span style={{ overflowWrap: "anywhere" }}>{s.patient_display_name}</span>
              : <span className="m3-hint">{s.patient_id.slice(0, 8)}…</span>),
          },
          {
            key: "specimen", label: "Specimen / Smear",
            render: (s) => s.specimen_type || "—",
            sub: (s) => s.tests?.[0]?.smear_type || undefined,
          },
          {
            key: "status", label: "Status",
            render: (s) => <StatusBadge status={s.status} />,
          },
          {
            key: "tests", label: "Tests",
            render: (s) => (s.tests?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {s.tests.map((t) => (
                  <span key={t.id} style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                    <Badge tone="neutral">{(t.method || "microscopy").toUpperCase()}</Badge>
                    <Badge tone={resultTone(s, t.result_status)}>{(t.result_status || "PENDING").toUpperCase()}</Badge>
                    {t.species ? <Badge tone="violet">{t.species.toUpperCase()}</Badge> : null}
                  </span>
                ))}
              </div>
            ) : <span className="m3-hint">No tests recorded</span>),
          },
          {
            key: "slide_fu", label: "Slide follow-up",
            render: (s) => (s.slide_follow_up ? (
              <div>
                <StatusBadge status={s.slide_follow_up.received === "yes" ? "ok" : "pending"}
                  label={`Received: ${s.slide_follow_up.received || "—"}`} />
                <div className="m3-hint" style={{ marginTop: 2 }}>Day {s.slide_follow_up.scheduled_day}</div>
                {(s.slide_follow_up.not_received_reason || s.slide_follow_up.other_reason) ? (
                  <div className="m3-hint">{s.slide_follow_up.not_received_reason || s.slide_follow_up.other_reason}</div>
                ) : null}
              </div>
            ) : <span className="m3-hint">Not scheduled</span>),
          },
          {
            key: "action", label: "", align: "right",
            render: (s) => {
              const isPositive = s.status === "positive" || s.tests?.[0]?.result_status === "positive";
              return canSlideFollowup && isPositive ? (
                <Button variant="subtle" size="sm"
                  onClick={(e) => { e.stopPropagation(); onSlideFollowup(s); }}
                  aria-label={`Record slide follow-up for sample ${s.sample_code}`}>
                  + Follow-up
                </Button>
              ) : <span className="m3-hint">N/A</span>;
            },
          },
        ]}
      />
      {page ? <p className="m3-hint" style={{ marginTop: 8 }}>
        Showing {page.items.length} of {page.total} sample(s){searching ? ` matching “${query.trim()}”` : ""}.
        Search re-queries the server with the linked worker's name — no local filtering, research-scope records stay PII-stripped.
        Slide follow-up is required for every positive result.
      </p> : null}
    </Page>
  );
}
