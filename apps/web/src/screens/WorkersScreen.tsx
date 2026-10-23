/** Worker roster — searchable list of registered workers (patients).
 *  Ported from the legacy `workers` records table: same fields, same
 *  consent framing; rows open the worker detail (parent navigates). */
import { Badge, DataTable, EmptyState, ErrorState, Identity, Page, PageHeader, SearchInput } from "../ui/components";
import type { PagePayload } from "../types";

/** Shapes exactly what the legacy table read from GET /workers items. */
export type WorkerListItem = {
  id: string
  display_name?: string
  patient_code: string
  phone_e164?: string
  age_years?: number
  gender?: string
  occupation?: string
  consent_status?: string
  initial_symptoms?: string[]
}

export function WorkersScreen({ page, loading, error, requestId, onRefresh, query, onQuery, onOpen }:
  {
    page: PagePayload<WorkerListItem> | null; loading: boolean; error: string; requestId: string | null;
    onRefresh: () => void; query: string; onQuery: (q: string) => void; onOpen: (workerId: string) => void;
  }) {
  const rows = page?.items ?? [];

  const nameFor = (w: WorkerListItem) => w.display_name || "De-identified";

  return (
    <Page>
      <PageHeader title="Workers"
        subtitle="Registered migrant labour workers. Open a row for the full clinical, consent and travel record."
        actions={
          <Badge tone="neutral" dot={false}>{rows.length} of {page?.total ?? 0} worker(s)</Badge>
        } />

      <div style={{ maxWidth: 340, marginBottom: "var(--sp-4)" }}>
        <SearchInput
          label="Search workers"
          value={query}
          onChange={onQuery}
          placeholder="Name, code or phone…"
          aria-label="Search workers by name, code or phone" />
      </div>

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !page}
        caption="Worker roster (role-scoped)"
        rows={rows}
        rowKey={(w) => w.id}
        onRowClick={(w) => onOpen(w.id)}
        emptyState={<EmptyState title="No workers match"
          message="No records matched your search query or role permissions." />}
        columns={[
          {
            key: "identity", label: "Worker",
            render: (w) => (
              <Identity name={nameFor(w)} sub={w.phone_e164
                ? <span className="m3-hint">{w.phone_e164}</span>
                : undefined} />
            ),
          },
          {
            key: "code", label: "Patient code",
            render: (w) => <span className="m3-cell-main">{w.patient_code}</span>,
          },
          {
            key: "demo", label: "Age / Gender",
            render: (w) => [w.age_years ? `${w.age_years}y` : null, w.gender].filter(Boolean).join(" · ") || "—",
          },
          {
            key: "occupation", label: "Occupation",
            render: (w) => w.occupation || "Field Construction Worker",
          },
          {
            key: "consent", label: "Consent",
            render: (w) => (
              <Badge tone={w.consent_status === "documented" ? "ok" : "neutral"}>
                {w.consent_status === "documented" ? "Documented" : "Pending"}
              </Badge>
            ),
          },
          {
            key: "symptoms", label: "Symptoms",
            render: (w) => (w.initial_symptoms?.length ? w.initial_symptoms.join(", ") : "None documented"),
          },
        ]}
      />
      {page ? <p className="m3-hint" style={{ marginTop: 8 }}>
        Showing {page.items.length} of {page.total} worker(s). Search re-queries the server — no local filtering.
      </p> : null}
    </Page>
  );
}
