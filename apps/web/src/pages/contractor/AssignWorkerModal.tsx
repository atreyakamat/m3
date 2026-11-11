import { useState } from 'react';
import { api } from '../../lib/api';
import { Button, Banner, Spinner, TextField } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface WorkerLookupResult {
  workerId: string;
  name: string;
  currentSite: {
    siteId: string;
    name: string;
  } | null;
  currentContractor: {
    contractorId: string;
    name: string;
  } | null;
}

interface AssignWorkerModalProps {
  isOpen: boolean;
  siteCode: string;
  siteName: string;
  onClose: () => void;
  onSuccess: () => void;
  onInitiateTransfer?: (workerId: string) => void;
}

export function AssignWorkerModal({
  isOpen,
  siteCode,
  siteName,
  onClose,
  onSuccess,
  onInitiateTransfer,
}: AssignWorkerModalProps) {
  const [workerCode, setWorkerCode] = useState('');
  const [note, setNote] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [worker, setWorker] = useState<WorkerLookupResult | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'danger' | 'warning'; text: string } | null>(null);

  if (!isOpen) return null;

  async function handleLookup() {
    if (!workerCode.trim()) return;
    setLookingUp(true);
    setMessage(null);
    setWorker(null);

    try {
      const res = await api.get<WorkerLookupResult>(`/workers/lookup/${encodeURIComponent(workerCode.trim())}`);
      setWorker(res);
      if (res.currentSite) {
        if (res.currentSite.siteId === siteCode) {
          setMessage({
            kind: 'warning',
            text: `Worker ${res.name} (${res.workerId}) is already actively assigned to this site (${siteName}).`,
          });
        } else {
          setMessage({
            kind: 'warning',
            text: `Worker ${res.name} (${res.workerId}) is currently assigned to "${res.currentSite.name}". Under surveillance rules, direct reassignment is not permitted. Please submit a Site Transfer Request instead.`,
          });
        }
      }
    } catch (err: any) {
      setMessage({
        kind: 'danger',
        text: err?.message || 'Worker not found with that Worker ID or Code.',
      });
    } finally {
      setLookingUp(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!worker || worker.currentSite) return;

    setAssigning(true);
    setMessage(null);

    try {
      await api.post(`/contractor/sites/${siteCode}/assign-worker`, {
        workerCode: worker.workerId,
        note: note.trim() || undefined,
      });

      setMessage({
        kind: 'success',
        text: `Worker ${worker.name} successfully assigned to ${siteName}!`,
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setMessage({
        kind: 'danger',
        text: err?.message || 'Failed to assign worker to site.',
      });
    } finally {
      setAssigning(false);
    }
  }

  const isEligibleForDirectAssignment = worker && !worker.currentSite;
  const isAssignedElsewhere = worker && worker.currentSite && worker.currentSite.siteId !== siteCode;

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
          maxWidth: 580,
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          overflow: 'hidden',
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
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: palette.text }}>
              Assign Worker to Site
            </h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Target Site: <strong>{siteName}</strong> (<span style={{ fontFamily: 'monospace' }}>{siteCode}</span>)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#64748B',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleAssign} style={{ padding: '24px' }}>
          {message && (
            <div style={{ marginBottom: 16 }}>
              <Banner kind={message.kind === 'warning' ? 'danger' : message.kind}>
                {message.text}
              </Banner>
            </div>
          )}

          <div className="stack" style={{ gap: 16 }}>
            {/* Step 1: Worker Lookup */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Worker ID / Code
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextField
                  placeholder="e.g. M3-SIM01 or M3-000001"
                  value={workerCode}
                  onChange={(e) => setWorkerCode(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!workerCode.trim() || lookingUp}
                  onClick={handleLookup}
                >
                  {lookingUp ? <Spinner /> : 'Look Up'}
                </Button>
              </div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Enter the worker's unique ID to verify eligibility. Only unassigned workers may be assigned directly.
              </p>
            </div>

            {/* Worker Confirmed Card */}
            {worker && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 8,
                  background: isEligibleForDirectAssignment
                    ? '#F0FDF4'
                    : isAssignedElsewhere
                      ? '#FEF3C7'
                      : '#F8FAFC',
                  border: `1px solid ${
                    isEligibleForDirectAssignment
                      ? '#BBF7D0'
                      : isAssignedElsewhere
                        ? '#FDE68A'
                        : '#E2E8F0'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 15,
                        color: isEligibleForDirectAssignment ? '#166534' : '#1E293B',
                      }}
                    >
                      {worker.name}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569', marginTop: 2 }}>
                      ID: {worker.workerId}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: isEligibleForDirectAssignment ? '#DCFCE7' : '#FEF3C7',
                        color: isEligibleForDirectAssignment ? '#15803D' : '#B45309',
                      }}
                    >
                      {isEligibleForDirectAssignment
                        ? 'Eligible (Unassigned)'
                        : isAssignedElsewhere
                          ? 'Assigned Elsewhere'
                          : 'Already at Site'}
                    </span>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      Current Site:{' '}
                      <strong>{worker.currentSite ? worker.currentSite.name : 'None (Unassigned)'}</strong>
                    </div>
                  </div>
                </div>

                {/* Transfer Guidance Callout */}
                {isAssignedElsewhere && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 12,
                      borderTop: '1px solid #FDE68A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#92400E' }}>
                      To move this worker to {siteName}, initiate a Transfer Request.
                    </span>
                    {onInitiateTransfer && (
                      <Button
                        type="button"
                        onClick={() => {
                          onClose();
                          onInitiateTransfer(worker.workerId);
                        }}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        Initiate Transfer →
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Note / Operational Rationale (if eligible) */}
            {isEligibleForDirectAssignment && (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Assignment Note / Justification (Optional)
                </label>
                <TextField
                  placeholder="e.g. Assigned to structural framing phase..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}

            {/* Policy Notice */}
            <div
              className="muted small"
              style={{
                background: '#F8FAFC',
                padding: '10px 14px',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                fontSize: 12,
              }}
            >
              ℹ️ <strong>Surveillance Rule:</strong> Direct assignment is reserved for workers without active assignments. Workers currently assigned to other sites must go through destination approval and current contractor release to maintain epidemiological chain-of-custody.
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid #E2E8F0',
            }}
          >
            <Button type="button" variant="secondary" onClick={onClose} disabled={assigning}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isEligibleForDirectAssignment || assigning}
              style={{
                background: isEligibleForDirectAssignment ? '#16A34A' : undefined,
                borderColor: isEligibleForDirectAssignment ? '#16A34A' : undefined,
              }}
            >
              {assigning ? 'Assigning…' : '✓ Confirm Assignment to Site'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
