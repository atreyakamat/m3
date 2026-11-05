import type { CSSProperties, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { palette, radius } from '../lib/tokens';

export function Card({ children, style, accent }: { children: ReactNode; style?: CSSProperties; accent?: string }) {
  return (
    <div
      style={{
        background: palette.surface,
        borderRadius: radius.lg,
        boxShadow: '0 2px 8px rgba(14,34,43,0.12)',
        padding: 18,
        borderTop: accent ? `4px solid ${accent}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  tint?: string;
  block?: boolean;
};
export function Button({ variant = 'primary', tint, block, style, children, ...rest }: ButtonProps) {
  const palettes: Record<string, CSSProperties> = {
    primary: { background: tint ?? palette.primary, color: '#fff', border: '1px solid transparent' },
    secondary: { background: palette.surface, color: palette.text, border: `1px solid ${palette.border}` },
    danger: { background: palette.danger, color: '#fff', border: '1px solid transparent' },
    ghost: { background: 'transparent', color: tint ?? palette.primary, border: '1px solid transparent' },
  };
  return (
    <button
      {...rest}
      style={{
        padding: '11px 18px',
        borderRadius: radius.md,
        fontWeight: 600,
        fontSize: 15,
        width: block ? '100%' : undefined,
        opacity: rest.disabled ? 0.55 : 1,
        ...palettes[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Chip({ fg, bg, children }: { fg: string; bg: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: radius.pill ?? 999,
        background: bg,
        color: fg,
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          maxWidth: 540,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: palette.textMuted,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TextField({
  label,
  error,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span className="field-label">{label}</span>}
      <input
        {...rest}
        style={{
          width: '100%',
          padding: '11px 12px',
          borderRadius: radius.md,
          border: `1px solid ${error ? palette.danger : palette.border}`,
          background: palette.surface,
          color: palette.text,
          ...rest.style,
        }}
      />
      {error && <span style={{ color: palette.danger, fontSize: 13 }}>{error}</span>}
    </label>
  );
}

export function TextArea({ label, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span className="field-label">{label}</span>}
      <textarea
        {...rest}
        style={{
          width: '100%',
          padding: '11px 12px',
          borderRadius: radius.md,
          border: `1px solid ${palette.border}`,
          minHeight: 80,
          resize: 'vertical',
          ...rest.style,
        }}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span className="field-label">{label}</span>}
      <select
        {...rest}
        style={{
          width: '100%',
          padding: '11px 12px',
          borderRadius: radius.md,
          border: `1px solid ${palette.border}`,
          background: palette.surface,
          color: palette.text,
          ...rest.style,
        }}
      >
        {children}
      </select>
    </label>
  );
}

export function Banner({ kind, children }: { kind: 'info' | 'warning' | 'danger' | 'success'; children: ReactNode }) {
  const map = {
    info: { bg: palette.infoSoft, fg: palette.info },
    warning: { bg: palette.warningSoft, fg: '#A5741A' },
    danger: { bg: palette.dangerSoft, fg: palette.danger },
    success: { bg: palette.successSoft, fg: palette.success },
  }[kind];
  return (
    <div style={{ background: map.bg, color: map.fg, padding: '10px 14px', borderRadius: radius.md, fontSize: 14, fontWeight: 600 }}>
      {children}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="spinner">{label}</div>;
}
