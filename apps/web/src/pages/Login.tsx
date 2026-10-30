import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginSchema, staffLoginSchema, workerRegisterSchema, LANGUAGES, LANGUAGE_LABELS } from '@m3/shared';
import { useAuth, type AuthUser } from '../lib/auth';
import { api } from '../lib/api';
import { palette, roleGradient } from '../lib/tokens';
import { Button, Card, TextField, Select, Banner } from '../components/ui';
import { homeFor } from '../routes/ProtectedRoute';

type Tab = 'worker' | 'staff';
type WorkerMode = 'signin' | 'register';

export function Login() {
  const nav = useNavigate();
  const { loginWorker, loginStaff, registerWorker } = useAuth();
  const [tab, setTab] = useState<Tab>('worker');
  const [mode, setMode] = useState<WorkerMode>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const go = (user: AuthUser) => nav(homeFor(user.role), { replace: true });

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (tab === 'staff') {
        const parsed = staffLoginSchema.safeParse({ username, password });
        if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
        go(await loginStaff(username, password));
      } else if (mode === 'signin') {
        const parsed = loginSchema.safeParse({ phone, pin });
        if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
        go(await loginWorker(phone, pin));
      } else {
        const parsed = workerRegisterSchema.safeParse({ name, phone, pin, preferredLanguage: language });
        if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
        const exists = await api.get<{ exists: boolean }>(`/auth/exists?phone=${encodeURIComponent(phone)}`);
        if (exists.exists) throw new Error('This phone is already registered — please sign in instead.');
        go(await registerWorker({ name, phone, pin, preferredLanguage: language }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: roleGradient('WORKER'), color: '#fff', padding: '48px 16px 36px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>M3 Malaria Surveillance</h1>
        <p style={{ opacity: 0.9, margin: '6px 0 0' }}>Restricted-distribution platform</p>
      </div>
      <div className="container" style={{ marginTop: -24, maxWidth: 440 }}>
        <Card>
          <div className="nav-tabs" style={{ marginBottom: 16 }}>
            <button className="nav-tab" onClick={() => setTab('worker')} style={tabStyle(tab === 'worker')}>
              Worker
            </button>
            <button className="nav-tab" onClick={() => setTab('staff')} style={tabStyle(tab === 'staff')}>
              Staff
            </button>
          </div>

          {error && <div style={{ marginBottom: 12 }}><Banner kind="danger">{error}</Banner></div>}

          <div className="stack">
            {tab === 'worker' ? (
              <>
                {mode === 'register' && (
                  <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                )}
                <TextField label="Phone number" value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" />
                <TextField label="PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4–6 digits" />
                {mode === 'register' && (
                  <Select label="Preferred language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {LANGUAGE_LABELS[l]}
                      </option>
                    ))}
                  </Select>
                )}
                <Button block onClick={submit} disabled={busy}>
                  {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Register'}
                </Button>
                <button
                  onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError(null); }}
                  style={{ background: 'none', border: 'none', color: palette.primary, fontWeight: 600 }}
                >
                  {mode === 'signin' ? 'New worker? Register' : 'Have an account? Sign in'}
                </button>
              </>
            ) : (
              <>
                <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button block onClick={submit} disabled={busy}>
                  {busy ? 'Please wait…' : 'Sign in'}
                </Button>
              </>
            )}
          </div>
        </Card>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 16 }}>
          Demo: worker 9000000001 / PIN 1234 · staff contractor.north / password123
        </p>
      </div>
    </div>
  );
}

function tabStyle(active: boolean) {
  return active
    ? { background: palette.primary, color: '#fff', borderColor: 'transparent' }
    : { background: palette.surface, color: palette.text };
}
