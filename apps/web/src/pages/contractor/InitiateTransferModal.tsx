import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button, TextField, Select, Banner, Spinner } from '../../components/ui';
import { palette } from '../../lib/tokens';

interface ContractorSite {
  siteCode: string;
  name: string;
}

interface WorkerLookupResult {
  workerId: string;
  name: string;
  currentSite: { siteId: string; name: string } | null;
}

interface InitiateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InitiateTransferModal({ isOpen, onClose, onSuccess }: InitiateTransferModalProps) {
  const [sites, setSites] = useState<ContractorSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [foundWorker, setFoundWorker] = useState<WorkerLookupResult | null>(null);
  const [toSiteId, setToSiteId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingSites(true);
      api
        .get<any[]>('/contractor/sites')
        .then((res) => {
          setSites(
            res.map((s) => ({
              siteCode: s.siteCode,
              name: s.name,
            })),
          );
        })
        .catch(() => {})
        .finally(() => setLoadingSites(false));

      setWorkerId('');
      setFoundWorker(null);
      setToSiteId('');
      setNote('');
      setMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleLookup() {
    if (!workerId.trim()) return;
    setLookingUp(true);
    setMsg(null);
    setFoundWorker(null);
    try {
      const res = await api.get<WorkerLookupResult>(`/workers/lookup/${encodeURIComponent(workerId.trim())}`);
      setFoundWorker(res);
    } catch (err: any) {
      setMsg({ kind: 'danger', text: err?.message || 'Worker not found with that Worker ID.' });
    } finally {
      setLookingUp(false);
    }
  }

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!foundWorker || !toSiteId) return;

    setSubmitting(true);
    setMsg(null);
    try {
      await api.post('/contractor/transfers/initiate', {
        workerId: foundWorker.workerId,
        toSiteId,
        note: note.trim() || undefined,
      });

      setMsg({
        kind: 'success',
        text: 'Transfer request submitted successfully. The worker will be prompted to accept in the Worker application.',
      });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setMsg({ kind: 'danger', text: err?.message || 'Failed to submit transfer request.' });
    } finally {
      setSubmitting(false);
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
            <h2 style={{ margin: 0, fontSize: 18, color: palette.text }}>Initiate Worker Transfer</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              Request a worker transfer into one of your managed construction sites.
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
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleInitiate} style={{ padding: '24px' }}>
          {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

          <div className="stack" style={{ gap: 16 }}>
            {/* Step 1: Worker Lookup */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Worker ID / Code
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <TextField
                  placeholder="e.g. M3-000001 or 9785758377"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!workerId.trim() || lookingUp}
                  onClick={handleLookup}
                >
                  {lookingUp ? 'Checking…' : 'Look Up'}
                </Button>
              </div>
            </div>

            {/* Confirmed Worker Preview */}
            {foundWorker && (
              <div
                style={{
                  padding: '12px 16px',
                  background: '#F0FDF4',
                  borderRadius: 8,
                  border: '1px solid #BBF7D0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#166534', fontSize: 14 }}>
                      {foundWorker.name}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#15803D' }}>
                      ID: {foundWorker.workerId}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted small">Current Site</div>
                    <div style={{ fontWeight: 500, fontSize: 13, color: '#1E293B' }}>
                      {foundWorker.currentSite?.name ?? 'No Site Assigned'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Select Destination Site */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Destination Construction Site
              </label>
              {loadingSites ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
                  <Spinner /> Loading your assigned construction sites…
                </div>
              ) : (
                <Select
                  value={toSiteId}
                  onChange={(e) => setToSiteId(e.target.value)}
                  disabled={!foundWorker}
                >
                  <option value="">— Select destination site —</option>
                  {sites.map((s) => (
                    <option key={s.siteCode} value={s.siteCode}>
                      {s.name} ({s.siteCode})
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {/* Step 3: Note */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Transfer Note / Reason (Optional)
              </label>
              <TextField
                placeholder="Reason or operational justification for site transfer…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="muted small" style={{ background: '#F8FAFC', padding: 10, borderRadius: 6 }}>
              ℹ️ <strong>Workflow:</strong> After submitting, the worker will be notified in the Worker application to accept or decline. Once accepted, the worker’s current contractor will be asked to release the worker.
            </div>
          </div>

          {/* Footer Actions */}
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
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!foundWorker || !toSiteId || submitting}>
              {submitting ? 'Submitting…' : 'Submit Transfer Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
