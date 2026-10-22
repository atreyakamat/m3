/**
 * Calendar date picker field for the M3 form system (teal/slate design system).
 *
 * Tap the field to open a month-grid calendar modal. Dates are entered by
 * picker, never by primary typing; boundaries (minISO/maxISO) are enforced in
 * the grid itself, and boundaries are computed at runtime by src/dateFields.ts.
 * All dates are local-calendar strings (YYYY-MM-DD) — no UTC parsing, so the
 * displayed date cannot shift across timezones.
 *
 * Works in Expo Go on Android and on web with no extra native dependency.
 */
import React, { useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native'
import { colors } from '@/components/ui'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface ViewYM {
  year: number
  month: number
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function splitISO(iso: string): ViewYM | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1 }
}

export interface CalendarDatePickerFieldProps {
  label: string
  /** Current value 'YYYY-MM-DD' or ''. */
  value: string
  onChange: (iso: string) => void
  /** Field-level validation error message. */
  error?: string
  hint?: string
  required?: boolean
  /** Show a clear action inside the modal for optional dates. */
  optional?: boolean
  /** Validation-error key for scroll-to-first-error registration (testID). */
  errorKey?: string
  containerStyle?: ViewStyle
  /** Minimum selectable date (inclusive), 'YYYY-MM-DD'. */
  minISO?: string
  /** Maximum selectable date (inclusive), 'YYYY-MM-DD'. */
  maxISO?: string
}

