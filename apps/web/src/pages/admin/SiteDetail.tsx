import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { ActiveChip, AdminChip, ConfirmDialog, DataTable, ListBody, SectionCard, type Column } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { Button, Card, Banner } from '../../components/ui';
import { ROLE_LABELS } from '@m3/shared';

interface SiteDetail {
  siteId: string;
  name: string;
  active: boolean;
  address: string | null;
  landmark: string | null;
  contactPhone: string | null;
  area: string;
  taluka: string | null;
  district: string | null;
  state: string | null;
  contractor: { contractorId: string; name: string } | null;
  linkedWorkers: Array<{ workerId: string; name: string; phone: string; since: string }>;
  pendingJoinRequests: Array<{ joinRequestId: string; workerId: string; workerName: string; createdAt: string }>;
  totals: { assignments: number; transfersFrom: number; transfersTo: number };
}

interface SiteContractorRow {
  contractorId: string;
  name: string;
  phone: string;
  active: boolean;
  assignedAt: string;
  activeWorkerCount: number;
}

interface SiteAssignmentHistoryRow {
  id: string;
  workerId: string;
  workerName: string;
  contractorId: string | null;
  contractorName: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
}

interface ContractorOption {
  id: string;
  name: string;
  stakeholderCode?: string;
}

