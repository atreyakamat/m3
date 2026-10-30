import type { QuestionField, QuestionSection } from '@m3/shared';
import { palette, radius } from '../lib/tokens';
import { TextField, TextArea, Select } from './ui';

interface Props {
  sections: QuestionSection[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  missingFieldIds?: string[];
}

function visible(field: QuestionField, values: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  return values[field.showIf.field] === field.showIf.equals;
}

export function QuestionnaireRenderer({ sections, values, onChange, missingFieldIds = [] }: Props) {
  return (
    <div className="stack">
      {sections.map((section) => (
        <section key={section.id}>
          <h3 style={{ color: palette.primaryDark }}>{section.title}</h3>
          <div className="stack">
            {section.fields.filter((f) => visible(f, values)).map((field) => (
              <Field
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(v) => onChange(field.id, v)}
                missing={missingFieldIds.includes(field.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  missing,
}: {
  field: QuestionField;
  value: unknown;
  onChange: (v: unknown) => void;
  missing: boolean;
}) {
  const label = `${field.label}${field.required ? ' *' : ''}${field.unit ? ` (${field.unit})` : ''}`;
  const err = missing ? 'Required' : undefined;

  switch (field.type) {
    case 'text':
      return <TextField label={label} value={(value as string) ?? ''} error={err} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea':
      return <TextArea label={label} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
    case 'temperature':
      return (
        <TextField
          label={label}
          type="number"
          value={(value as string) ?? ''}
          error={err}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return <TextField label={label} type="date" value={(value as string) ?? ''} error={err} onChange={(e) => onChange(e.target.value)} />;
    case 'boolean':
    case 'tristate':
    case 'single':
      return (
        <div>
          <span className="field-label">{label}</span>
          <div className="row" role="radiogroup" aria-label={field.label}>
            {(field.options ?? []).map((opt) => {
              const selected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(opt.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: radius.pill ?? 999,
                    border: `1px solid ${selected ? palette.primary : palette.border}`,
                    background: selected ? palette.primarySoft : palette.surface,
                    color: selected ? palette.primaryDark : palette.text,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {err && <span style={{ color: palette.danger, fontSize: 13 }}>{err}</span>}
        </div>
      );
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <span className="field-label">{label}</span>
          <div className="row">
            {(field.options ?? []).map((opt) => {
              const selected = arr.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange(selected ? arr.filter((v) => v !== opt.value) : [...arr, opt.value])}
                  style={{
                    padding: '8px 14px',
                    borderRadius: radius.pill ?? 999,
                    border: `1px solid ${selected ? palette.primary : palette.border}`,
                    background: selected ? palette.primarySoft : palette.surface,
                    color: selected ? palette.primaryDark : palette.text,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    default:
      return (
        <Select label={label} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
        </Select>
      );
  }
}
