/** Notifications card for the web console overview.
 *  Uses the authenticated inbox endpoint only (GET /api/v1/notifications,
 *  POST /api/v1/notifications/read). The server scopes items to the recipient;
 *  this panel never exposes data the API did not return for this user.
 *  Navigation follows the role's authorized nav (NAV_ACCESS): a case-linked
 *  notification only opens the Cases tab for roles that already have it. */
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Skeleton, EmptyState } from "../ui/components";
import { NAV_ACCESS, type NavSection } from "../lib/roles";
import { useSession } from "../lib/session";

type NotificationItem = {
  id: string;
  case_id?: string | null;
  kind?: string;
  title: string;
  body?: string;
  body_minimal?: boolean;
  created_at?: string;
  delivered_at?: string;
  read_at?: string | null;
};

export function NotificationsCard({ onGo }: { onGo: (tab: string) => void }) {
  const { session } = useSession();
  const token = session?.access_token;
  const roles = session?.user?.roles ?? [];
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const res = await api<{ items: NotificationItem[]; unread: number }>(
        "/notifications?limit=20", token);
      setItems(res.items ?? []);
      setUnread(Number(res.unread) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await api("/notifications/read", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setItems((prev) => (prev ?? []).map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // Keep the item unread; the next reload reflects server state.
    } finally {
      setBusyId(null);
    }
  }

  function openTarget(n: NotificationItem) {
    // Only navigate where the role is already authorized (server still enforces).
    const canCases = roles.some((r) => NAV_ACCESS.cases.includes(r));
    if (n.case_id && canCases) onGo("cases" as NavSection);
  }

  return (
    <Card
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : undefined}
      actions={unread > 0 ? <Badge tone="warn">{unread} unread</Badge> : undefined}
    >
      {error ? (
        <div className="m3-banner tone-danger" role="alert">{error}</div>
      ) : items === null ? (
        <Skeleton lines={3} />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications" message="Nothing has been routed to you yet." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {items.map((n) => {
            const isUnread = !n.read_at;
            const canCases = roles.some((r) => NAV_ACCESS.cases.includes(r));
            const navigable = Boolean(n.case_id) && canCases;
            return (
              <li key={n.id}
                  style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: "10px 12px", borderRadius: "var(--r-md)",
                    background: isUnread ? "var(--accent-bg)" : "var(--bg-surface-2)",
                    border: `1px solid ${isUnread ? "var(--accent-border)" : "var(--border)"}`,
                  }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "var(--fs-md)" }}>{n.title}</strong>
                    {isUnread ? <Badge tone="accent" dot={false}>unread</Badge> : <Badge tone="neutral" dot={false}>read</Badge>}
                  </div>
                  {n.body ? (
                    <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)", marginTop: 4, overflowWrap: "anywhere" }}>
                      {n.body}
                    </p>
                  ) : null}
                  <span className="m3-hint">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flex: "none", flexDirection: "column", alignItems: "flex-end" }}>
                  {isUnread ? (
                    <Button variant="ghost" size="sm" loading={busyId === n.id}
                            onClick={() => void markRead(n.id)}>Mark read</Button>
                  ) : null}
                  {navigable ? (
                    <Button variant="secondary" size="sm" onClick={() => openTarget(n)}>Open cases →</Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
