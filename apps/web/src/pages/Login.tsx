import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { staffLoginSchema } from '@m3/shared';
import { useAuth, type AuthUser } from '../lib/authContext';
import { palette, roleGradient } from '../lib/tokens';
import { Button, Card, TextField, Banner } from '../components/ui';
import { homeFor } from '../lib/routes';

export function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { loginStaff } = useAuth();
  const [error, setError] = useState<string | null>(
    (location.state as { error?: string } | null)?.error || null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const locErr = (location.state as { error?: string } | null)?.error;
    if (locErr) {
      setError(locErr);
    }
  }, [location.state]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const go = (user: AuthUser) => nav(homeFor(user.role), { replace: true });

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const parsed = staffLoginSchema.safeParse({ username, password });
      if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
      go(await loginStaff(username, password));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: roleGradient('ADMIN'), color: '#fff', padding: '48px 16px 36px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>M3 Malaria Surveillance</h1>
        <p style={{ opacity: 0.9, margin: '6px 0 0' }}>Restricted-distribution staff portal</p>
      </div>
      <div className="container" style={{ marginTop: -24, maxWidth: 440 }}>
        <Card>
          <h2 style={{ fontSize: 20, margin: '0 0 16px', textAlign: 'center', color: palette.text }}>
            Staff Sign In
          </h2>

          {error && (
            <div style={{ marginBottom: 16 }}>
              <Banner kind="danger">{error}</Banner>
            </div>
          )}

          <div className="stack">
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username or registered phone"
              autoFocus
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password or PIN"
            />
            <Button block onClick={submit} disabled={busy}>
              {busy ? 'Please wait…' : 'Sign in'}
            </Button>
          </div>
        </Card>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 16 }}>
          Staff portal only (Admin, Health Worker, Clinician, Lab Tech, Research Lab). Worker and Contractor accounts must use the M3 mobile app.
        </p>
      </div>
    </div>
  );
}
