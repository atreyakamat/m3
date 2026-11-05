import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import {
  ActiveChip,
  AdminChip,
  DataTable,
  FilterRow,
  ListBody,
  SectionCard,
  type Column,
} from '../../components/admin';
import { Button, Modal } from '../../components/ui';
import { palette } from '../../lib/tokens';

export interface FacilityRow {
  id: string;
  facilityCode: string;
  name: string;
  facilityType: 'PHC' | 'UHC';
  state: string;
  district: string;
  taluka: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  staffAssignments?: Array<{
    id: string;
    role: string;
    active: boolean;
  }>;
}

const GOA_TALUKAS = [
  'Bardez',
  'Tiswadi',
  'Pernem',
  'Bicholim',
  'Sattari',
  'Salcete',
  'Mormugao',
  'Ponda',
  'Quepem',
  'Canacona',
  'Sanguem',
  'Dharbandora',
];

export function FacilitiesList() {
  const nav = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [talukaFilter, setTalukaFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [facilityType, setFacilityType] = useState<'PHC' | 'UHC'>('PHC');
  const [district, setDistrict] = useState('North Goa');
  const [taluka, setTaluka] = useState('Bardez');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (typeFilter) queryParams.set('type', typeFilter);
  if (talukaFilter) queryParams.set('taluka', talukaFilter);

  const list = useAsync<FacilityRow[]>(
    () => api.get(`/facilities?${queryParams.toString()}`),
    [typeFilter, talukaFilter],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Facility name is required');
      return;
    }
    if (!address.trim()) {
      setFormError('Address is required');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await api.post('/facilities', {
        name: name.trim(),
        facilityType,
        state: 'Goa',
        district,
        taluka,
        address: address.trim(),
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        active: true,
      });

      setShowCreateModal(false);
      setName('');
      setAddress('');
      setLatitude('');
      setLongitude('');
      setPhone('');
      setEmail('');
      list.reload();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create facility');
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<FacilityRow>[] = [
    {
      header: 'Facility Code',
      width: '140px',
      render: (f) => <code style={{ fontSize: 13 }}>{f.facilityCode}</code>,
    },
    {
      header: 'Facility Name',
      render: (f) => (
        <Link
          to={`/admin/facilities/${f.id}`}
          style={{ color: palette.primary, fontWeight: 600 }}
        >
          {f.name}
        </Link>
      ),
    },
    {
      header: 'Type',
      width: '100px',
      render: (f) => (
        <AdminChip kind={f.facilityType === 'PHC' ? 'green' : 'blue'}>
          {f.facilityType}
        </AdminChip>
      ),
    },
    {
      header: 'Taluka / District',
      render: (f) => (
        <span>
          {f.taluka} · {f.district}
        </span>
      ),
    },
    {
      header: 'Staff Count',
      render: (f) => {
        const count = f.staffAssignments?.filter((s) => s.active).length ?? 0;
        return <span>{count} active staff</span>;
      },
    },
    {
      header: 'Contact',
      render: (f) => (
        <span style={{ fontSize: 13, color: palette.textMuted }}>
          {f.phone || f.email || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (f) => <ActiveChip active={f.active} />,
    },
    {
      header: '',
      render: (f) => (
        <Button variant="ghost" onClick={() => nav(`/admin/facilities/${f.id}`)}>
          View details
        </Button>
      ),
    },
  ];

  return (
    <div className="stack" style={{ display: 'grid', gap: 16 }}>
      <SectionCard
        title="Primary Health Centres (PHCs) & Urban Health Centres (UHCs)"
        actions={<Button onClick={() => setShowCreateModal(true)}>Create Facility</Button>}
      >
        <FilterRow>
          <select
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              color: palette.text,
            }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by facility type"
          >
            <option value="">All facility types</option>
            <option value="PHC">PHC (Primary Health Centre)</option>
            <option value="UHC">UHC (Urban Health Centre)</option>
          </select>

          <select
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              color: palette.text,
            }}
            value={talukaFilter}
            onChange={(e) => setTalukaFilter(e.target.value)}
            aria-label="Filter by taluka"
          >
            <option value="">All talukas</option>
            {GOA_TALUKAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterRow>

        <ListBody
          loading={list.loading}
          error={list.error}
          empty={!list.data || list.data.length === 0}
          emptyHint="No facilities registered yet. Click Create Facility to add one."
          onRetry={list.reload}
        >
          {list.data && (
            <DataTable
              columns={columns}
              rows={list.data}
              rowKey={(f) => f.id}
            />
          )}
        </ListBody>
      </SectionCard>

      {/* Create Facility Modal */}
      {showCreateModal && (
        <Modal
          title="Create New Health Facility"
          onClose={() => setShowCreateModal(false)}
        >
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: 14 }}>
            {formError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {formError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Facility Name *
              </label>
              <input
                type="text"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Candolim Primary Health Centre"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  Facility Type *
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={facilityType}
                  onChange={(e) => setFacilityType(e.target.value as 'PHC' | 'UHC')}
                >
                  <option value="PHC">PHC (Primary Health Centre)</option>
                  <option value="UHC">UHC (Urban Health Centre)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  District *
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="North Goa">North Goa</option>
                  <option value="South Goa">South Goa</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  Taluka *
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={taluka}
                  onChange={(e) => setTaluka(e.target.value)}
                >
                  {GOA_TALUKAS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  State
                </label>
                <input
                  type="text"
                  disabled
                  value="Goa"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                    background: '#F3F4F6',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                Address / Location Details *
              </label>
              <textarea
                required
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${palette.border}`,
                }}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full address, landmarks, village..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  Latitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g. 15.5173"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  Longitude (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. 73.7667"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  Contact Phone
                </label>
                <input
                  type="tel"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0832-2451234"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${palette.border}`,
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. phc.candolim@goa.gov.in"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Facility'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
