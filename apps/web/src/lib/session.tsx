/** Session context — single owner of sign-in state.
 *  Preserves the previous contract: sessionStorage key "m3-session",
 *  same Session shape from /auth/login|signup. Adds one honest behaviour:
 *  when any API call returns 401 the session is expired — the provider
 *  clears it and exposes `expiredAt` so the shell can say "signed out —
 *  your session ended" instead of degrading into generic errors. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler } from "../api";
import { isPathologist, roleLabel } from "./roles";

export type User = {
  id: string;
  display_name: string;
  phone_e164: string;
  roles: string[];
  patient_id: string | null;
  technical_provisioner?: boolean;
};
export type Session = { access_token: string; token_type?: string; user: User };

const SESSION_KEY = "m3-session";

type SessionCtx = {
  session: Session | null;
  /** Expire time of the last auth failure (ms) or null. */
  expiredAt: number | null;
  adopt: (s: Session) => void;
  signOut: (opts?: { expired?: boolean }) => Promise<void>;
  /** convenience booleans (roles tolerated incl. legacy "pathology") */
  hasRole: (role: string) => boolean;
};

const Ctx = createContext<SessionCtx>(null as unknown as SessionCtx);

function readStored(): Session | null {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(readStored);
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }, [session]);

  const adopt = useCallback((s: Session) => {
    setSession(s);
    setExpiredAt(null);
  }, []);

  const signOut = useCallback(async (opts?: { expired?: boolean }) => {
    const s = sessionRef.current;
    if (!opts?.expired && s?.access_token) {
      // Best-effort server logout — must never block leaving.
      try { await api("/auth/logout", s.access_token, { method: "POST" }); } catch { /* leave anyway */ }
    }
    setSession(null);
    if (opts?.expired) setExpiredAt(Date.now());
  }, []);

  // 401s from any in-flight request expire the current session exactly once.
  const expiringRef = useRef(false);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (expiringRef.current) return;
      expiringRef.current = true;
      window.setTimeout(() => { expiringRef.current = false; }, 1000);
      void signOut({ expired: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<SessionCtx>(() => ({
    session,
    expiredAt,
    adopt,
    signOut,
    hasRole: (role) => !!session && session.user.roles.some((r) => r === role || (isPathologist(role) && isPathologist(r))),
  }), [session, expiredAt, adopt, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

/* ------------------------------------------------------------------ i18n
 * Kept from the previous app: en/hi label dictionary, additive.
 */
export const labels = {
  en: {
    appName: "M3 Surveillance",
    overview: "Overview",
    workers: "Workers",
    samples: "Diagnostics & Pathology",
    followups: "Follow-ups",
    sites: "Construction Sites",
    reports: "Surveillance Reports",
    auditLog: "Audit Trail",
    phone: "Phone Number",
    pin: "4-Digit PIN",
    signIn: "Sign In",
    readOnlyBadge: "Read-only",
    refresh: "Refresh",
    retry: "Retry",
    syncOnline: "Online",
    syncOffline: "Offline",
    apiConnected: "API connected",
    apiDown: "API unreachable",
  },
  hi: {
    appName: "M3 सर्वेक्षण",
    overview: "सारांश",
    workers: "मज़दूर",
    samples: "निदान व पैथॉलॉजी",
    followups: "फ़ॉलो-अप",
    sites: "निर्माण स्थल",
    reports: "निगरानी रिपोर्ट",
    auditLog: "ऑडिट लॉग",
    phone: "फ़ोन नंबर",
    pin: "4-अंकों का पिन",
    signIn: "साइन इन",
    readOnlyBadge: "केवल-पठन",
    refresh: "ताज़ा करें",
    retry: "पुनः प्रयास",
    syncOnline: "ऑनलाइन",
    syncOffline: "ऑफ़लाइन",
    apiConnected: "API जुड़ा हुआ है",
    apiDown: "API उपलब्ध नहीं",
  },
} as const;
export type Labels = (typeof labels)["en"];
export function useLabels(language: "en" | "hi"): Labels {
  return labels[language] as Labels;
}

export { roleLabel };
