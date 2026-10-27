/** M3 Design System — reusable React components (web).
 *  Styling via ui/index.css classes; tokens via ui/tokens.css variables.
 *  No external UI dependency. A11y: labels, focus rings, focus traps, Esc. */
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo,
  useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes,
  type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { toneForStatus, type Tone } from "./tokens";

/* ------------------------------------------------------------------ button */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

export function Button({ variant = "primary", size = "md", block, loading, children, className, type = "button", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean; loading?: boolean }) {
  return (
    <button type={type} aria-busy={loading || undefined} disabled={rest.disabled || loading}
      className={["m3-btn", `m3-btn-${variant}`, size !== "md" ? `m3-btn-${size}` : "", block ? "m3-btn-block" : "", className].filter(Boolean).join(" ")}
      {...rest}>
      {loading ? <span className="m3-spinner" aria-hidden="true" /> : null}
      {children}
    </button>);
}

export function IconButton({ label, children, onClick, className }: {
  label: string; children: ReactNode; onClick: () => void; className?: string;
}) {
  return <button type="button" aria-label={label} title={label} onClick={onClick}
    className={["icon-btn", className].filter(Boolean).join(" ")}>{children}</button>;
}

/* ------------------------------------------------------------------ fields */
export function Field({ label, error, hint, required, children, htmlFor, id }: {
  label: ReactNode; error?: ReactNode | false; hint?: ReactNode; required?: boolean;
  children: ReactNode; htmlFor?: string; id?: string;
}) {
  return (
    <div className="m3-field" id={id}>
      <label className="m3-label" htmlFor={htmlFor}>{label}{required ? <span className="req" aria-hidden="true" /> : null}</label>
      {children}
      {error ? <span className="m3-error" role="alert">⚠ {error}</span> : hint ? <span className="m3-hint">{hint}</span> : null}
    </div>);
}

function invalidProps(error?: ReactNode | false) {
  return error ? { "aria-invalid": true as const } : {};
}
type AnyInvalid = { error?: ReactNode | false };

export function Input({ error, className, id, ...rest }: InputHTMLAttributes<HTMLInputElement> & AnyInvalid & { id?: string }) {
  return <input id={id} className={["m3-input", className].filter(Boolean).join(" ")}
    aria-describedby={error ? undefined : undefined} {...invalidProps(error)} {...rest} />;
}
export function TextArea({ error, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & AnyInvalid) {
  return <textarea className={["m3-textarea", className].filter(Boolean).join(" ")} {...invalidProps(error)} {...rest} />;
}
export function Select({ error, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & AnyInvalid) {
  return <select className={["m3-select", className].filter(Boolean).join(" ")} {...invalidProps(error)} {...rest}>{children}</select>;
}
export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="m3-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
      {hint ? <span className="m3-hint">{hint}</span> : null}
    </label>);
}

export function SearchInput({ value, onChange, placeholder, label = "Search", ...rest }:
  { value: string; onChange: (v: string) => void; placeholder?: string; label?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const id = useId();
  /** One accessible clear control whenever the field has content; the clear
   *  button is focusable and restores the unfiltered list (server re-query). */
  const clear = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange("");
    (document.getElementById(id) as HTMLInputElement | null)?.focus();
  };
  return (
    <Field label={label} htmlFor={id} hint={rest["aria-label"] ? undefined : undefined}>
      <div className="m3-search">
        <input id={id} className="m3-input" type="search" role="searchbox"
          value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} {...rest} />
        {value ? (
          <button type="button" className="m3-search-clear" aria-label="Clear search" onClick={clear}>✕</button>
        ) : null}
      </div>
    </Field>);
}

/** Segmented PillPicker (single or multi select). */
export function ChipPicker({ options, value, onChange, multi, ariaPrefix }: {
  options: Array<{ value: string; label: string; hint?: string }>; value: string | string[];
  onChange: (v: string) => void; multi?: boolean; ariaPrefix: string;
}) {
  const selected = (v: string) => (multi ? (value as string[]).includes(v) : value === v);
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={ariaPrefix}
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <button key={o.value} type="button" title={o.hint} aria-pressed={selected(o.value)}
          onClick={() => onChange(o.value)}
          className={["badge", "no-dot", selected(o.value) ? "tone-accent" : "tone-neutral"].join(" ")}
          style={{ cursor: "pointer", padding: "6px 12px", fontSize: "var(--fs-sm)" }}>
          {o.label}
        </button>))}
    </div>);
}

