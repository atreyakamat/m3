/** Real connectivity + API availability state.
 *  Replaces the previous fake "API Connected" badge with:
 *   - navigator.onLine (browser network state), and
 *   - an actual /health probe against the configured API. */
import { useEffect, useState } from "react";
import { probeApi } from "../api";
import { BREAKPOINTS } from "../ui/tokens";

export type ApiState = "checking" | "ok" | "unreachable" | "down";

export function useOnline() {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return browserOnline;
}

/** Polls /health so the badge reflects the truth (API may be up while
 *  browser DNS/routing differs — e.g. wrong server URL in a LAN session). */
export function useApiState(pollMs = 20000) {
  const [state, setState] = useState<ApiState>("checking");
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const check = async () => {
      const res = await probeApi();
      if (alive) setState(res === "ok" ? "ok" : navigator.onLine ? res : "unreachable");
      timer = window.setTimeout(check, pollMs);
    };
    check();
    return () => { alive = false; if (timer) window.clearTimeout(timer); };
  }, [pollMs]);
  const online = useOnline();
  const connected = state === "ok" && online;
  return { browserOnline: online, apiState: state, connected };
}

/** Simple media-query hook for responsive behaviour in components. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const cb = () => setMatches(mq.matches);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.mobile - 1}px)`);
}
