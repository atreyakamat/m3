import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Banner, Spinner, TextField } from '../../components/ui';
import { TransferStatusChip } from '../../components/StatusChip';
import { palette } from '../../lib/tokens';

export interface TransferDetailData {
  id: string;
  transferId: string;
  workerId: string;
  workerName: string;
  worker: {
    id: string;
    workerCode: string;
    name: string;
    phone?: string | null;
    age?: number | null;
    gender?: string | null;
    malariaStatus?: null;
  };
  fromSite: {
    id: string;
    siteCode: string;
    name: string;
    area?: string;
  } | null;
  toSite: {
    id: string;
    siteCode: string;
    name: string;
    area?: string;
  };
  currentSite: { siteId: string; name: string } | null;
  destinationSite: { siteId: string; name: string };
  fromContractor: { id: string; name: string } | null;
  toContractor: { id: string; name: string } | null;
  initiator: 'WORKER' | 'CONTRACTOR';
  initiatorType: 'WORKER' | 'CONTRACTOR';
  status: string;
  workerDecision: string;
  workerDecisionAt: string | null;
  toContractorDecision: string;
  toContractorDecisionAt: string | null;
  fromContractorDecision: string;
  fromContractorDecisionAt: string | null;
  note: string | null;
  createdAt: string;
  effectiveAt: string | null;
  cancelledAt: string | null;
  myRole: 'CURRENT_CONTRACTOR' | 'DESTINATION_CONTRACTOR' | 'BOTH';
  isDestinationContractor: boolean;
  isCurrentContractor: boolean;
  canApproveDestination: boolean;
  canReleaseWorker: boolean;
  canCancel: boolean;
  isActionableByMe: boolean;
  requiredNextAction: string;
  timeline: Array<{
    id: string;
    step: string;
    status: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
}

interface TransferDetailModalProps {
  transferId: string | null;
  onClose: () => void;
  onActionSuccess?: () => void;
}

export function TransferDetailModal({
  transferId,
  onClose,
  onActionSuccess,
}: TransferDetailModalProps) {
  const [data, setData] = useState<TransferDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [reason, setReason] = useState('');

  const fetchDetail = React.useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TransferDetailData>(`/contractor/transfers/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load transfer details');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (transferId) {
      setFeedback(null);
      setReason('');
      fetchDetail(transferId);
    } else {
      setData(null);
    }
  }, [transferId, fetchDetail]);

  if (!transferId) return null;

  async function handleAction(actionType: 'approve' | 'release' | 'reject' | 'cancel') {
    if (!transferId) return;
    setActing(true);
    setFeedback(null);
    try {
      const endpoint =
        actionType === 'approve'
          ? `/contractor/transfers/${transferId}/approve`
          : actionType === 'release'
            ? `/contractor/transfers/${transferId}/release`
            : actionType === 'cancel'
              ? `/contractor/transfers/${transferId}/cancel`
              : `/contractor/transfers/${transferId}/reject`;

      await api.post(endpoint, { reason: reason.trim() || undefined });

      const successMsg =
        actionType === 'approve'
          ? 'Destination request approved. Current contractor has been notified to release the worker.'
          : actionType === 'release'
            ? 'Worker released successfully. Site transfer is now completed.'
            : actionType === 'cancel'
              ? 'Transfer request cancelled.'
              : 'Transfer request rejected.';

      setFeedback({ kind: 'success', text: successMsg });
      setReason('');
      await fetchDetail(transferId);
      if (onActionSuccess) onActionSuccess();
    } catch (err: any) {
      setFeedback({ kind: 'danger', text: err?.message || 'Failed to complete action' });
    } finally {
      setActing(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          maxWidth: 780,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            position: 'sticky',
            top: 0,
            background: '#FFFFFF',
            zIndex: 10,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: palette.text }}>
                Transfer Request Details
              </h2>
              {data && <TransferStatusChip status={data.status as any} />}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Request ID:{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{transferId}</span>
              {data && (
                <>
                  {' '}· Initiated by{' '}
                  <span style={{ fontWeight: 600 }}>
                    {data.initiatorType === 'WORKER' ? 'Worker' : 'Contractor'}
                  </span>{' '}
                  on {new Date(data.createdAt).toLocaleDateString()}
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              color: '#64748B',
              padding: 4,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spinner />
              <p className="muted small" style={{ marginTop: 8 }}>Loading transfer details…</p>
            </div>
          )}

          {error && <Banner kind="danger">{error}</Banner>}
          {feedback && <Banner kind={feedback.kind}>{feedback.text}</Banner>}

          {data && (
            <div className="stack" style={{ gap: 20 }}>
              {/* Contextual Action Required Callout */}
              {data.isActionableByMe && !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(data.status) && (
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 8,
                    background: data.canApproveDestination ? '#EFF6FF' : '#FEF3C7',
                    border: `1px solid ${data.canApproveDestination ? '#BFDBFE' : '#FDE68A'}`,
                  }}
                >
                  <div style={{ fontWeight: 600, color: data.canApproveDestination ? '#1E40AF' : '#92400E', fontSize: 15 }}>
                    {data.canApproveDestination
                      ? '⚡ Action Required: Destination Approval'
                      : '⚡ Action Required: Worker Release'}
                  </div>
                  <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#334155' }}>
                    {data.canApproveDestination
                      ? 'As the destination contractor, you must review and approve or reject this incoming transfer request before the worker can be released.'
                      : 'The transfer request is approved and worker is ready. Confirm release to complete site transfer and update workforce records.'}
                  </p>

                  <div style={{ marginBottom: 12 }}>
                    <TextField
                      placeholder="Optional remarks or notes for this decision..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    {data.canApproveDestination && (
                      <>
                        <Button
                          disabled={acting}
                          onClick={() => handleAction('approve')}
                          style={{ background: '#16A34A', borderColor: '#16A34A' }}
                        >
                          {acting ? 'Processing…' : '✓ Approve Destination Request'}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={acting}
                          onClick={() => handleAction('reject')}
                        >
                          ✕ Reject Request
                        </Button>
                      </>
                    )}

                    {data.canReleaseWorker && (
                      <>
                        <Button
                          disabled={acting}
                          onClick={() => handleAction('release')}
                          style={{ background: '#2563EB', borderColor: '#2563EB' }}
                        >
                          {acting ? 'Processing…' : '✓ Release Worker to New Site'}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={acting}
                          onClick={() => handleAction('reject')}
                        >
                          ✕ Decline Release
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Status & Next Step Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                }}
              >
                <div>
                  <div className="muted small">Required Next Action</div>
                  <div style={{ fontWeight: 600, color: palette.text, marginTop: 2 }}>
                    {data.requiredNextAction}
                  </div>
                </div>
                <div>
                  <div className="muted small">Your Role</div>
                  <div style={{ fontWeight: 600, color: '#475569', marginTop: 2 }}>
                    {data.myRole === 'BOTH'
                      ? 'Origin & Destination Contractor'
                      : data.myRole === 'DESTINATION_CONTRACTOR'
                        ? 'Destination Contractor'
                        : 'Current Contractor'}
                  </div>
                </div>
              </div>

              {/* Transfer Route & Sites */}
              <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: palette.text }}>
                  Site Transfer Route
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Origin */}
                  <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Current Origin Site
                    </div>
                    <div style={{ fontWeight: 600, color: palette.text, fontSize: 15, marginTop: 4 }}>
                      {data.fromSite?.name ?? 'No Site Assigned'}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      {data.fromSite?.siteCode ?? '—'}
                    </div>
                    <div className="small" style={{ color: '#475569', marginTop: 6 }}>
                      Managing Contractor: {data.fromContractor?.name ?? 'Unassigned'}
                    </div>
                  </div>

                  {/* Destination */}
                  <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Destination Site
                    </div>
                    <div style={{ fontWeight: 600, color: palette.text, fontSize: 15, marginTop: 4 }}>
                      {data.toSite.name}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      {data.toSite.siteCode}
                    </div>
                    <div className="small" style={{ color: '#475569', marginTop: 6 }}>
                      Destination Contractor: {data.toContractor?.name ?? 'Assigned'}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Authorized Worker Information (Strict Privacy) */}
              <Card>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, color: palette.text }}>
                  Worker Demographics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Worker Name</div>
                    <div style={{ fontWeight: 600, color: palette.text, marginTop: 2 }}>{data.worker.name}</div>
                  </div>
                  <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Worker ID</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 600, color: palette.text, marginTop: 2 }}>
                      {data.worker.workerCode}
                    </div>
                  </div>
                  <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Age / Gender</div>
                    <div style={{ fontWeight: 500, color: palette.text, marginTop: 2 }}>
                      {data.worker.age ? `${data.worker.age} yrs` : '—'} · {data.worker.gender || '—'}
                    </div>
                  </div>
                  <div style={{ padding: 10, background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Phone Number</div>
                    <div style={{ fontWeight: 500, color: palette.text, marginTop: 2 }}>
                      {data.worker.phone || '—'}
                    </div>
                  </div>
                </div>
                <div className="muted small" style={{ marginTop: 10, fontStyle: 'italic' }}>
                  🔒 Individual malaria diagnostic results and clinical surveys are strictly confidential and omitted.
                </div>
              </Card>

              {/* Decisions & Worker Response */}
              <Card>
                <h3 style={{ margin: '0 0 14px', fontSize: 16, color: palette.text }}>
                  Decisions & Responses
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Worker Acceptance</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          background:
                            data.workerDecision === 'APPROVED'
                              ? '#E3F5EA'
                              : data.workerDecision === 'REJECTED'
                                ? '#FBE4E4'
                                : '#FCF2DD',
                          color:
                            data.workerDecision === 'APPROVED'
                              ? '#1F7A45'
                              : data.workerDecision === 'REJECTED'
                                ? '#A62828'
                                : '#A5741A',
                        }}
                      >
                        {data.workerDecision === 'APPROVED'
                          ? 'Accepted'
                          : data.workerDecision === 'REJECTED'
                            ? 'Declined'
                            : 'Pending Response'}
                      </span>
                    </div>
                    {data.workerDecisionAt && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {new Date(data.workerDecisionAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Destination Approval</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          background:
                            data.toContractorDecision === 'APPROVED'
                              ? '#E3F5EA'
                              : data.toContractorDecision === 'REJECTED'
                                ? '#FBE4E4'
                                : '#FCF2DD',
                          color:
                            data.toContractorDecision === 'APPROVED'
                              ? '#1F7A45'
                              : data.toContractorDecision === 'REJECTED'
                                ? '#A62828'
                                : '#A5741A',
                        }}
                      >
                        {data.toContractorDecision === 'APPROVED'
                          ? 'Approved'
                          : data.toContractorDecision === 'REJECTED'
                            ? 'Rejected'
                            : 'Pending Review'}
                      </span>
                    </div>
                    {data.toContractorDecisionAt && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {new Date(data.toContractorDecisionAt).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div className="muted small">Current Contractor Release</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          background:
                            data.fromContractorDecision === 'APPROVED'
                              ? '#E3F5EA'
                              : data.fromContractorDecision === 'REJECTED'
                                ? '#FBE4E4'
                                : '#FCF2DD',
                          color:
                            data.fromContractorDecision === 'APPROVED'
                              ? '#1F7A45'
                              : data.fromContractorDecision === 'REJECTED'
                                ? '#A62828'
                                : '#A5741A',
                        }}
                      >
                        {data.fromContractorDecision === 'APPROVED'
                          ? 'Released'
                          : data.fromContractorDecision === 'REJECTED'
                            ? 'Declined'
                            : 'Pending Release'}
                      </span>
                    </div>
                    {data.fromContractorDecisionAt && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {new Date(data.fromContractorDecisionAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Complete Transfer Milestones & Timeline */}
              <Card>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, color: palette.text }}>
                  Transfer Milestones & Timeline
                </h3>
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      bottom: 8,
                      left: 7,
                      width: 2,
                      background: '#E2E8F0',
                    }}
                  />
                  {data.timeline.map((step) => {
                    const isDone = step.status === 'DONE';
                    const isPending = step.status === 'PENDING';
                    const isRejected = step.status === 'REJECTED';
                    const isCancelled = step.status === 'CANCELLED';

                    return (
                      <div
                        key={step.id}
                        style={{
                          position: 'relative',
                          marginBottom: 18,
                        }}
                      >
                        {/* Dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: -24,
                            top: 4,
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: isDone
                              ? '#16A34A'
                              : isPending
                                ? '#F59E0B'
                                : isRejected
                                  ? '#DC2626'
                                  : isCancelled
                                    ? '#64748B'
                                    : '#CBD5E1',
                            border: '2px solid #FFFFFF',
                            boxShadow: '0 0 0 1px #E2E8F0',
                          }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: palette.text }}>
                              {step.title}
                            </span>
                            <span className="muted small">
                              {new Date(step.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#F8FAFC',
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          <div>
            {data?.canCancel && (
              <Button
                variant="secondary"
                disabled={acting}
                onClick={() => handleAction('cancel')}
                style={{ fontSize: 13 }}
              >
                Cancel Transfer Request
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
