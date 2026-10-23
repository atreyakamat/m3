/** Construction Sites — role-scoped directory from GET /sites ({items}).
 *  Contractor workspace: enrollment and health-status updates are
 *  contractor actions; every other role sees a read-only directory. */
import { Button, DataTable, EmptyState, ErrorState, Banner, Page, PageHeader, Skeleton, StatusBadge } from "../ui/components";
import type { SiteItem } from "../types";

export function SitesScreen({ items, loading, error, requestId, onRefresh, canEnroll, onEnroll, canUpdateStatus, onUpdateStatus, isContractor }:
  {
    items: SiteItem[] | null; loading: boolean; error: string; requestId: string | null;
    onRefresh: () => void;
    /** Enrollment/status recording is worker-context (worker drawer), as in the legacy app:
     *  these are optional viewer affordances; when absent the screen stays read-only. */
    canEnroll?: boolean; onEnroll?: (siteId: string) => void;
    canUpdateStatus?: boolean; onUpdateStatus?: (siteId: string) => void; isContractor: boolean;
  }) {
  return (
    <Page>
      <PageHeader title="Construction Sites"
        subtitle="Migrant labour settlements enrolled in the malaria elimination programme."
        actions={<Button variant="secondary" size="sm" onClick={onRefresh}>Refresh</Button>} />

      {!isContractor ? (
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <Banner tone="info">Read-only site directory. Enrollment and status updates are contractor actions.</Banner>
        </div>
      ) : null}

      {error ? <ErrorState message={error} onRetry={onRefresh} requestId={requestId} /> : null}
      <DataTable
        loading={loading && !items}
        caption="Construction sites directory"
        rows={items ?? []}
        rowKey={(s) => s.id}
        emptyState={<EmptyState title="No sites yet"
          message="No construction sites have been registered for your scope. Contractors enroll sites from the field onboarding flow." />}
        columns={[
          { key: "code", label: "Site code", render: (s) => <span className="m3-cell-main">{s.code}</span> },
          { key: "name", label: "Site name" },
          { key: "contractor_name", label: "Contractor", render: (s) => s.contractor_name ?? "Assigned Contractor" },
          { key: "area", label: "District / area", render: (s) => s.area ?? s.district ?? "Goa" },
          { key: "status", label: "Status", render: (s) => <StatusBadge status={s.status} /> },
          {
            key: "actions", label: "", align: "right",
            render: (s) => (
              <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {canEnroll && onEnroll ? (
                  <Button size="sm" variant="subtle"
                    onClick={(e) => { e.stopPropagation(); onEnroll(s.id); }}
                    aria-label={`Enroll worker at site ${s.code} — ${s.name}`}>
                    Enroll worker
                  </Button>
                ) : null}
                {canUpdateStatus && onUpdateStatus ? (
                  <Button size="sm" variant="subtle"
                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(s.id); }}
                    aria-label={`Update health status for site ${s.code} — ${s.name}`}>
                    Update health status
                  </Button>
                ) : null}
                {!canEnroll && !canUpdateStatus ? <span className="m3-hint">—</span> : null}
              </span>
            ),
          },
        ]}
      />
      {loading && items ? <div style={{ marginTop: "var(--sp-3)" }}><Skeleton lines={2} /></div> : null}
    </Page>
  );
}
