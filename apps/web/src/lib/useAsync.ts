import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs an async loader on mount, whenever `deps` change (compared by value)
 * and whenever `reload` is called. The loader is read through a ref so its
 * identity never re-triggers a fetch. Responses from older attempts are
 * discarded, so rapid dep changes or double fetches never race.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  // `loading` starts true and only flips once a settled response lands,
  // which keeps the initial spinner without synchronous setState in effects.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);

  // Keep the latest loader without making it part of the fetch key.
  useEffect(() => {
    fnRef.current = fn;
  });

  // Bumping `attempt` re-runs the fetch (used by `reload`).
  const [attempt, setAttempt] = useState(0);
  // Value-based key so dep changes re-run the fetch by value, not identity.
  const depsKey = deps.map((d) => (d == null ? '' : String(d))).join('\u0000');

  // Staleness stamp: a response that belongs to an older key/attempt is dropped.
  const activeRef = useRef({ key: '', attempt: -1 });

  useEffect(() => {
    const attemptId = attempt;
    const fetchKey = depsKey;
    activeRef.current = { key: fetchKey, attempt: attemptId };
    let cancelled = false;
    fnRef.current()
      .then((d) => {
        const active = !cancelled
          && activeRef.current.key === fetchKey
          && activeRef.current.attempt === attemptId;
        if (active) {
          setData(d);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        const active = !cancelled
          && activeRef.current.key === fetchKey
          && activeRef.current.attempt === attemptId;
        if (active) {
          setError(e instanceof Error ? e.message : 'Error');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, depsKey]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  return { data, loading, error, reload, setData };
}
