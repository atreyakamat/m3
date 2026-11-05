import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import {
  AdminChip,
  DataTable,
  FilterRow,
  ListBody,
  SectionCard,
  type Column,
} from '../../components/admin';
import { Button, Card, Modal } from '../../components/ui';
import { palette } from '../../lib/tokens';

export interface CorrectionRow {
  id: string;
  workerId: string;
  field: string;
  currentValue: string | null;
  proposedValue: string;
  reason: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  worker: {
    id: string;
    workerCode: string;
    fullName: string | null;
    phone: string;
    user: {
      displayName: string;
    };
  };
  reviewedBy?: {
    displayName: string;
  } | null;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full Name',
  phone: 'Mobile Phone Number',
  dateOfBirth: 'Date of Birth (YYYY-MM-DD)',
  gender: 'Gender',
  permanentAddressPincode: 'Permanent Address PIN Code',
  permanentAddressDistrict: 'Permanent Address District',
  permanentAddressState: 'Permanent Address State',
  permanentAddressDetails: 'Permanent Address Details',
};

export function ProfileCorrectionsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [activeReviewItem, setActiveReviewItem] = useState<CorrectionRow | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set('status', statusFilter);

  const list = useAsync<CorrectionRow[]>(
    () => api.get(`/admin/corrections?${queryParams.toString()}`),
    [statusFilter],
  );

  async function handleDecision(decision: 'APPROVED' | 'REJECTED') {
    if (!activeReviewItem) return;
    if (decision === 'REJECTED' && !adminNote.trim()) {
      setReviewError('An administrative note is required when rejecting a correction request.');
      return;
    }

    setSubmitting(true);
    setReviewError(null);

    try {
      await api.post(`/admin/corrections/${activeReviewItem.id}/review`, {
        status: decision,
        adminNote: adminNote.trim() || undefined,
      });

      setActiveReviewItem(null);
      setAdminNote('');
      list.reload();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit review decision');
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<CorrectionRow>[] = [
    {
      header: 'Date',
      width: '110px',
      render: (c) => new Date(c.createdAt).toLocaleDateString(),
    },
    {
      header: 'Worker',
      render: (c) => (
        <div>
          <span style={{ fontWeight: 600, color: palette.text }}>
            {c.worker?.fullName || c.worker?.user?.displayName || 'Worker'}
          </span>
          <div style={{ fontSize: 12, color: palette.textMuted }}>
            <code>{c.worker?.workerCode}</code> · {c.worker?.phone}
          </div>
        </div>
      ),
    },
    {
      header: 'Field Requested',
      render: (c) => (
        <span style={{ fontWeight: 600, color: palette.primary }}>
          {FIELD_LABELS[c.field] || c.field}
        </span>
      ),
    },
    {
      header: 'Current Value',
      render: (c) => (
        <span style={{ fontSize: 13, color: palette.textMuted }}>
          {c.currentValue || '— (Empty)'}
        </span>
      ),
    },
    {
      header: 'Proposed Value',
      render: (c) => (
        <span style={{ fontSize: 13, fontWeight: 600, color: palette.text }}>
          "{c.proposedValue}"
        </span>
      ),
    },
    {
      header: 'Reason',
      render: (c) => (
        <span style={{ fontSize: 12, color: palette.textMuted }}>{c.reason}</span>
      ),
    },
    {
      header: 'Status',
      width: '120px',
      render: (c) => (
        <AdminChip
          kind={
            c.status === 'APPROVED'
              ? 'green'
              : c.status === 'REJECTED'
              ? 'red'
              : 'amber'
          }
        >
          {c.status}
        </AdminChip>
      ),
    },
    {
      header: 'Admin Note',
      render: (c) => (
        <span style={{ fontSize: 12, fontStyle: 'italic', color: palette.textMuted }}>
          {c.adminNote || '—'}
        </span>
      ),
    },
    {
      header: '',
      render: (c) =>
        c.status === 'SUBMITTED' ? (
          <Button
            variant="secondary"
            onClick={() => {
              setActiveReviewItem(c);
              setAdminNote('');
              setReviewError(null);
            }}
          >
            Review
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      {/* Policy Notice Box */}
      <Card style={{ backgroundColor: '#F0FDF4', borderLeft: `4px solid ${palette.success}` }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#166534', marginBottom: 4 }}>
          🛡️ Strict Administrative Demographic Correction Policy
        </div>
        <div style={{ fontSize: 13, color: '#14532D', lineHeight: 1.5 }}>
          Admin approval applies corrections to allowlisted demographic fields only (Name, Phone, Date of Birth, Gender, Permanent Address).
          Modifications to diagnostic test results, malaria diagnoses, prescriptions, and Worker IDs are strictly forbidden by platform policy.
        </div>
      </Card>

      <SectionCard title="Demographic Profile Correction Requests">
        <FilterRow>
          <select
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              color: palette.text,
            }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by correction status"
          >
            <option value="">All statuses</option>
            <option value="SUBMITTED">Pending review (SUBMITTED)</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </FilterRow>

        <ListBody
          loading={list.loading}
          error={list.error}
          empty={!list.data || list.data.length === 0}
          emptyHint="No demographic correction requests matching the criteria."
          onRetry={list.reload}
        >
          {list.data && (
            <DataTable
              columns={columns}
              rows={list.data}
              rowKey={(c) => c.id}
            />
          )}
        </ListBody>
      </SectionCard>

      {/* Review Request Modal */}
      {activeReviewItem && (
        <Modal
          title="Review Demographic Correction Request"
          onClose={() => setActiveReviewItem(null)}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            {reviewError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {reviewError}
              </div>
            )}

            <div style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8, fontSize: 13 }}>
              <div>
                <strong>Worker:</strong> {activeReviewItem.worker?.fullName || activeReviewItem.worker?.user?.displayName} (<code>{activeReviewItem.worker?.workerCode}</code>)
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Field to Change:</strong> {FIELD_LABELS[activeReviewItem.field] || activeReviewItem.field}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Current Value:</strong> {activeReviewItem.currentValue || '— (Empty)'}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Proposed New Value:</strong> <span style={{ color: palette.primary, fontWeight: 700 }}>"{activeReviewItem.proposedValue}"</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Worker's Reason:</strong> {activeReviewItem.reason}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Administrative Review Note
              </label>
              <textarea
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Required when rejecting. Optional when approving (e.g. Verified with Aadhaar card)."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setActiveReviewItem(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => handleDecision('REJECTED')}
                disabled={submitting}
              >
                {submitting ? 'Rejecting…' : 'Reject Request'}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => handleDecision('APPROVED')}
                disabled={submitting}
              >
                {submitting ? 'Approving…' : 'Approve & Apply Correction'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