/* ------------------------------------------------------------ surfaces */
export function Card({ title, subtitle, actions, children, className }:
  { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={["m3-card", className].filter(Boolean).join(" ")}>
      {(title || actions || subtitle) ? (
        <header className="m3-card-head">
          <div style={{ minWidth: 0 }}>
            {title ? <h3 className="m3-card-title">{title}</h3> : null}
            {subtitle ? <p className="m3-card-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flex: "none", alignItems: "center" }}>{actions}</div> : null}
        </header>) : null}
      <div className="m3-card-body">{children}</div>
    </section>);
}

export function PageHeader({ title, subtitle, breadcrumb, actions }:
  { title: ReactNode; subtitle?: ReactNode; breadcrumb?: string; actions?: ReactNode }) {
  return (
    <header style={{ marginBottom: "var(--sp-5)", display: "flex", alignItems: "flex-start", gap: "var(--sp-4)", flexWrap: "wrap", justifyContent: "space-between" }}>
      <div style={{ minWidth: 0 }}>
        {breadcrumb ? <div className="m3-hint" style={{ marginBottom: 2 }}>{breadcrumb}</div> : null}
        <h2 style={{ fontSize: "var(--fs-3xl)", fontWeight: 800, overflowWrap: "anywhere" }}>{title}</h2>
        {subtitle ? <p style={{ color: "var(--text-2)", marginTop: 6 }}>{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{actions}</div> : null}
    </header>);
}

export function Page({ children, maxWidth }: { children: ReactNode; maxWidth?: number }) {
  return <div className="m3-page" style={maxWidth ? { maxWidth } : undefined}>{children}</div>;
}

export function Badge({ tone = "neutral", children, dot = true }:
  { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={["badge", `tone-${tone}`, dot ? "" : "no-dot"].filter(Boolean).join(" ")}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={toneForStatus(status)}>{label ?? status.replaceAll("_", " ")}</Badge>;
}

export function Tabs({ tabs, value, onChange }: {
  tabs: Array<{ id: string; label: string; badge?: ReactNode }>; value: string; onChange: (id: string) => void;
}) {
  return (
    <div className="m3-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={value === t.id}
          onClick={() => onChange(t.id)} className="m3-tab">
          {t.label}
          {t.badge != null ? <> <Badge tone="neutral" dot={false}>{t.badge}</Badge></> : null}
        </button>))}
    </div>);
}

export function Section({ title, description, children, actions }:
  { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--sp-6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ fontSize: "var(--fs-xl)", fontWeight: 700 }}>{title}</h3>
          {description ? <p style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)", marginTop: 2 }}>{description}</p> : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: 8 }}>{actions}</div> : null}
      </div>
      {children}
    </section>);
}

/* ------------------------------------------------------------ data table */
export type Column<T> = {
  key: string; label: string; align?: "left" | "right";
  render?: (row: T) => ReactNode; sub?: (row: T) => ReactNode; numeric?: boolean;
};
export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, caption, emptyState }:
  { columns: Array<Column<T>>; rows: T[]; rowKey: (row: T) => string; onRowClick?: (row: T) => void;
    loading?: boolean; caption?: string; emptyState?: ReactNode }) {
  if (loading) return <SkeletonTable />;
  if (!rows.length) return <>{emptyState ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="m3-table-wrap" tabIndex={0} role="region" aria-label={caption ?? "Data table"}>
      <table className="m3-table">
        {caption ? <caption className="m3-hint" style={{ textAlign: "left", padding: "8px 14px" }}>{caption}</caption> : null}
        <thead>
          <tr>{columns.map((c) => (
            <th key={c.key} style={{ textAlign: c.align ?? "left" }}>{c.label}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={onRowClick ? "clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRowClick(row); } } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-keyshortcuts={onRowClick ? "Enter" : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align ?? "left" }} className={c.numeric ? "m3-cell-num" : undefined}>
                  {c.render
                    ? c.render(row)
                    : <span className="m3-cell-main">{String((row as Record<string, unknown>)[c.key] ?? "—")}</span>}
                  {c.sub ? <span className="m3-cell-sub">{c.sub(row)}</span> : null}
                </td>))}
            </tr>))}
        </tbody>
      </table>
    </div>);
}

/* ------------------------------------------------------------ states */
export function EmptyState({ title, message, children }:
  { title: string; message?: string; children?: ReactNode }) {
  return (
    <div className="m3-empty" role="status">
      <div className="m3-empty-icon" aria-hidden="true">◇</div>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {children}
    </div>);
}

export function Skeleton({ lines = 3, card }: { lines?: number; card?: boolean }) {
  if (card) return <div className="m3-skel m3-skel-card" />;
  return (
    <div style={{ display: "grid", gap: 12, padding: 4 }} aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => <div key={i} className="m3-skel" style={{ width: `${88 - i * 17}%` }} />)}
    </div>);
}

function SkeletonTable() {
  return (
    <div className="m3-table-wrap" aria-busy="true" aria-label="Loading data">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
          <div className="m3-skel" style={{ width: `${75 - i * 11}%` }} />
        </div>))}
    </div>);
}

