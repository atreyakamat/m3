import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { TravelReportStatus } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { AdminChip, ListBody } from '../../components/admin';
import { isoDate } from '../../components/adminHelpers';
import { Button, Card, Banner, TextArea, Select } from '../../components/ui';

interface ReportDetail {
  id: string;
  worker: { workerId: string; name: string; phone: string };
  travelRecord: {
    id: string; status: string; planningTravel: boolean;
    departureDate: string | null; returnDate: string | null;
    destination: string | null; state: string | null; createdAt: string;
  };
  reason: string;
  status: TravelReportStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  submittedBy: { name: string; stakeholderId: string | null };
  createdAt: string;
  cancellationNotifications: Array<{ id: string; title: string; body: string; createdAt: string }>;
}

export function TravelReportDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync<ReportDetail>(() => api.get(`/admin/travel-reports/${id}`), [id]);
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function submitReview() {
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/travel-reports/${id}/review`, {
        status: reviewStatus || 'REVIEWED',
        note: reviewNote || undefined,
      });
      setReviewStatus('');
      setReviewNote('');
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not record the review');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <Card>
        <ListBody loading={loading} error={error} empty={false} onRetry={reload}>
          {data && (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, flex: 1 }}>Travel report</h2>
                <AdminChip kind={data.status === 'OPEN' ? 'amber' : data.status === 'REVIEWED' ? 'blue' : 'green'}>
                  {data.status.charAt(0) + data.status.slice(1).toLowerCase()}
                </AdminChip>
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
                <div>
                  <div className="muted small" style={{ fontWeight: 700 }}>Worker</div>
                  <Link to={`/admin/workers/${data.worker.workerId}`} style={{ color: '#0E7C86' }}>
                    {data.worker.name} ({data.worker.workerId})
                  </Link>
                </div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Reported by</div>{data.submittedBy.name}</div>
                <div><div className="muted small" style={{ fontWeight: 700 }}>Submitted</div>{isoDate(data.createdAt)}</div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="muted small" style={{ fontWeight: 700 }}>Contractor's comment (reason)</div>
                <p style={{ margin: '4px 0 0', fontSize: 15 }}>{data.reason}</p>
              </div>
              <div style={{ marginTop: 14, background: '#F6F8FA', borderRadius: 12, padding: 12 }}>
                <div className="muted small" style={{ fontWeight: 700 }}>Linked travel record</div>
                <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                  Departure {data.travelRecord.departureDate ? isoDate(data.travelRecord.departureDate) : '—'} ·
                  Return {data.travelRecord.returnDate ? isoDate(data.travelRecord.returnDate) : '—'} ·
                  Destination {data.travelRecord.destination ?? '—'} ({data.travelRecord.state ?? '—'})
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Travel record status: <b>{data.travelRecord.status}</b>
                  <code style={{ fontSize: 11, marginLeft: 8 }}>{data.travelRecord.id.slice(0, 13)}…</code>
                </p>
              </div>
              {data.reviewNote && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted small" style={{ fontWeight: 700 }}>Latest review note</div>
                  <p style={{ margin: '4px 0 0' }}>{data.reviewNote}{data.reviewedAt ? ` · ${isoDate(data.reviewedAt)}` : ''}</p>
                </div>
              )}
              {data.cancellationNotifications.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Banner kind="warning">The worker cancelled this travel after the report was submitted. The report is preserved below and the cancellation was recorded in the audit trail.</Banner>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13 }}>
                    {data.cancellationNotifications.map((n) => (
                      <li key={n.id}>{n.body} · {isoDate(n.createdAt)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {actionError && <div style={{ marginTop: 12 }}><Banner kind="danger">{actionError}</Banner></div>}
            </>
          )}
        </ListBody>
      </Card>

      {data && data.status !== 'RESOLVED' && (
        <Card>
          <h3 style={{ marginTop: 0 }}>Record review / follow-up status</h3>
          <div style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
            <Select label="Status" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
              <option value="">Select…</option>
              <option value="REVIEWED">Reviewed (follow-up continues)</option>
              <option value="RESOLVED">Resolved (closed)</option>
            </Select>
            <TextArea label="Follow-up note (optional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={submitReview} disabled={busy || !reviewStatus}>Record review</Button>
              <Button variant="secondary" onClick={() => nav('/admin/travel-reports')} disabled={busy}>Back</Button>
            </div>
          </div>
        </Card>
      )}
      {data && data.status === 'RESOLVED' && (
        <Button variant="secondary" onClick={() => nav('/admin/travel-reports')}>Back to reports</Button>
      )}
    </div>
  );
}
