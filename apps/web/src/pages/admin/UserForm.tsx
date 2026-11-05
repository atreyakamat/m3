import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAdminUserSchema, pinSchema, ADMIN_PROVISIONABLE_ROLES, ROLE_LABELS } from '@m3/shared';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Button, Card, TextField, Select, Banner } from '../../components/ui';

interface SiteRow { siteId: string; name: string; active: boolean }

interface CreatedUserResult {
  id: string;
  stakeholderId: string;
  fullName: string;
  phone: string;
  role: string;
  tempPin: string;
}

/** Create user: generates the unique role-scoped ID (C/HW/CL/P/RL + sequence) server-side and securely reveals temp PIN once. */
export function UserForm() {
  const nav = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>('CONTRACTOR');
  const [tempPin, setTempPin] = useState('');
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<CreatedUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const sites = useAsync<{ items: SiteRow[] }>(() => api.get('/admin/sites?pageSize=100'), []);

  function generatePin() {
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
    setTempPin(randomPin);
  }

  async function submit() {
    setError(null);
    const parsed = createAdminUserSchema.safeParse({
      fullName: fullName.trim(),
      phone: phone.trim(),
      role,
      tempPin: tempPin.trim(),
      siteIds: role === 'CONTRACTOR' ? siteIds : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ id: string; stakeholderId: string; role: string; fullName: string; phone: string }>('/admin/users', parsed.data);
      setCreatedInfo({
        id: res.id,
        stakeholderId: res.stakeholderId,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        role: parsed.data.role,
        tempPin: parsed.data.tempPin,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the account');
    } finally {
      setBusy(false);
    }
  }

  function copyCredentials() {
    if (!createdInfo) return;
    const text = `M3 Malaria Surveillance - Account Credentials\nRole: ${createdInfo.role}\nStakeholder ID: ${createdInfo.stakeholderId}\nName: ${createdInfo.fullName}\nPhone: ${createdInfo.phone}\nTemporary PIN: ${createdInfo.tempPin}\n(First login requires mandatory PIN change)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  if (createdInfo) {
    return (
      <Card style={{ maxWidth: 640 }}>
        <h2 style={{ marginTop: 0, color: '#2E9E5B' }}>✓ Account Created Successfully</h2>
        <Banner kind="warning">
          <strong>Important Security Notice:</strong> This temporary PIN is shown only once at account creation time and will never be displayed again. Record it securely now.
        </Banner>

        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 16px', fontSize: 14 }}>
            <span className="muted">Stakeholder Code:</span>
            <span><strong style={{ fontSize: 16, color: '#0E7C86' }}>{createdInfo.stakeholderId}</strong></span>

            <span className="muted">Role:</span>
            <span><strong>{ROLE_LABELS[createdInfo.role as keyof typeof ROLE_LABELS] ?? createdInfo.role}</strong></span>

            <span className="muted">Full Name:</span>
            <span>{createdInfo.fullName}</span>

            <span className="muted">Mobile Phone:</span>
            <span>{createdInfo.phone}</span>

            <span className="muted">Temporary PIN:</span>
            <span>
              <code style={{ fontSize: 18, fontWeight: 700, background: '#fef08a', padding: '2px 8px', borderRadius: 4, letterSpacing: 2 }}>
                {createdInfo.tempPin}
              </code>
            </span>

            <span className="muted">First Login Guard:</span>
            <span style={{ color: '#E8A32C', fontWeight: 600 }}>Mandatory PIN change required on first sign-in</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <Button onClick={copyCredentials} variant="secondary">
            {copied ? '✓ Copied to Clipboard!' : 'Copy Credentials'}
          </Button>
          <Button onClick={() => nav(`/admin/users/${createdInfo.id}`)}>
            View User Details
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ maxWidth: 640 }}>
      <h2 style={{ marginTop: 0 }}>Create user</h2>
      <p className="muted small" style={{ marginTop: -6 }}>
        Workers are never created here — they self-register. The unique ID (<code>C000001</code>, <code>HW000001</code>, …)
        is generated from the selected role. The temporary PIN is required at first login and must then be changed.
      </p>
      {error && <Banner kind="danger">{error}</Banner>}
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <TextField label="Full name *" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField label="Phone number *" value={phone} inputMode="numeric" placeholder="10-digit number" onChange={(e) => setPhone(e.target.value)} />
        <Select label="Role *" value={role} onChange={(e) => setRole(e.target.value)}>
          {ADMIN_PROVISIONABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]} — ID prefix {(r === 'CONTRACTOR' ? 'C' : r === 'HEALTH_WORKER' ? 'HW' : r === 'CLINICIAN' ? 'CL' : r === 'PATHOLOGIST' ? 'P' : 'RL')}</option>
          ))}
        </Select>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="field-label">Initial temporary PIN *</span>
            <button
              type="button"
              onClick={generatePin}
              style={{ background: 'none', border: 'none', color: '#0E7C86', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
            >
              Auto-generate PIN
            </button>
          </div>
          <TextField
            type="password"
            value={tempPin}
            inputMode="numeric"
            placeholder="4–6 digits (e.g. 1234)"
            onChange={(e) => setTempPin(e.target.value)}
            error={tempPin && !pinSchema.safeParse(tempPin).success ? 'Must be 4–6 digits' : undefined}
          />
        </div>

        {role === 'CONTRACTOR' && (
          <div>
            <span className="field-label">Assign construction sites (optional; each site can have only one contractor)</span>
            <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
              {(sites.data?.items ?? []).filter((s) => s.active).map((s) => (
                <label key={s.siteId} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={siteIds.includes(s.siteId)}
                    onChange={(e) =>
                      setSiteIds(e.target.checked ? [...siteIds, s.siteId] : siteIds.filter((x) => x !== s.siteId))}
                  />
                  <span><b>{s.name}</b> · <code style={{ fontSize: 12 }}>{s.siteId}</code></span>
                </label>
              ))}
              {sites.data?.items.filter((s) => s.active).length === 0 && (
                <p className="muted small" style={{ margin: 0 }}>No active sites yet.</p>
              )}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create user'}</Button>
          <Button variant="secondary" onClick={() => nav(-1)} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}
