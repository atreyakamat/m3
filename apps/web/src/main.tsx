/** M3 web console — application root.
 *  This replaces the previous single-file monolith: the UI is now the M3
 *  design system (ui/) + per-role screens (screens/). All endpoint paths,
 *  HTTP methods, payload shapes and query parameters are byte-identical to
 *  the previous implementation. */
import { createRoot } from "react-dom/client";
import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { api } from "./api";
import "./ui/index.css";
import { AppShell } from "./app/AppShell";
import { LoginScreen } from "./screens/LoginScreen";
import { OverviewScreen } from "./screens/OverviewScreen";
import { CasesScreen } from "./screens/CasesScreen";
import { WorkersScreen } from "./screens/WorkersScreen";
import { WorkerRecord } from "./screens/WorkerRecord";
import { SamplesScreen } from "./screens/SamplesScreen";
import { FollowUpsScreen } from "./screens/FollowUpsScreen";
import { SitesScreen } from "./screens/SitesScreen";
import { ResearchScreen } from "./screens/ResearchScreen";
import { AuditScreen } from "./screens/AuditScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SlideFollowupModal } from "./screens/modals";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { Banner, Button, Page, ToastProvider, useToast } from "./ui/components";
import { SessionProvider, useSession } from "./lib/session";
import { hasWriteRole, isPathologist, type NavSection } from "./lib/roles";
import type {
  AuditEventItem, CaseItem, DashboardPayload, DiagnosticSampleItem, FollowUpItem,
  PagePayload, ResearchResultItem, SiteItem, WorkerListItem,
} from "./types";

const SYNTHETIC_NOTICE: Record<"en" | "hi", string> = {
  en: "Synthetic Demonstration Dataset — Not for unvalidated point-of-care deployment.",
  hi: "सिंथेटिक डेमो डेटा — केवल परीक्षण और मूल्यांकन के लिए।",
};

/* ------------------------------------------------------------ error boundary */
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", maxWidth: 640, margin: "4rem auto", fontFamily: "var(--font-sans)", textAlign: "center", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-md)" }}>
          <h2 style={{ color: "var(--danger)", marginBottom: "1rem" }}>Something went wrong</h2>
          <p style={{ color: "var(--text-2)", marginBottom: "1.5rem", lineHeight: 1.5, overflowWrap: "anywhere" }}>
            An unexpected error occurred in the surveillance console:
            <br /><code style={{ background: "var(--bg-surface-2)", padding: "0.2rem 0.4rem", borderRadius: 4, fontSize: "0.875rem" }}>
              {this.state.error?.message || "Unknown error"}
            </code>
          </p>
          <Button onClick={() => window.location.reload()}>Reload console</Button>
        </div>);
    }
    return this.props.children;
  }
}