export function CalendarDatePickerField(props: CalendarDatePickerFieldProps) {
  const {
    label, value, onChange, error, hint, required = false,
    optional = false, errorKey, containerStyle, minISO, maxISO,
  } = props

  const [open, setOpen] = useState(false)
  const [yearPicker, setYearPicker] = useState(false)

  const todayISO = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  const [view, setView] = useState<ViewYM>({ year: new Date().getFullYear(), month: new Date().getMonth() })

  const openPicker = () => {
    // Reset the visible month to the current value, or clamp to a boundary so
    // reopening never shows a dead month.
    const fromValue = splitISO(value)
    const fromMin = splitISO(minISO ?? '')
    const fromMax = splitISO(maxISO ?? '')
    setView(fromValue ?? fromMin ?? fromMax ?? {
      year: new Date().getFullYear(),
      month: new Date().getMonth(),
    })
    setYearPicker(false)
    setOpen(true)
  }

  const isError = Boolean(error)

  const shiftMonth = (delta: number) => {
    setView((prev) => {
      let m = prev.month + delta
      let y = prev.year
      if (m < 0) { m = 11; y -= 1 }
      if (m > 11) { m = 0; y += 1 }
      return { month: m, year: y }
    })
  }

  /** Returns the ISO string when `day` is selectable in the view month, else null. */
  const selectableISO = (day: number): string | null => {
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    if (day > daysInMonth) return null
    const iso = `${view.year}-${pad(view.month + 1)}-${pad(day)}`
    if (minISO && iso < minISO) return null
    if (maxISO && iso > maxISO) return null
    return iso
  }

  const grid = useMemo(() => {
    const firstWeekday = new Date(view.year, view.month, 1).getDay() // 0=Sunday, local
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
    const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [view.year, view.month])

  const years = useMemo(() => {
    const minY = minISO ? splitISO(minISO)?.year : undefined
    const maxY = maxISO ? splitISO(maxISO)?.year : undefined
    const start = minY ?? view.year
    const end = maxY ?? Math.max(view.year, start)
    const list: number[] = []
    for (let y = end; y >= Math.min(start, end); y--) list.push(y)
    return list
  }, [minISO, maxISO, view.year, view.month])

  return (
    <View style={[pickerS.container, containerStyle]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={[pickerS.label, isError && pickerS.labelError]}>{label}</Text>
          {required && (
            <Text style={pickerS.required} accessibilityLabel="required">
              {' '}*
            </Text>
          )}
        </View>
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value || 'no date selected'}, tap to open the calendar`}
          accessibilityValue={{ text: value }}
          testID={errorKey ? `date-field-${errorKey}` : undefined}
          onPress={openPicker}
          style={[pickerS.tapField, isError && pickerS.tapFieldError]}
        >
          <Text
            style={[pickerS.valueText, !value && pickerS.placeholderText]}
            maxFontSizeMultiplier={1.4}
          >
            {value || 'YYYY-MM-DD'}
          </Text>
          <Text style={pickerS.icon}>📅</Text>
        </Pressable>
        {isError ? (
          <Text style={pickerS.errorText} maxFontSizeMultiplier={1.4}>
            {error}
          </Text>
        ) : hint ? (
          <Text style={pickerS.hintText}>{hint}</Text>
        ) : null}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={pickerS.sheetWrap}>
          <Pressable
            style={pickerS.backdrop}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close date picker"
          />
          <View style={pickerS.sheet}>
            <View style={pickerS.sheetHeader}>
              <Text style={pickerS.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={pickerS.closeText}>Close</Text>
              </Pressable>
            </View>

            {/* Month navigation; tap the month title to pick a year. */}
            <View style={pickerS.monthRow}>
              <Pressable
                style={pickerS.navButton}
                accessibilityLabel="Previous month"
                onPress={() => shiftMonth(-1)}
              >
                <Text style={pickerS.navText}>‹</Text>
              </Pressable>
              <Pressable
                style={pickerS.monthLabel}
                accessibilityLabel="Change year"
                onPress={() => setYearPicker(!yearPicker)}
              >
                <Text style={pickerS.monthTitle}>
                  {MONTH_NAMES[view.month]} {view.year}
                  {yearPicker ? ' ▴' : ''}
                </Text>
              </Pressable>
              <Pressable
                style={pickerS.navButton}
                accessibilityLabel="Next month"
                onPress={() => shiftMonth(1)}
              >
                <Text style={pickerS.navText}>›</Text>
              </Pressable>
            </View>

            {yearPicker ? (
              <ScrollView style={pickerS.yearGrid} contentContainerStyle={pickerS.yearGridContent}>
                {years.map((y) => (
                  <Pressable
                    key={y}
                    style={[pickerS.yearItem, y === view.year && pickerS.yearItemSelected]}
                    onPress={() => { setView((prev) => ({ ...prev, year: y })); setYearPicker(false) }}
                  >
                    <Text style={[pickerS.yearItemText, y === view.year && pickerS.yearItemTextSelected]}>
                      {String(y)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={pickerS.calendarBox}>
                <View style={pickerS.weekRow}>
                  {WEEKDAY_LABELS.map((w) => (
                    <View key={w} style={pickerS.dayCell}>
                      <Text style={pickerS.weekday}>{w}</Text>
                    </View>
                  ))}
                </View>
                <View style={pickerS.daysGrid}>
                  {grid.map((day, i) => {
                    if (day === null) return <View key={`blank-${i}`} style={pickerS.dayCell} />
                    const isoValue = selectableISO(day)
                    const disabled = !isoValue
                    const selected = isoValue ? isoValue === value : false
                    const isToday = isoValue ? isoValue === todayISO : false
                    return (
                      <Pressable
                        key={day}
                        disabled={disabled}
                        onPress={() => {
                          if (!isoValue) return
                          onChange(isoValue)
                          setOpen(false)
                        }}
                        style={[
                          pickerS.dayCell,
                          selected && pickerS.daySelected,
                          isToday && !selected && pickerS.dayTodayOutline,
                          disabled && pickerS.dayDisabled,
                        ]}
                        accessibilityState={{ disabled, selected }}
                        accessibilityLabel={`Select ${view.year}-${pad(view.month + 1)}-${pad(day)}`}
                      >
                        <Text
                          style={[
                            pickerS.dayText,
                            selected && pickerS.dayTextSelected,
                            disabled && pickerS.dayTextDisabled,
                          ]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )}

            <View style={pickerS.sheetFooter}>
              {optional && (
                <Pressable onPress={() => { onChange(''); setOpen(false) }} style={pickerS.clearBtn}>
                  <Text style={pickerS.clearBtnText}>Clear date</Text>
                </Pressable>
              )}
              {minISO || maxISO ? (
                <Text style={pickerS.rangeNote}>
                  Allowed: {[minISO, maxISO].filter(Boolean).join(' → ')}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const pickerS = StyleSheet.create({
  container: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  labelError: {
    color: colors.danger,
  },
  required: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  tapField: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  tapFieldError: {
    borderColor: colors.danger,
    borderWidth: 1.5,
  },
  valueText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  placeholderText: {
    color: '#a1a1aa',
  },
  icon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  // Modal
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  closeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    padding: 6,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.primary,
    fontWeight: '700',
  },
  monthLabel: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  calendarBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dayText: {
    fontSize: 15,
    color: colors.text,
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderRadius: 22,
  },
  dayTextSelected: {
    color: colors.textInverse,
    fontWeight: '700',
  },
  dayTodayOutline: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 22,
  },
  dayDisabled: {
    opacity: 0.25,
  },
  dayTextDisabled: {
    color: colors.disabledText,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
  },
  clearBtnText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  rangeNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  yearGrid: {
    maxHeight: 260,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  yearItem: {
    width: '25%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearItemSelected: {
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  yearItemText: {
    fontSize: 15,
    color: colors.text,
  },
  yearItemTextSelected: {
    color: colors.textInverse,
    fontWeight: '700',
  },
})

export default CalendarDatePickerField
