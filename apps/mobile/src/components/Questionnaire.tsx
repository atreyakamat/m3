import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  WORKER_SCREENING_SECTIONS,
  type QuestionField,
  type QuestionSection,
} from '@m3/shared';
import { TextField } from './ui';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

export type Answers = Record<string, unknown>;

function visible(field: QuestionField, answers: Answers): boolean {
  if (!field.showIf) return true;
  return answers[field.showIf.field] === field.showIf.equals;
}

function Options({
  field,
  value,
  onChange,
  multi,
}: {
  field: QuestionField;
  value: unknown;
  onChange: (v: unknown) => void;
  multi?: boolean;
}) {
  const selected = multi ? ((value as string[]) ?? []) : value;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {(field.options ?? []).map((opt) => {
        const isOn = multi ? (selected as string[]).includes(opt.value) : selected === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (multi) {
                const arr = new Set(selected as string[]);
                isOn ? arr.delete(opt.value) : arr.add(opt.value);
                onChange(Array.from(arr));
              } else {
                onChange(opt.value);
              }
            }}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: isOn ? palette.primary : palette.border,
              backgroundColor: isOn ? palette.primarySoft : palette.surface,
            }}
          >
            <Text style={{ color: isOn ? palette.primaryDark : palette.text, fontWeight: isOn ? '600' : '400' }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({
  field,
  value,
  onChange,
  invalid,
}: {
  field: QuestionField;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid?: boolean;
}) {
  const label = `${field.label}${field.required ? ' *' : ''}`;
  switch (field.type) {
    case 'text':
    case 'textarea':
      return (
        <TextField
          label={label}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          multiline={field.type === 'textarea'}
          error={invalid ? 'Required' : undefined}
        />
      );
    case 'number':
    case 'temperature':
      return (
        <TextField
          label={`${label}${field.unit ? ` (${field.unit})` : ''}`}
          value={value != null ? String(value) : ''}
          onChangeText={(t) => onChange(t)}
          keyboardType="numeric"
          error={invalid ? 'Required' : undefined}
        />
      );
    case 'date':
      return (
        <TextField
          label={label}
          placeholder="YYYY-MM-DD"
          value={(value as string) ?? ''}
          onChangeText={onChange}
          error={invalid ? 'Required' : undefined}
        />
      );
    case 'multi':
      return (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={labelStyle}>{label}</Text>
          <Options field={field} value={value} onChange={onChange} multi />
        </View>
      );
    default: // boolean | tristate | single
      return (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={labelStyle}>{label}</Text>
          <Options field={field} value={value} onChange={onChange} />
          {invalid ? <Text style={{ color: palette.danger, fontSize: fontSize.xs, marginTop: 4 }}>Required</Text> : null}
        </View>
      );
  }
}

const labelStyle = {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.medium as '500',
  color: palette.textMuted,
  marginBottom: spacing.sm,
};

export function Questionnaire({
  answers,
  onChange,
  missingFieldIds = [],
  sections = WORKER_SCREENING_SECTIONS,
}: {
  answers: Answers;
  onChange: (id: string, value: unknown) => void;
  missingFieldIds?: string[];
  sections?: QuestionSection[];
}) {
  return (
    <View>
      {sections.map((section) => (
        <View key={section.id} style={{ marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.md }}>
            {section.title}
          </Text>
          {section.fields.filter((f) => visible(f, answers)).map((field) => (
            <Field
              key={field.id}
              field={field}
              value={answers[field.id]}
              onChange={(v) => onChange(field.id, v)}
              invalid={missingFieldIds.includes(field.id)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