/* ---------------------------------------------------------------- console */
function Console() {
  const { session } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<NavSection>("overview");
  const [language, setLanguage] = useState<"en" | "hi">("en");

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [cases, setCases] = useState<PagePayload<CaseItem> | null>(null);
  const [workers, setWorkers] = useState<PagePayload<WorkerListItem> | null>(null);
  const [samples, setSamples] = useState<PagePayload<DiagnosticSampleItem> | null>(null);
  const [followups, setFollowups] = useState<PagePayload<FollowUpItem> | null>(null);
  const [sites, setSites] = useState<SiteItem[] | null>(null);
  const [research, setResearch] = useState<ResearchResultItem[] | null>(null);
  const [audit, setAudit] = useState<PagePayload<AuditEventItem> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [auditFilters, setAuditFilters] = useState<{ action: string; entityType: string }>({ action: "", entityType: "" });
  const [auditOffset, setAuditOffset] = useState(0);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [slideTarget, setSlideTarget] = useState<DiagnosticSampleItem | null>(null);

  const token = session?.access_token;
  const roles = session?.user?.roles ?? [];
  const canSlide = roles.some(isPathologist);

  /* Endpoint map — identical to the previous loadData(): */
  const load = useCallback(async () => {
    if (!token) return;
    let path = "/dashboard";
    if (tab === "workers") path = `/workers?limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}`;
    else if (tab === "cases") path = "/cases?limit=50";
    else if (tab === "samples") path = "/samples?limit=50";
    else if (tab === "followups") path = "/follow-ups?limit=50";
    else if (tab === "sites") path = "/sites";
    else if (tab === "research") path = "/research-results";
    else if (tab === "analytics") return;
    else if (tab === "audit") {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("offset", String(auditOffset));
      if (auditFilters.action) params.set("action", auditFilters.action);
      if (auditFilters.entityType) params.set("entity_type", auditFilters.entityType);
      path = `/audit-events?${params.toString()}`;
    }

    setLoading(true);
    setError("");
    setRequestId(null);
    try {
      const res = await api(path, token);
      switch (tab) {
        case "cases": setCases(res as PagePayload<CaseItem>); break;
        case "workers": setWorkers(res as PagePayload<WorkerListItem>); break;
        case "samples": setSamples(res as PagePayload<DiagnosticSampleItem>); break;
        case "followups": setFollowups(res as PagePayload<FollowUpItem>); break;
        case "sites": setSites(((res as { items: SiteItem[] }).items) ?? (res as unknown as SiteItem[])); break;
        case "research": setResearch(((res as { items: ResearchResultItem[] }).items) ?? (res as unknown as ResearchResultItem[])); break;
        case "audit": setAudit(res as PagePayload<AuditEventItem>); break;
        default: setDashboard(res as DashboardPayload); break;
      }
    } catch (e) {
      const anyErr = e as { requestId?: string | null };
      setError(e instanceof Error ? e.message : "Failed to fetch data");
      setRequestId(anyErr?.requestId ?? null);
    } finally {
      setLoading(false);
    }
  }, [token, tab, query, auditFilters.action, auditFilters.entityType, auditOffset]);

  useEffect(() => { void load(); }, [load]);

  function go(next: string) {
    // Returning to a tab invalidates its last payload so fresh data loads.
    const t = next as NavSection;
    if (t === "cases") setCases(null);
    if (t === "workers") { setWorkers(null); }
    if (t === "samples") setSamples(null);
    if (t === "followups") setFollowups(null);
    if (t === "audit") setAudit(null);
    if (t !== "workers") setQuery("");
    setTab(t);
  }

  if (!session) {
    return <LoginScreen language={language} onToggleLanguage={() => setLanguage(language === "en" ? "hi" : "en")} />;
  }

  return (
    <>
      {selectedWorkerId ? (
        <div className="m3-overlay" style={{ placeItems: "stretch end" }}>
          <WorkerRecord workerId={selectedWorkerId} onClose={() => { setSelectedWorkerId(null); void load(); }}
            onRefresh={load} />
        </div>
      ) : null}
      {slideTarget && token ? (
        <SlideFollowupModal sampleId={slideTarget.id} sampleCode={slideTarget.sample_code} token={token}
          onClose={() => setSlideTarget(null)}
          onSuccess={() => { setSlideTarget(null); toast("Slide follow-up recorded", "ok"); void load(); }} />
      ) : null}

      <AppShell tab={tab} setTab={go} language={language}
        onToggleLanguage={() => setLanguage(language === "en" ? "hi" : "en")}
        loading={loading} onRefresh={load}>
        <Page>
          <Banner tone="neutral">{SYNTHETIC_NOTICE[language]}</Banner>
        </Page>

        {tab === "overview" ? (
          <OverviewScreen data={dashboard} dataKey={tab} loading={loading} error={error}
            requestId={requestId} onRetry={load} onGo={go} />
        ) : tab === "analytics" ? (
          token ? <Page><AnalyticsDashboard token={token} roles={roles} /></Page> : null
        ) : tab === "cases" ? (
          <CasesScreen page={cases} loading={loading} error={error} requestId={requestId}
            canAcknowledge={roles.includes("clinician") || roles.includes("admin") ||
              roles.includes("health_worker") || roles.includes("contractor") || canSlide}
            onRefresh={load} />
        ) : tab === "workers" ? (
          <WorkersScreen page={workers} loading={loading} error={error} requestId={requestId}
            onRefresh={load} query={query} onQuery={setQuery}
            onOpen={(id) => setSelectedWorkerId(id)} />
        ) : tab === "samples" ? (
          <SamplesScreen page={samples} loading={loading} error={error} requestId={requestId}
            onRefresh={load} canSlideFollowup={canSlide}
            onSlideFollowup={(s) => setSlideTarget(s)}
            onOpenPatient={(patientId) => setSelectedWorkerId(patientId)} />
        ) : tab === "followups" ? (
          <FollowUpsScreen page={followups} loading={loading} error={error} requestId={requestId}
            onRefresh={load} />
        ) : tab === "sites" ? (
          <SitesScreen items={sites} loading={loading} error={error} requestId={requestId}
            onRefresh={load} isContractor={roles.includes("contractor")} />
        ) : tab === "research" ? (
          <ResearchScreen items={research} loading={loading} error={error} requestId={requestId}
            onRefresh={load} />
        ) : tab === "reports" ? (
          <ReportsScreen data={dashboard} loading={loading} error={error} requestId={requestId}
            onRetry={load} onGo={go} />
        ) : tab === "audit" ? (
          <AuditScreen page={audit} loading={loading} error={error} requestId={requestId}
            onRefresh={load} filters={auditFilters}
            onFilters={(f) => { setAuditFilters(f); setAuditOffset(0); }}
            onPaging={(offset) => setAuditOffset(offset)} />
        ) : (
          <OverviewScreen data={dashboard} dataKey={tab} loading={loading} error={error}
            requestId={requestId} onRetry={load} onGo={go} />
        )}
      </AppShell>
    </>
  );
}

/* Nothing here makes unauthorized requests: each tab only mounts when the
 * role allows it (AppShell/visibleNav), and the server independently verifies
 * every endpoint. */

const Root = () => (
  <ToastProvider>
    <SessionProvider>
      <ErrorBoundary>
        <Console />
      </ErrorBoundary>
    </SessionProvider>
  </ToastProvider>
);

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<Root />);
}
