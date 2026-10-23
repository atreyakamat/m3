/** Research Results — de-identified molecular surveillance from
 *  GET /research-results ({items}). Records are keyed to opaque sample
 *  codes and carry no direct identifiers; the research workspace is
 *  strictly read-only (no create/edit/delete from this console). */
import { Badge, Banner, DataTable, EmptyState, ErrorState, Page, PageHeader, StatusBadge, Button } from "../ui/components";
import type { ResearchResultItem } from "../types";

export function ResearchScreen({ items, loading, error, requestId, onRefresh }:
  {
    items: ResearchResultItem[] | null; loading: boolean; error: string; requestId: string | null;
    onRefresh: () => void;
  }) {
  return (
    <Page>
      <PageHeader title="Research Results"
        subtitle="Approved molecular dataset — read-only for research workspaces."
        actions={<Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>} />

      <div style={{ marginBottom: "var(--sp-4)" }}>
        <Banner tone="info">De-identified molecular surveillance — records carry no direct identifiers.</Banner>
      </div>

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !items}
        caption="De-identified molecular surveillance results"
        rows={items ?? []}
        rowKey={(r) => r.id}
        emptyState={<EmptyState title="No research results yet"
          message="No approved molecular results are in your scope yet. Records appear here once laboratory surveillance has been confirmed." />}
        columns={[
          { key: "sample_id", label: "Sample code", render: (r) => <span className="m3-cell-main">{r.sample_id ?? r.id}</span> },
          {
            key: "pcr_status", label: "PCR status",
            // Old branch carried explicit tones (detected→danger, not_detected→ok,
            // else warn) that StatusBadge's derived tones cannot express.
            render: (r) => r.pcr_status ? (
              <Badge tone={r.pcr_status === "detected" ? "danger" : r.pcr_status === "not_detected" ? "ok" : "warn"}>
                {r.pcr_status.toUpperCase()}
              </Badge>
            ) : <StatusBadge status="unknown" label="Pending" />,
          },
          {
            key: "species_confirmation", label: "Species confirmed",
            render: (r) => (r.species_confirmation ? r.species_confirmation.toUpperCase() : "—"),
          },
          {
            key: "parasite_density", label: "Parasite density", align: "right",
            render: (r) => (r.parasite_density != null
              ? <span>{r.parasite_density} {r.parasite_density_unit || "parasites/µL"}</span>
              : "—"),
          },
          { key: "gametocyte_presence", label: "Gametocytes", render: (r) => r.gametocyte_presence || "not_tested" },
          {
            key: "pfhrp", label: "pfhrp2 / pfhrp3",
            render: (r) => `${r.pfhrp2_status ?? "—"} / ${r.pfhrp3_status ?? "—"}`,
          },
        ]}
      />
      <p className="m3-hint" style={{ marginTop: "var(--sp-3)" }}>
        Approved molecular dataset (read-only). Records are de-identified and keyed to opaque sample codes;
        Research Lab accounts cannot create, edit or delete results.
      </p>
    </Page>
  );
}
