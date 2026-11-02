/**
 * Reusable Admin building blocks, built on the existing M3 design system
 * (ui.tsx primitives + @m3/shared tokens). Common tables, search fields,
 * filters, status chips, loading/empty/error states and confirm dialogs are
 * implemented exactly once and reused by every admin page (spec §16).
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { palette, roleColors } from '../lib/tokens';
import { Button, Card, Chip, Spinner } from './ui';

// ---- page states -----------------------------------------------------------

export function Loading() {
  return <Spinner label="Loading…" />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 8px' }}>
      <p style={{ color: palette.danger, fontWeight: 600, margin: '0 0 8px' }}>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 8px', color: palette.textMuted }}>
      <p style={{ fontWeight: 600, margin: '0 0 4px', color: palette.text }}>{title}</p>
      {hint && <p className="muted small" style={{ margin: 0 }}>{hint}</p>}
    </div>
  );
}

/** Wraps the three list states; `children` renders normally on success. */
export function ListBody({
  loading, error, empty, emptyHint, onRetry, children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyHint?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title="Nothing here yet" hint={emptyHint} />;
  return <>{children}</>;
}

// ---- data table -------------------------------------------------------------

export interface Column<T> {
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  color: palette.textMuted,
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                  borderBottom: `1px solid ${palette.border}`,
                  whiteSpace: 'nowrap',
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} style={{ borderBottom: `1px solid ${palette.border}` }}>
              {columns.map((c, i) => (
                <td key={c.header} style={{ padding: '12px 12px', verticalAlign: 'middle', color: i === 0 ? palette.text : palette.text, fontWeight: i === 0 ? 600 : 400 }}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- search & filters ---------------------------------------------------------

export function FilterRow({ children, onSearch, searchPlaceholder, search }: {
  children?: ReactNode;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  search?: string;
}) {
  const [draft, setDraft] = useState(search ?? '');
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      {onSearch && (
        <form
          style={{ flex: 1, minWidth: 220, display: 'flex', gap: 8 }}
          onSubmit={(e) => { e.preventDefault(); onSearch(draft); }}
        >
          <input
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10,
              border: `1px solid ${palette.border}`, background: palette.surface, color: palette.text,
            }}
            placeholder={searchPlaceholder ?? 'Search…'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={searchPlaceholder ?? 'Search'}
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      )}
      {children}
    </div>
  );
}

// ---- status chips ----------------------------------------------------------------

type ChipKind = 'green' | 'amber' | 'red' | 'blue' | 'grey' | 'purple';
const chipColors: Record<ChipKind, { fg: string; bg: string }> = {
  green: { fg: palette.success, bg: palette.successSoft },
  amber: { fg: '#A5741A', bg: palette.warningSoft },
  red: { fg: palette.danger, bg: palette.dangerSoft },
  blue: { fg: palette.info, bg: palette.infoSoft },
  grey: { fg: palette.textMuted, bg: palette.surfaceAlt },
  purple: { fg: '#7A4FBF', bg: '#EEE7F8' },
};

export function AdminChip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  const c = chipColors[kind];
  return <Chip fg={c.fg} bg={c.bg}>{children}</Chip>;
}

export function ActiveChip({ active }: { active: boolean }) {
  return <AdminChip kind={active ? 'green' : 'grey'}>{active ? 'Active' : 'Inactive'}</AdminChip>;
}

// ---- cards & stats ------------------------------------------------------------------

export function StatCard({ label, value, accent, to }: { label: string; value: ReactNode; accent?: string; to?: string }) {
  const content = (
    <Card accent={accent} style={{ padding: 14, cursor: to ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: palette.textMuted }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: accent ?? palette.text }}>{value}</div>
    </Card>
  );
  if (to) {
    return <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{content}</Link>;
  }
  return content;
}

export function SectionCard({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
        {actions}
      </div>
      {children}
    </Card>
  );
}

// ---- confirmation dialog implementation -----------------------------------------------

export function ConfirmDialog({
  open, title, body, tone = 'warning', confirmLabel = 'Confirm', busy, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  tone?: 'warning' | 'danger';
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, background: palette.overlay, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onCancel}
    >
      <Card style={{ maxWidth: 440, width: '100%' }}>
        <div onClick={(e) => e.stopPropagation()}>
          <h3 style={{ margin: 0, color: tone === 'danger' ? palette.danger : undefined }}>{title}</h3>
          <div style={{ margin: '10px 0 16px', color: palette.textMuted, fontSize: 14 }}>{body}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ---- role label chip --------------------------------------------------------------------

export function RoleChip({ role }: { role: string }) {
  const labels: Record<string, string> = {
    CONTRACTOR: 'Contractor',
    HEALTH_WORKER: 'Health Worker',
    CLINICIAN: 'Clinician',
    PATHOLOGIST: 'Pathologist',
    RESEARCH_LAB: 'Research Lab',
    ADMIN: 'Admin',
    WORKER: 'Worker',
  };
  const key = (role in roleColors ? role : 'ADMIN') as keyof typeof roleColors;
  const c = roleColors[key];
  return <Chip fg={c.base} bg={c.soft}>{labels[role] ?? role}</Chip>;
}