export function SiteDetailPage() {
  const { siteCode = '' } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync<SiteDetail>(() => api.get(`/admin/sites/${siteCode}`), [siteCode]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Multi-contractor management states via useAsync
  const {
    data: contractorsData,
    loading: contractorsLoading,
    reload: reloadContractors,
  } = useAsync<{ items: SiteContractorRow[] }>(
    () => api.get(`/admin/sites/${siteCode}/contractors`),
    [siteCode],
  );
  const contractors = contractorsData?.items || [];

  const {
    data: historyData,
    loading: historyLoading,
    reload: reloadHistory,
  } = useAsync<{ items: SiteAssignmentHistoryRow[] }>(
    () => api.get(`/admin/sites/${siteCode}/assignment-history`),
    [siteCode],
  );
  const assignmentHistory = historyData?.items || [];

  // Add Contractor modal
  const [addContractorOpen, setAddContractorOpen] = useState(false);
  const [allContractors, setAllContractors] = useState<ContractorOption[]>([]);
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  // Remove Contractor modal
  const [removeTarget, setRemoveTarget] = useState<SiteContractorRow | null>(null);
  const [reassignContractorId, setReassignContractorId] = useState('');
  const [removeBusy, setRemoveBusy] = useState(false);

  const openAddContractorModal = async () => {
    setAddContractorOpen(true);
    setActionError(null);
    try {
      const res = await api.get<{ items: Array<{ id: string; name: string; stakeholderCode?: string }> }>('/admin/users?role=CONTRACTOR');
      setAllContractors(res.items || []);
      if (res.items && res.items.length > 0) {
        setSelectedContractorId(res.items[0].id);
      }
    } catch {
      /* non-fatal */
    }
  };

  const handleAddContractor = async () => {
    if (!selectedContractorId) return;
    setAddBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/sites/${siteCode}/contractors`, { contractorId: selectedContractorId });
      setAddContractorOpen(false);
      reloadContractors();
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not add contractor to site');
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemoveContractor = async () => {
    if (!removeTarget) return;
    setRemoveBusy(true);
    setActionError(null);
    try {
      const qs = reassignContractorId ? `?reassignTo=${encodeURIComponent(reassignContractorId)}` : '';
      await api.delete(`/admin/sites/${siteCode}/contractors/${removeTarget.contractorId}${qs}`);
      setRemoveTarget(null);
      setReassignContractorId('');
      reloadContractors();
      reloadHistory();
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not remove contractor from site');
    } finally {
      setRemoveBusy(false);
    }
  };

  const workerColumns: Column<{ workerId: string; name: string; since: string }>[] = [
    { header: 'Worker ID', width: '140px', render: (w) => <code style={{ fontSize: 13 }}>{w.workerId}</code> },
    {
      header: 'Name',
      render: (w) => <Link to={`/admin/workers/${w.workerId}`} style={{ color: '#0E7C86' }}>{w.name}</Link>,
    },
    { header: 'Linked since', render: (w) => isoDate(w.since) },
  ];

  const contractorColumns: Column<SiteContractorRow>[] = [
    {
      header: 'Contractor Name',
      render: (c) => (
        <div>
          <Link to={`/admin/users/${c.contractorId}`} style={{ color: '#3D5A80', fontWeight: 600 }}>
            {c.name}
          </Link>
          <div className="muted small">{c.phone}</div>
        </div>
      ),
    },
    {
      header: 'Active Workers',
      width: '130px',
      render: (c) => <b>{c.activeWorkerCount} workers</b>,
    },
    {
      header: 'Assigned Date',
      width: '140px',
      render: (c) => isoDate(c.assignedAt),
    },
    {
      header: 'Actions',
      width: '110px',
      render: (c) => (
        <Button
          variant="danger"
          style={{ fontSize: 12, padding: '4px 8px' }}
          onClick={() => {
            setRemoveTarget(c);
            const other = contractors.find((x) => x.contractorId !== c.contractorId);
            setReassignContractorId(other ? other.contractorId : '');
          }}
        >
          Remove
        </Button>
      ),
    },
  ];

  const historyColumns: Column<SiteAssignmentHistoryRow>[] = [
    {
      header: 'Worker',
      render: (h) => (
        <div>
          <Link to={`/admin/workers/${h.workerId}`} style={{ color: '#0E7C86', fontWeight: 600 }}>
            {h.workerName}
          </Link>
          <div className="muted small"><code>{h.workerId}</code></div>
        </div>
      ),
    },
    {
      header: 'Assigned Contractor',
      render: (h) => h.contractorName ? <span>{h.contractorName}</span> : <span className="muted">—</span>,
    },
    {
      header: 'Status',
      width: '120px',
      render: (h) => {
        if (h.status === 'ACTIVE') return <AdminChip kind="green">ACTIVE</AdminChip>;
        if (h.status === 'TRANSFERRED') return <AdminChip kind="blue">TRANSFERRED</AdminChip>;
        return <AdminChip kind="grey">ENDED</AdminChip>;
      },
    },
    {
      header: 'Started At',
      width: '130px',
      render: (h) => isoDate(h.startedAt),
    },
    {
      header: 'Ended At',
      width: '130px',
      render: (h) => h.endedAt ? isoDate(h.endedAt) : <span className="muted">Current</span>,
    },
  ];

  async function deactivate() {
    setActionBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/sites/${siteCode}/deactivate`, { confirm: true });
      setConfirmOpen(false);
      reload();
    } catch (e) {
      setConfirmOpen(false);
      setActionError(e instanceof Error ? e.message : 'Could not deactivate the site');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <Card>
        <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
          {data && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, flex: 1 }}>{data.name}</h2>
                <ActiveChip active={data.active} />
                <Button variant="secondary" onClick={() => nav(`/admin/sites/${siteCode}/edit`)}>Edit</Button>
                {data.active && (
                  <Button variant="danger" onClick={() => setConfirmOpen(true)}>Deactivate</Button>
                )}
              </div>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                <code style={{ fontSize: 13 }}>{data.siteId}</code> · {data.state ?? 'Goa'} → {data.district ?? '—'} → {data.taluka ?? '—'} → {data.area}
                {data.address ? ` · ${data.address}` : ''}
                {data.landmark ? ` (Landmark: ${data.landmark})` : ''}
                {data.contactPhone ? ` · Contact: ${data.contactPhone}` : ''}
              </p>
              {actionError && <div style={{ marginTop: 12 }}><Banner kind="danger">{actionError}</Banner></div>}
              <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
                <div>
                  <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Assigned Contractors</div>
                  <b>{contractors.length} active contractor(s)</b>
                </div>
                <div>
                  <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Linked workers</div>
                  <b>{data.linkedWorkers.length}</b>
                </div>
                <div>
                  <div className="muted small" style={{ fontWeight: 700, textTransform: 'uppercase' }}>Historical records</div>
                  <span>{data.totals.assignments} assignments · {data.totals.transfersFrom + data.totals.transfersTo} transfers</span>
                </div>
              </div>
            </>
          )}
        </ListBody>
      </Card>

      {/* Assigned Contractors Section (Multi-Contractor Support) */}
      <SectionCard
        title="Assigned Contractors"
        actions={
          <Button variant="primary" style={{ fontSize: 13 }} onClick={openAddContractorModal}>
            + Add Contractor to Site
          </Button>
        }
      >
        <ListBody
          loading={contractorsLoading}
          error={null}
          empty={contractors.length === 0}
          emptyHint="No contractors currently assigned to this construction site. Click '+ Add Contractor to Site' above to assign one."
        >
          <DataTable columns={contractorColumns} rows={contractors} rowKey={(c) => c.contractorId} />
        </ListBody>
      </SectionCard>

      {/* Pending Join Requests */}
      {data && data.pendingJoinRequests.length > 0 && (
        <SectionCard title="Pending join requests">
          <DataTable
            columns={
              [
                { header: 'Worker ID', render: (r) => <code style={{ fontSize: 13 }}>{r.workerId}</code> },
                { header: 'Name', render: (r) => r.workerName },
                { header: 'Requested', render: (r) => isoDate(r.createdAt) },
                { header: 'Status', render: () => <AdminChip kind="amber">Pending</AdminChip> },
              ] as Column<SiteDetail['pendingJoinRequests'][number]>[]
            }
            rows={data.pendingJoinRequests}
            rowKey={(r) => r.joinRequestId}
          />
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Decision belongs to the site {ROLE_LABELS.CONTRACTOR.toLowerCase()}; Admin observes only.
          </p>
        </SectionCard>
      )}

      {/* Linked Workers */}
      <SectionCard title="Linked workers">
        <ListBody
          loading={false}
          error={null}
          empty={Boolean(data && data.linkedWorkers.length === 0)}
          emptyHint="No workers are currently assigned to this site."
        >
          {data && <DataTable columns={workerColumns} rows={data.linkedWorkers} rowKey={(w) => w.workerId} />}
        </ListBody>
      </SectionCard>

      {/* Workforce Assignment History */}
      <SectionCard title="Workforce Assignment History">
        <ListBody
          loading={historyLoading}
          error={null}
          empty={assignmentHistory.length === 0}
          emptyHint="No assignment history recorded yet for this site."
        >
          <DataTable columns={historyColumns} rows={assignmentHistory} rowKey={(h) => h.id} />
        </ListBody>
      </SectionCard>

      {/* Add Contractor Modal */}
      {addContractorOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px' }}>Add Contractor to Construction Site</h3>
            <p className="muted small" style={{ margin: '0 0 16px' }}>
              Select an active contractor to assign to <b>{data?.name}</b>. Multiple contractors can co-manage this site.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Contractor *
              </label>
              <select
                value={selectedContractorId}
                onChange={(e) => setSelectedContractorId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  fontSize: 14,
                }}
              >
                {allContractors
                  .filter((c) => !contractors.some((assigned) => assigned.contractorId === c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.stakeholderCode ? `(${c.stakeholderCode})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setAddContractorOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddContractor} disabled={addBusy || !selectedContractorId}>
                {addBusy ? 'Assigning…' : 'Assign Contractor'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Contractor Modal with Reassignment Guard */}
      {removeTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              padding: 24,
              maxWidth: 480,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 8px', color: '#DC2626' }}>Remove Contractor from Site</h3>
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
              Are you sure you want to remove <b>{removeTarget.name}</b> from <b>{data?.name}</b>?
            </p>

            {removeTarget.activeWorkerCount > 0 ? (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #F87171',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontWeight: 700, color: '#991B1B', fontSize: 13, marginBottom: 4 }}>
                  ⚠️ Active Workers Guard Protection
                </div>
                <div style={{ fontSize: 13, color: '#991B1B', lineHeight: '18px', marginBottom: 12 }}>
                  This contractor currently has <b>{removeTarget.activeWorkerCount} active worker(s)</b>. To prevent orphaned workers, you must select another contractor assigned to this site to take over their workforce:
                </div>

                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4, color: '#374151' }}>
                  Reassign Active Workers To:
                </label>
                <select
                  value={reassignContractorId}
                  onChange={(e) => setReassignContractorId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                  }}
                >
                  <option value="">-- Select Replacement Contractor --</option>
                  {contractors
                    .filter((c) => c.contractorId !== removeTarget.contractorId)
                    .map((c) => (
                      <option key={c.contractorId} value={c.contractorId}>
                        {c.name} ({c.activeWorkerCount} current workers)
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <p className="muted small" style={{ marginBottom: 16 }}>
                This contractor has 0 active workers. Safe removal will proceed without reassignment.
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => {
                  setRemoveTarget(null);
                  setReassignContractorId('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRemoveContractor}
                disabled={removeBusy || (removeTarget.activeWorkerCount > 0 && !reassignContractorId)}
              >
                {removeBusy ? 'Removing…' : 'Confirm Removal'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate construction site?"
        tone="danger"
        confirmLabel="Deactivate"
        busy={actionBusy}
        onConfirm={deactivate}
        onCancel={() => setConfirmOpen(false)}
        body={
          <>
            <p style={{ marginTop: 0 }}>
              {data?.linkedWorkers.length
                ? `${data.linkedWorkers.length} worker(s) are currently linked,${contractors.length > 0 ? ` ${contractors.length} contractor(s) assigned,` : ''} and historical records exist.`
                : contractors.length > 0
                  ? `${contractors.length} contractor(s) are currently assigned to this site.`
                  : 'No active relationships found.'}
            </p>
            <p style={{ marginBottom: 0 }}>
              Sites are never permanently deleted — deactivation keeps all historical relationships and records safe.
            </p>
          </>
        }
      />
    </div>
  );
}
