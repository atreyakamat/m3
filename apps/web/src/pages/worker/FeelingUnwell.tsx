import { useState } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Banner, TextArea } from '../../components/ui';
import { palette, radius } from '../../lib/tokens';

const SYMPTOMS = [
  { value: 'fever', label: 'Fever' },
  { value: 'chills', label: 'Chills / shivering' },
  { value: 'headache', label: 'Headache' },
  { value: 'sweating', label: 'Sweating' },
  { value: 'body_ache', label: 'Body ache' },
  { value: 'nausea_vomiting', label: 'Nausea / vomiting' },
  { value: 'weakness_fatigue', label: 'Weakness / fatigue' },
];

export function FeelingUnwell() {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (v: string) => setSelected((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  async function submit() {
    setError(null);
    try {
      await api.post('/records/me/symptom-reports', { symptoms: selected, note: note || undefined });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (done)
    return (
      <Card accent={palette.success}>
        <h2>Report submitted</h2>
        <Banner kind="info">A symptom report is not a diagnosis and does not change your official malaria status. A health worker will follow up if needed.</Banner>
        <Button style={{ marginTop: 12 }} variant="secondary" onClick={() => { setDone(false); setSelected([]); setNote(''); }}>Submit another</Button>
      </Card>
    );

  return (
    <div className="stack">
      <Card accent={palette.accent}>
        <h2>Feeling unwell?</h2>
        <p className="muted small">Tap any symptoms you have. This helps the health team — it is not a diagnosis.</p>
        {error && <Banner kind="danger">{error}</Banner>}
        <div className="row" style={{ marginTop: 8 }}>
          {SYMPTOMS.map((s) => {
            const on = selected.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggle(s.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: radius.pill ?? 999,
                  border: `1px solid ${on ? palette.accent : palette.border}`,
                  background: on ? palette.accentSoft : palette.surface,
                  color: on ? '#B23A2E' : palette.text,
                  fontWeight: 600,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <TextArea label="Anything else? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button style={{ marginTop: 12 }} disabled={selected.length === 0 && !note} onClick={submit}>Submit report</Button>
      </Card>
    </div>
  );
}
