import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminPasswordSchema, pinSchema } from '@m3/shared';
import { useAuth } from '../lib/authContext';
import { Button, Card, TextField, Banner } from '../components/ui';

/**
 * Mandatory first-login credential change (spec §8).
 * Reached automatically after the first successful staff login when the
 * account still holds a temporary credential set by Admin.
 */
export function FirstLogin() {
  const nav = useNavigate();
  const { user, changeCredential } = useAuth();
  const [value, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const rules = useMemo(() => {
    return isAdmin
      ? {
          label: 'New password',
          hint: 'At least 8 characters with an uppercase letter, a lowercase letter and a digit.',
          validate: (v: string) => {
            const r = adminPasswordSchema.safeParse(v);
            return r.success ? null : r.error.issues[0]!.message;
          },
        }
      : {
          label: 'New PIN',
          hint: '4–6 digits.',
          validate: (v: string) => {
            const r = pinSchema.safeParse(v);
            return r.success ? null : r.error.issues[0]!.message;
          },
        };
  }, [isAdmin]);

  async function submit() {
    setError(null);
    const v = rules.validate(value);
    if (v) { setError(v); return; }
    if (value !== confirm) { setError('The two entries do not match'); return; }
    setBusy(true);
    try {
      const updated = await changeCredential(value, confirm);
      const dest = updated.role === 'ADMIN' ? '/admin' : updated.role === 'CONTRACTOR' ? '/contractor' : '/portal';
      nav(dest, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 64 }}>
      <div className="container" style={{ maxWidth: 460 }}>
        <Card accent={isAdmin ? '#475569' : '#0E7C86'}>
          <h2 style={{ margin: '0 0 6px' }}>First-time setup</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {isAdmin
              ? 'Your account was set up with temporary credentials. Set a new password to continue.'
              : 'Your account was created with a temporary PIN. Set your own PIN to continue.'}
          </p>
          {error && <div style={{ marginBottom: 12 }}><Banner kind="danger">{error}</Banner></div>}
          <div className="stack" style={{ marginTop: 14 }}>
            <TextField
              label={rules.label}
              type="password"
              value={value}
              inputMode={isAdmin ? undefined : 'numeric'}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="muted small" style={{ margin: '-6px 0 0' }}>{rules.hint}</p>
            <TextField
              label={`Confirm ${rules.label.toLowerCase()}`}
              type="password"
              value={confirm}
              inputMode={isAdmin ? undefined : 'numeric'}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button block onClick={submit} disabled={busy || !value || !confirm}>
              {busy ? 'Saving…' : 'Save and continue'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
