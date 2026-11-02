import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { ActiveChip, AdminChip, ConfirmDialog, DataTable, ListBody, SectionCard, type Column } from '../../components/admin';
import { Button, Card, Banner } from '../../components/ui';

interface DemoDataPayload {
  contractor: {
    id: string;
    stakeholderCode: string;
    name: string;
    phone: string;
    mustChangeCredential: boolean;
    temporaryPinNotice: string;
  } | null;
  site: {
    siteCode: string;
    name: string;
    state: string;
    district: string;
    taluka: string;
    area: string;
    address: string | null;
    landmark: string | null;
    contactPhone: string | null;
    active: boolean;
    assignedContractorName: string | null;
  } | null;
  workers: Array<{
    workerCode: string;
    name: string;
    phone: string;
    pinNotice: string;
    screeningStatus: string;
    malariaStatus: string;
    diagnostic: {
      testType: string;
      result: string;
      species: string | null;
      testDate: string;
    } | null;
    hasUpcomingTravel: boolean;
  }>;
}

export function DemoDataPage() {
  const { data, loading, error, reload } = useAsync<DemoDataPayload>(() => api.get('/admin/demo-data'), []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleReset() {
    setResetting(true);
    setResetMessage(null);
    try {
      await api.post('/admin/demo-data/reset', {});
      setConfirmOpen(false);
      setResetMessage('Demonstration dataset reset successfully. 10 synthetic workers, demo site, and contractor ready.');
      reload();
    } catch (e) {
      setResetMessage(e instanceof Error ? e.message : 'Failed to reset demonstration records');
    } finally {
      setResetting(false);
    }
  }

  const workerColumns: Column<DemoDataPayload['workers'][number]>[] = [
    {
      header: 'Worker ID',
      width: '120px',
      render: (w) => <code style={{ fontSize: 13, fontWeight: 700 }}>{w.workerCode}</code>,
    },
    {
      header: 'Name',
      render: (w) => (
        <div>
          <b>{w.name}</b>
          {w.hasUpcomingTravel && (
            <div style={{ marginTop: 2 }}>
              <AdminChip kind="amber">✈ Travel Alert (3 days)</AdminChip>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Phone / PIN',
      render: (w) => (
        <span>
          <code>{w.phone}</code> / PIN: <b>{w.pinNotice}</b>
        </span>
      ),
    },
    {
      header: 'Screening',
      render: (w) => <AdminChip kind="green">{w.screeningStatus}</AdminChip>,
    },
    {
      header: 'Malaria Status',
      render: (w) => (
        w.malariaStatus === 'POSITIVE' ? (
          <AdminChip kind="red">● POSITIVE</AdminChip>
        ) : (
          <AdminChip kind="green">● NEGATIVE</AdminChip>
        )
      ),
    },
    {
      header: 'Authorized Diagnostic',
      render: (w) => (
        w.diagnostic ? (
          <span style={{ fontSize: 12 }}>
            <b>{w.diagnostic.testType}</b> ({w.diagnostic.result})
            {w.diagnostic.species ? ` · ${w.diagnostic.species}` : ''}
          </span>
        ) : <span className="muted">—</span>
      ),
    },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Demonstration & Testing Dataset</h2>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Pre-configured synthetic dataset for full physical device workflow testing and system validation.
          </p>
        </div>
        <Button onClick={() => setConfirmOpen(true)} variant="danger">
          Reset Demonstration Dataset
        </Button>
      </div>

      {resetMessage && (
        <Banner kind="info">{resetMessage}</Banner>
      )}

      <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {/* Demo Contractor Card */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Demonstration Contractor</h3>
                  <AdminChip kind="blue">Role: Contractor</AdminChip>
                </div>
                {data.contractor ? (
                  <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                    <div>
                      <span className="muted">Contractor Code: </span>
                      <strong style={{ fontSize: 16, color: '#0E7C86' }}>{data.contractor.stakeholderCode}</strong>
                    </div>
                    <div>
                      <span className="muted">Name: </span>
                      <b>{data.contractor.name}</b>
                    </div>
                    <div>
                      <span className="muted">Mobile Phone: </span>
                      <code>{data.contractor.phone}</code>
                    </div>
                    <div>
                      <span className="muted">Temporary PIN: </span>
                      <code style={{ background: '#fef08a', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {data.contractor.temporaryPinNotice}
                      </code>
                    </div>
                    <div>
                      <span className="muted">First-Login State: </span>
                      <span style={{ color: data.contractor.mustChangeCredential ? '#D97706' : '#16A34A', fontWeight: 600 }}>
                        {data.contractor.mustChangeCredential ? 'Mandatory PIN Change Pending' : 'PIN Changed'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="muted">No demonstration contractor found. Click "Reset Demonstration Dataset" above.</p>
                )}
              </Card>

              {/* Demo Site Card */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Demonstration Construction Site</h3>
                  {data.site && <ActiveChip active={data.site.active} />}
                </div>
                {data.site ? (
                  <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
                    <div>
                      <span className="muted">Site Code: </span>
                      <strong style={{ fontSize: 16, color: '#0E7C86' }}>{data.site.siteCode}</strong>
                    </div>
                    <div>
                      <span className="muted">Site Name: </span>
                      <b>{data.site.name}</b>
                    </div>
                    <div>
                      <span className="muted">Goa Hierarchy: </span>
                      <span>{data.site.state} → {data.site.district} → {data.site.taluka} → {data.site.area}</span>
                    </div>
                    <div>
                      <span className="muted">Detailed Address: </span>
                      <span>{data.site.address ?? '—'}</span>
                    </div>
                    <div>
                      <span className="muted">Landmark: </span>
                      <span>{data.site.landmark ?? '—'}</span>
                    </div>
                    <div>
                      <span className="muted">Site Contact: </span>
                      <span>{data.site.contactPhone ?? '—'}</span>
                    </div>
                    <div>
                      <span className="muted">Assigned Contractor: </span>
                      <span>{data.site.assignedContractorName ?? 'None'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="muted">No demonstration site found. Click "Reset Demonstration Dataset" above.</p>
                )}
              </Card>
            </div>

            {/* Synthetic Workers */}
            <SectionCard title="Synthetic Test Workers (10 Balanced Records: 5 Negative, 5 Positive)">
              <DataTable
                columns={workerColumns}
                rows={data.workers}
                rowKey={(w) => w.workerCode}
              />
              <p className="muted small" style={{ margin: '12px 0 0' }}>
                Workers self-register or authenticate via mobile using their phone number and PIN <code>1234</code>.
                Clinical statuses are derived from authorised diagnostic laboratory records.
              </p>
            </SectionCard>
          </>
        )}
      </ListBody>

      <ConfirmDialog
        open={confirmOpen}
        title="Reset Demonstration Dataset?"
        tone="danger"
        confirmLabel="Reset Demo Data"
        busy={resetting}
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
        body={
          <>
            <p style={{ marginTop: 0 }}>
              This will re-initialize only the synthetic demonstration records (Contractor <code>9800000001</code>, Site <code>SITE-DEMO01</code>, and the 10 synthetic workers).
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Safe Transaction:</strong> Real project records, historical audits, and other users are strictly preserved and untouched.
            </p>
          </>
        }
      />
    </div>
  );
}
