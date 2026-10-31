/**
 * DatePickerField — native Android date picker wrapper.
 *
 * Opens the system date picker on tap. Displays the selected date in a clear
 * local format. Stores the value as an ISO-8601 date string (YYYY-MM-DD).
 *
 * Constraints are enforced at the picker level (minimumDate / maximumDate).
 * The component never allows invalid or future dates for historical events.
 */

import React, { useState } from 'react';
import { Pressable, Text, View, Platform, Modal, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

/**
 * Format a Date object as a localised display string.
 * Use the device locale for display; always store YYYY-MM-DD internally.
 */
function formatDisplay(d: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  // Construct in local time to avoid timezone shift.
  return new Date(y, m - 1, d);
}

interface DatePickerFieldProps {
  label: string;
  value: string | undefined; // ISO date or undefined
  onChange: (iso: string) => void;
  /** Earliest selectable date. Default: 100 years ago. */
  minimumDate?: Date;
  /** Latest selectable date. Default: today. */
  maximumDate?: Date;
  error?: string;
  placeholder?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  placeholder = 'Select date',
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const minDate = minimumDate ?? new Date(today.getFullYear() - 100, 0, 1);
  const maxDate = maximumDate ?? today;

  // Current picker date: use stored value, fall back to max date for sensible default.
  const pickerDate = value ? fromIso(value) : maxDate;

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    // On Android the picker fires and closes in one event.
    setOpen(false);
    if (selected) {
      onChange(toIso(selected));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, error ? styles.fieldError : null, pressed && styles.fieldPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDisplay(fromIso(value)) : placeholder}`}
        accessibilityHint="Tap to open date picker"
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDisplay(fromIso(value)) : placeholder}
        </Text>
        <Text style={styles.calendarIcon}>📅</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={handleChange}
        />
      ) : null}

      {/* iOS: modal wrapper */}
      {open && Platform.OS === 'ios' ? (
        <Modal transparent animationType="slide" visible={open}>
          <View style={styles.iosOverlay}>
            <View style={styles.iosSheet}>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                minimumDate={minDate}
                maximumDate={maxDate}
                onChange={(e, d) => {
                  if (d) onChange(toIso(d));
                }}
                style={{ width: '100%' }}
              />
              <Pressable style={styles.iosDone} onPress={() => setOpen(false)}>
                <Text style={styles.iosDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as '500',
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    minHeight: 52,
  },
  fieldError: { borderColor: palette.danger },
  fieldPressed: { opacity: 0.8 },
  valueText: { fontSize: fontSize.md, color: palette.text },
  placeholderText: { fontSize: fontSize.md, color: palette.textMuted },
  calendarIcon: { fontSize: 18 },
  errorText: { color: palette.danger, fontSize: fontSize.xs, marginTop: spacing.xs },
  // iOS modal
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  iosDone: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  iosDoneText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold as '600',
    color: palette.primary,
  },
});
