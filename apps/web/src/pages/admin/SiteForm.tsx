import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createAdminSiteSchema, updateAdminSiteSchema } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { formColumnStyle } from '../../components/adminHelpers';
import { Button, Card, TextField, TextArea, Select, Banner } from '../../components/ui';

interface LocationNodeItem { id: string; name: string; parentId: string | null }
interface LocationTree {
  state: LocationNodeItem;
  districts: LocationNodeItem[];
  talukas: LocationNodeItem[];
  areas: LocationNodeItem[];
}

interface SiteDetail {
  siteId: string;
  name: string;
  address: string | null;
  landmark: string | null;
  contactPhone: string | null;
  active: boolean;
  areaId?: string;
  area: string;
  taluka: string | null;
  district: string | null;
  state: string | null;
  contractor: { contractorId: string; name: string } | null;
}

interface ContractorOption { id: string; stakeholderId: string | null; name: string; role: string }

/** Shared create/edit form with official Goa cascading geographical hierarchy. */
export function SiteForm() {
  const { siteCode } = useParams();
  const editing = Boolean(siteCode);

  const tree = useAsync<LocationTree>(() => api.get('/admin/locations/tree'), []);
  const contractors = useAsync<Array<ContractorOption>>(
    () => api.get('/admin/users?role=CONTRACTOR&pageSize=100').then(
      (r: unknown) => {
        const items = (r as { items: Array<{ id: string; stakeholderId: string | null; displayName: string; role: string }> }).items;
        return items.map((u) => ({ id: u.id, stakeholderId: u.stakeholderId, name: u.displayName, role: u.role }));
      },
    ),
    [],
  );
  const existing = useAsync<SiteDetail | null>(
    () => (siteCode ? api.get(`/admin/sites/${siteCode}`) : Promise.resolve(null)),
    [siteCode],
  );

  const loading = (editing && (existing.loading || (existing.data === null && !existing.error))) || tree.loading;

  if (loading) {
    return (
      <Card style={{ maxWidth: 640 }}>
        <h2 style={{ marginTop: 0 }}>{editing ? `Edit site ${siteCode}` : 'Create construction site'}</h2>
        <p className="muted">Loading geographical hierarchy and site details…</p>
      </Card>
    );
  }

  return (
    <SiteFields
      key={existing.data?.siteId ?? 'create'}
      editing={editing}
      siteCode={siteCode ?? null}
      initial={existing.data}
      tree={tree.data ?? { state: { id: 'goa', name: 'Goa', parentId: null }, districts: [], talukas: [], areas: [] }}
      contractors={contractors.data ?? []}
    />
  );
}

interface SiteFieldProps {
  editing: boolean;
  siteCode: string | null;
  initial: SiteDetail | null;
  tree: LocationTree;
  contractors: ContractorOption[];
}

