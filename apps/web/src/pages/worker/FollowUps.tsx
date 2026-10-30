import { useState } from 'react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import type { FollowUpDto } from '../../lib/types';
import { Card, Spinner, Button, Banner, TextArea } from '../../components/ui';
import { palette, radius } from '../../lib/tokens';

const OPTIONS = ['Much better', 'Same', 'Worse'];

export function FollowUps() {
  const { data, loading, reload } = useAsync<FollowUpDto[]>(() => api.get('/records/me/follow-ups'));
  const [drafts, setDrafts] = useState<Record<string, { response: string; note: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <Spinner />;

  async function respond(id: string) {
    const d = drafts[id];
    if (!d?.response) return;
    await api.post('/records/me/follow-ups/respond', { followUpId: id, response: d.response, note: d.note || undefined });
    setMsg('Response saved.');
    await reload();
  }

  return (
    <div className="stack">
      {msg && <Banner kind="success">{msg}</Banner>}
      <Card accent={palette.info}>
        <h2>Follow-up check-ins</h2>
        <p className="muted small">A follow-up response is not a diagnostic result.</p>
      </Card>
      {(data?.length ?? 0) === 0 && <Card><p className="muted">No follow-ups right now.</p></Card>}
      {data?.map((f) => (
        <Card key={f.id}>
          <strong>{f.question}</strong>
          {f.respondedAt ? (
            <div className="muted small" style={{ marginTop: 6 }}>Answered: {f.response} ({new Date(f.respondedAt).toLocaleDateString()})</div>
          ) : (
            <>
              <div className="row" style={{ marginTop: 10 }}>
                {OPTIONS.map((o) => {
                  const on = drafts[f.id]?.response === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setDrafts((p) => ({ ...p, [f.id]: { response: o, note: p[f.id]?.note ?? '' } }))}
                      style={{ padding: '8px 14px', borderRadius: radius.pill ?? 999, border: `1px solid ${on ? palette.info : palette.border}`, background: on ? palette.infoSoft : palette.surface, fontWeight: 600 }}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10 }}>
                <TextArea label="Note (optional)" value={drafts[f.id]?.note ?? ''} onChange={(e) => setDrafts((p) => ({ ...p, [f.id]: { response: p[f.id]?.response ?? '', note: e.target.value } }))} />
              </div>
              <Button style={{ marginTop: 10 }} disabled={!drafts[f.id]?.response} onClick={() => respond(f.id)}>Submit response</Button>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
