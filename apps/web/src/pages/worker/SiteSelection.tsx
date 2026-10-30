import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { LocationNodeDto, Paginated, SiteDto } from '../../lib/types';
import { Card, Button, Select, TextField, Banner, Spinner } from '../../components/ui';
import { palette } from '../../lib/tokens';

export function SiteSelection() {
  const nav = useNavigate();
  const [states, setStates] = useState<LocationNodeDto[]>([]);
  const [districts, setDistricts] = useState<LocationNodeDto[]>([]);
  const [talukas, setTalukas] = useState<LocationNodeDto[]>([]);
  const [areas, setAreas] = useState<LocationNodeDto[]>([]);
  const [sel, setSel] = useState({ state: '', district: '', taluka: '', area: '' });
  const [search, setSearch] = useState('');
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get<LocationNodeDto[]>('/sites/locations?level=STATE').then(setStates).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const load = (parentId: string, set: (v: LocationNodeDto[]) => void) =>
    api.get<LocationNodeDto[]>(`/sites/locations?parentId=${parentId}`).then(set);

  const loadSites = (areaId?: string, q?: string) => {
    const params = new URLSearchParams();
    if (areaId) params.set('areaId', areaId);
    if (q) params.set('search', q);
    api.get<Paginated<SiteDto>>(`/sites?${params.toString()}`).then((p) => setSites(p.items));
  };

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <Card accent={palette.primary}>
        <h2>Select your construction site</h2>
        <p className="muted small">Drill down through the location hierarchy, or search by name / Site ID.</p>
        {error && <Banner kind="danger">{error}</Banner>}
        <div className="grid" style={{ marginTop: 12 }}>
          <Select label="State" value={sel.state} onChange={(e) => { const v = e.target.value; setSel({ state: v, district: '', taluka: '', area: '' }); setDistricts([]); setTalukas([]); setAreas([]); setSites([]); if (v) load(v, setDistricts); }}>
            <option value="">—</option>
            {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select label="District" value={sel.district} disabled={!sel.state} onChange={(e) => { const v = e.target.value; setSel((p) => ({ ...p, district: v, taluka: '', area: '' })); setTalukas([]); setAreas([]); setSites([]); if (v) load(v, setTalukas); }}>
            <option value="">—</option>
            {districts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select label="Taluka" value={sel.taluka} disabled={!sel.district} onChange={(e) => { const v = e.target.value; setSel((p) => ({ ...p, taluka: v, area: '' })); setAreas([]); setSites([]); if (v) load(v, setAreas); }}>
            <option value="">—</option>
            {talukas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select label="Area" value={sel.area} disabled={!sel.taluka} onChange={(e) => { const v = e.target.value; setSel((p) => ({ ...p, area: v })); if (v) loadSites(v); }}>
            <option value="">—</option>
            {areas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <TextField placeholder="Search sites…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
          <Button variant="secondary" onClick={() => loadSites(sel.area || undefined, search)}>Search</Button>
        </div>
      </Card>

      {sites.length > 0 && (
        <Card>
          <h3>Sites</h3>
          <div className="stack">
            {sites.map((s) => (
              <div key={s.siteId} className="spread" style={{ borderBottom: `1px solid ${palette.border}`, paddingBottom: 10 }}>
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted small">{s.siteId} · {s.area}</div>
                </div>
                <Button
                  disabled={saving === s.siteId}
                  onClick={async () => {
                    setSaving(s.siteId);
                    setError(null);
                    try {
                      await api.post('/workers/me/site', { siteId: s.siteId });
                      nav('/worker', { replace: true });
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Error');
                      setSaving(null);
                    }
                  }}
                >
                  Select
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