function SiteFields({ editing, siteCode, initial, tree, contractors }: SiteFieldProps) {
  const nav = useNavigate();
  const [name, setName] = useState(initial?.name ?? '');

  // Calculate initial selections from initial.areaId
  const initialNodes = useMemo(() => {
    if (!initial?.areaId) return { districtId: '', talukaId: '', areaId: '' };
    const area = tree.areas.find((a) => a.id === initial.areaId);
    const taluka = area ? tree.talukas.find((t) => t.id === area.parentId) : null;
    const district = taluka ? tree.districts.find((d) => d.id === taluka.parentId) : null;
    return {
      districtId: district?.id ?? '',
      talukaId: taluka?.id ?? '',
      areaId: area?.id ?? initial.areaId,
    };
  }, [initial, tree]);

  const [selectedDistrictId, setSelectedDistrictId] = useState(initialNodes.districtId);
  const [selectedTalukaId, setSelectedTalukaId] = useState(initialNodes.talukaId);
  const [areaId, setAreaId] = useState(initialNodes.areaId);

  const [contractorId, setContractorId] = useState(initial?.contractor?.contractorId ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [landmark, setLandmark] = useState(initial?.landmark ?? '');
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Cascading filters
  const filteredTalukas = useMemo(() => {
    if (!selectedDistrictId) return [];
    return tree.talukas.filter((t) => t.parentId === selectedDistrictId);
  }, [tree.talukas, selectedDistrictId]);

  const filteredAreas = useMemo(() => {
    if (!selectedTalukaId) return [];
    return tree.areas.filter((a) => a.parentId === selectedTalukaId);
  }, [tree.areas, selectedTalukaId]);

  function handleDistrictChange(newDistrictId: string) {
    setSelectedDistrictId(newDistrictId);
    setSelectedTalukaId('');
    setAreaId('');
  }

  function handleTalukaChange(newTalukaId: string) {
    setSelectedTalukaId(newTalukaId);
    setAreaId('');
  }

  async function submit() {
    setError(null);
    if (!areaId) {
      setError('Please select a complete geographical location (District → Taluka → Village/Town).');
      return;
    }

    const payload = {
      name: name.trim(),
      areaId,
      contractorId: contractorId || null,
      address: address.trim() || undefined,
      landmark: landmark.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
    };
    const schema = editing ? updateAdminSiteSchema : createAdminSiteSchema;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    try {
      const res = editing && siteCode
        ? await api.put(`/admin/sites/${siteCode}`, {
            name: payload.name,
            contractorId: payload.contractorId,
            address: payload.address,
            landmark: payload.landmark,
            contactPhone: payload.contactPhone,
            ...(areaId ? { areaId } : {}),
          })
        : await api.post('/admin/sites', payload);
      nav(`/admin/sites/${(res as SiteDetail).siteId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the site');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0 }}>{editing ? `Edit site ${siteCode}` : 'Create construction site'}</h2>
      {editing && <p className="muted small" style={{ marginTop: -6 }}>Site ID {siteCode} is permanent and cannot be changed.</p>}
      {error && <Banner kind="danger">{error}</Banner>}
      <div style={formColumnStyle()}>
        <TextField label="Site name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Demonstration Zuari Greens Housing Project" />

        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 12px', color: '#1e293b' }}>Official Goa Geographical Hierarchy</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Select label="State" value="Goa" disabled>
              <option value="Goa">Goa</option>
            </Select>

            <Select
              label="District *"
              value={selectedDistrictId}
              onChange={(e) => handleDistrictChange(e.target.value)}
            >
              <option value="">Select district…</option>
              {tree.districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>

            <Select
              label="Taluka *"
              value={selectedTalukaId}
              disabled={!selectedDistrictId}
              onChange={(e) => handleTalukaChange(e.target.value)}
            >
              <option value="">{selectedDistrictId ? 'Select taluka…' : 'First select district'}</option>
              {filteredTalukas.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>

            <Select
              label="Village / Town (Area) *"
              value={areaId}
              disabled={!selectedTalukaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              <option value="">{selectedTalukaId ? 'Select village or town…' : 'First select taluka'}</option>
              {filteredAreas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <p className="muted small" style={{ margin: '8px 0 0', fontSize: 12 }}>
            Source: Govt of Goa Revenue Dept Notification (Dec 2025) & Census Directorate. Includes Kushavati, North Goa, and South Goa.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <TextField
            label="Landmark (optional)"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="e.g. Opposite Old Primary School"
          />
          <TextField
            label="Site contact phone (optional)"
            value={contactPhone}
            inputMode="numeric"
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="10-digit number"
          />
        </div>

        <TextArea
          label="Detailed address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. Plot No. 84/2, Quepem Industrial & Residential Layout"
        />

        <Select label="Assigned contractor (optional — one per site)" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
          <option value="">No contractor assigned</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.stakeholderId ? ` (${c.stakeholderId})` : ''}</option>
          ))}
        </Select>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create site'}</Button>
          <Button variant="secondary" onClick={() => nav(-1)} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}
