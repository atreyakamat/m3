/** M3 application shell — branding, role-aware navigation, honest
 *  connectivity badge, responsive sidebar. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge, Button, IconButton } from "../ui/components";
import { useApiState } from "../lib/online";
import { useSession } from "../lib/session";
import { roleLabel, visibleNav, type NavSection } from "../lib/roles";

const NAV_TITLES: Array<[NavSection, string, string]> = [
  ["overview", "Overview", "सारांश"],
  ["analytics", "Surveillance Analytics", "निगरानी विश्लेषण"],
  ["cases", "Case Queue", "केस कतार"],
  ["workers", "Workers", "मज़दूर"],
  ["samples", "Diagnostics & Pathology", "निदान व पैथॉलॉजी"],
  ["followups", "Follow-ups", "फ़ॉलो-अप"],
  ["sites", "Construction Sites", "निर्माण स्थल"],
  ["research", "Research Results", "शोध परिणाम"],
  ["reports", "Surveillance Reports", "निगरानी रिपोर्ट"],
  ["audit", "Audit Trail", "ऑडिट लॉग"],
];

const FOOT: Record<"en" | "hi", { refresh: string; signOut: string; lang: string; online: string; offline: string; unreachable: string; checking: string; offlineFull: string; console: string }> = {
  en: {
    refresh: "Refresh", signOut: "Sign Out", lang: "हिन्दी में देखें",
    online: "Online · API connected", offline: "Offline",
    unreachable: "API unreachable", checking: "Checking API…",
    offlineFull: "You appear to be offline. Data may be stale — press Refresh when reconnected.",
    console: "Authorized surveillance console",
  },
  hi: {
    refresh: "ताज़ा करें", signOut: "साइन आउट", lang: "Switch to English",
    online: "ऑनलाइन · API जुड़ा", offline: "ऑफ़लाइन",
    unreachable: "API उपलब्ध नहीं", checking: "जांच हो रही है…",
    offlineFull: "आप ऑफ़लाइन प्रतीत होते हैं। डेटा पुराना हो सकता है — कनेक्ट होने पर ताज़ा करें।",
    console: "अधिकृत निगरानी कंसोल",
  },
};

/** Presentation-only role/scope context line, per server policy wording. */
function scopeHint(roles: string[]): string | null {
  if (roles.length === 1 && roles[0] === "health_worker") return "Field Health Worker — read-only view";
  if (roles.length === 1 && roles[0] === "research_lab") return "Research Lab — de-identified view";
  if (roles.includes("admin")) return "Administrator — audit review & read-only";
  if (roles.length === 1 && roles[0] === "contractor") return "Contractor — your assigned sites only";
  if (roles.length === 1 && roles[0] === "worker") return "Worker — use the M3 mobile app for intake & symptoms";
  return null;
}

function navTitle(section: NavSection, lang: "en" | "hi"): string {
  const row = NAV_TITLES.find(([id]) => id === section)!;
  return lang === "en" ? row[1] : row[2];
}

export function AppShell({ tab, setTab, language, onToggleLanguage, loading, onRefresh, children }:
  {
    tab: NavSection; setTab: (t: NavSection) => void;
    language: "en" | "hi"; onToggleLanguage: () => void;
    loading: boolean; onRefresh: () => void; children: ReactNode;
  }) {
  const { session, signOut } = useSession();
  const { connected, browserOnline, apiState } = useApiState();
  const [menuOpen, setMenuOpen] = useState(false);
  const f = FOOT[language];

  const roles = session?.user?.roles ?? [];
  const nav = useMemo(() => visibleNav(roles), [roles.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the active tab disappears for the current role, fall back to overview.
  useEffect(() => {
    if (session && !nav.includes(tab)) setTab("overview");
  }, [session, nav.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMenuOpen(false); }, [tab]);

  const page: NavSection = nav.includes(tab) ? tab : "overview";

  const connBadge = !browserOnline
    ? <Badge tone="warn" dot={false}>{f.offline}</Badge>
    : apiState === "checking"
      ? <Badge tone="neutral" dot={false}>{f.checking}</Badge>
      : connected
        ? <Badge tone="ok" dot={false}>{f.online}</Badge>
        : <Badge tone="danger" dot={false}>{f.unreachable}</Badge>;

  return (
    <div className="m3-app">
      {menuOpen && <div className="m3-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside className={["m3-sidebar", menuOpen ? "open" : ""].join(" ")} aria-label="Console navigation">
        <div className="m3-brand">
          <span className="m3-brand-mark" aria-hidden="true">M3</span>
          <div>
            <div className="m3-brand-name">M3 Surveillance</div>
            <div className="m3-brand-sub">Malaria Elimination · Goa</div>
          </div>
        </div>
        <nav className="m3-nav">
          {nav.map((id) => (
            <button key={id} type="button" className="m3-nav-link"
              aria-current={page === id ? "page" : undefined}
              onClick={() => { setTab(id); setMenuOpen(false); }}>
              <span className="m3-nav-dot" aria-hidden="true" />
              {navTitle(id, language)}
            </button>))}
        </nav>
        <div className="m3-sidebar-foot">
          {session ? (
            <div style={{ padding: "4px 12px 0" }}>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 700, color: "#fff", overflowWrap: "anywhere" }}>{session.user.display_name}</div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--n-400)", overflowWrap: "anywhere" }}>
                {session.user.roles.map(roleLabel).join(" · ")}
              </div>
              {scopeHint(session.user.roles) ? (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--brand-300)", marginTop: 4 }}>{scopeHint(session.user.roles)}</div>) : null}
            </div>
          ) : null}
          <button type="button" className="m3-nav-link" onClick={onToggleLanguage}>
            <span className="m3-nav-dot" style={{ background: "var(--n-600)" }} aria-hidden="true" />
            {f.lang}
          </button>
          <button type="button" className="m3-nav-link" onClick={() => { void signOut(); }}>
            <span className="m3-nav-dot" style={{ background: "var(--danger)" }} aria-hidden="true" />
            {f.signOut}
          </button>
        </div>
      </aside>

      <div className="m3-main">
        <header className="m3-topbar">
          <IconButton label="Open menu" className="mobile-only" onClick={() => setMenuOpen(true)}>
            <span aria-hidden="true">☰</span>
          </IconButton>
          <div style={{ minWidth: 0 }}>
            <div className="m3-topbar-title" style={{ overflowWrap: "anywhere" }}>{navTitle(page, language)}</div>
            <div className="m3-hint">{f.console}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
              {loading ? "…" : f.refresh}
            </Button>
            {connBadge}
          </div>
        </header>
        {browserOnline ? null : (
          <div className="m3-page" style={{ paddingBottom: 0 }}>
            <Badge tone="warn" dot={false}>{f.offlineFull}</Badge>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