export function ErrorState({ message, onRetry, requestId }: { message: string; onRetry?: () => void; requestId?: string | null }) {
  return (
    <div className="m3-banner tone-danger" role="alert" style={{ alignItems: "center" }}>
      <div>
        <p style={{ fontWeight: 700 }}>Couldn’t load this data</p>
        <p style={{ marginTop: 2 }}>{message}</p>
        {requestId ? <p style={{ marginTop: 2, fontSize: "var(--fs-xs)", opacity: 0.85 }}>Request ID: {requestId}</p> : null}
      </div>
      {onRetry ? <div className="banner-action"><Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button></div> : null}
    </div>);
}

export function Banner({ tone = "info", children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={["m3-banner", `tone-${tone}`].join(" ")} role={tone === "danger" ? "alert" : "status"}>
      <span>{children}</span>
      {action ? <div className="banner-action">{action}</div> : null}
    </div>);
}

/** Form-section wrapper with legend-like heading — used across modals. */
export function FormGrid({ cols = 2, children }: { cols?: 1 | 2; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "var(--sp-3)", gridTemplateColumns: cols === 2 ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)", minWidth: 0 }}>
      {children}
    </div>);
}

export function Metric({ label, value, unit, tone, hint, onClick, ariaLabel }: {
  label: string; value: ReactNode; unit?: string; tone?: Tone; hint?: string;
  /** Count cards with an authorized list destination are one accessible
   *  pressable: card, value and hint are all inside a single <button>.
   *  Cards without a destination stay non-interactive divs. */
  onClick?: () => void; ariaLabel?: string;
}) {
  const body = (<>
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}{unit ? <span className="u">{unit}</span> : null}</div>
    {hint ? <div className="metric-hint">{hint}</div> : null}
  </>);
  if (!onClick) {
    return (
      <div className={["metric", tone ? `tone-${tone}` : ""].filter(Boolean).join(" ")}>
        {body}
      </div>);
  }
  return (
    <button type="button" className={["metric", "metric-clickable", tone ? `tone-${tone}` : ""].filter(Boolean).join(" ")}
      onClick={onClick} aria-label={ariaLabel ?? label}>
      {body}
      <span className="metric-open" aria-hidden="true">View list →</span>
    </button>);
}

/* ------------------------------------------------- identity / case chips */
export function Identity({ name, sub, meta }: { name: string; sub?: ReactNode; meta?: ReactNode }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
  return (
    <div className="identity">
      <span className="identity-avatar" aria-hidden="true">{initials || "?"}</span>
      <div style={{ minWidth: 0 }}>
        <div className="identity-name">{name}</div>
        {sub ? <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)", overflowWrap: "anywhere" }}>{sub}</div> : null}
        {meta ? <div className="identity-meta">{meta}</div> : null}
      </div>
    </div>);
}

/* -------------------------------------------------- dialog primitives */
export function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const prevFocus = document.activeElement as HTMLElement | null;
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const first = el?.querySelector<HTMLElement>(sel); first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key === "Tab" && el) {
        const focusables = Array.from(el.querySelectorAll<HTMLElement>(sel)).filter((n) => n.offsetParent !== null);
        if (!focusables.length) return;
        const firstEl = focusables[0]; const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prevFocus?.focus?.(); };
  }, [open, onClose]);
  return ref;
}

export function Modal({ open, title, children, footer, onClose, wide, onBack }:
  { open: boolean; title: ReactNode; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean; onBack?: () => void }) {
  const trapRef = useFocusTrap(open, onClose);
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="m3-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={["m3-modal", wide ? "wide" : ""].filter(Boolean).join(" ")} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} ref={trapRef}>
        <header className="m3-modal-head">
          <h3 style={{ fontSize: "var(--fs-xl)", minWidth: 0, overflowWrap: "anywhere" }}>{onBack && <>
            <button type="button" onClick={onBack} aria-label="Back" style={{ marginInlineStart: -6, background: "none", border: 0, cursor: "pointer", color: "var(--accent)", fontWeight: 800, marginRight: 6 }}>←</button></>}{title}</h3>
          <IconButton label="Close dialog" onClick={onClose}><span aria-hidden="true">✕</span></IconButton>
        </header>
        <div className="m3-modal-body">{children}</div>
        {footer ? <footer className="m3-modal-foot">{footer}</footer> : null}
      </div>
    </div>);
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", tone = "primary", busy, onConfirm, onCancel }:
  { open: boolean; title: string; message: ReactNode; confirmLabel?: string; tone?: Variant; busy?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={<>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant={tone} onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </>}>
      <p style={{ color: "var(--text-2)" }}>{message}</p>
    </Modal>);
}

/* -------------------------------------------------------------- toasts */
type Toast = { id: number; text: string; tone: Tone };
const ToastCtx = createContext<(text: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="m3-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={["m3-toast", t.tone === "ok" ? "tone-ok" : t.tone === "danger" ? "tone-danger" : ""].filter(Boolean).join(" ")}>
            <span>{t.text}</span>
            <button type="button" aria-label="Dismiss notification" onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}
              style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", marginLeft: "auto", fontWeight: 700 }}>✕</button>
          </div>))}
      </div>
    </ToastCtx.Provider>);
}
