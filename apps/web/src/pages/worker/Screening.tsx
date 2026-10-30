import { useEffect, useState } from 'react';
import type { QuestionSection } from '@m3/shared';
import { api, ApiError } from '../../lib/api';
import { Card, Button, Banner, Spinner } from '../../components/ui';
import { QuestionnaireRenderer } from '../../components/QuestionnaireRenderer';
import { palette } from '../../lib/tokens';

interface Meta {
  version: string;
  sections: QuestionSection[];
  consent: { statement: string; acknowledgementLabel: string };
}

export function Screening() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<string>('NOT_STARTED');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ kind: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Meta>('/meta/questionnaire'),
      api.get<{ status: string; answers: Record<string, unknown>; consentGiven: boolean } | null>('/screening/me'),
    ])
      .then(([m, s]) => {
        setMeta(m);
        if (s) {
          setValues(s.answers ?? {});
          setConsent(s.consentGiven);
          setStatus(s.status);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!meta) return <Banner kind="danger">Could not load questionnaire</Banner>;

  const complete = status === 'COMPLETE';

  async function saveDraft() {
    setBusy(true);
    setMsg(null);
    try {
      await api.put('/screening/me/draft', { answers: values, consentGiven: consent });
      setStatus('DRAFT');
      setMsg({ kind: 'info', text: 'Draft saved. You can resume later.' });
    } catch (e) {
      setMsg({ kind: 'danger', text: e instanceof Error ? e.message : 'Error' });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    setMissing([]);
    try {
      await api.post('/screening/me/complete', { answers: values, consentGiven: true });
      setStatus('COMPLETE');
      setMsg({ kind: 'success', text: 'Initial screening completed. Thank you.' });
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object' && 'missingFieldIds' in e.body) {
        setMissing((e.body as { missingFieldIds: string[] }).missingFieldIds ?? []);
      }
      setMsg({ kind: 'danger', text: e instanceof Error ? e.message : 'Error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <Card accent={palette.primary}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>Initial Screening</h2>
          <span className="muted small">{meta.version}</span>
        </div>
        {complete && <Banner kind="success">Completed — this baseline is recorded once and shown read-only.</Banner>}
      </Card>

      {msg && <Banner kind={msg.kind === 'info' ? 'info' : msg.kind}>{msg.text}</Banner>}

      <Card>
        <fieldset disabled={complete} style={{ border: 'none', padding: 0, margin: 0 }}>
          <QuestionnaireRenderer
            sections={meta.sections}
            values={values}
            missingFieldIds={missing}
            onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))}
          />
          <div style={{ marginTop: 16, padding: 14, background: palette.primarySoft, borderRadius: 12 }}>
            <strong>{meta.consent.statement}</strong>
            <label className="row" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{meta.consent.acknowledgementLabel}</span>
            </label>
          </div>
        </fieldset>
      </Card>

      {!complete && (
        <div className="row">
          <Button variant="secondary" onClick={saveDraft} disabled={busy}>Save draft</Button>
          <Button onClick={submit} disabled={busy || !consent}>Complete screening</Button>
        </div>
      )}
    </div>
  );
}
