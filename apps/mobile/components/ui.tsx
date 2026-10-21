import React, { ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  StyleProp,
  TextInputProps,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export const colors = {
  bg: '#f4f4f5',
  surface: '#ffffff',
  surfaceSubtle: '#fafafa',
  surfaceActive: '#f4f4f5',
  border: '#e4e4e7',
  borderStrong: '#a1a1aa',
  text: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#71717a',
  textInverse: '#ffffff',
  primary: '#18181b',
  primaryHover: '#27272a',
  // Single restrained blue accent for primary actions, active nav, links,
  // focus states and progress indicators (design standard: monochrome + blue).
  accent: '#1d4ed8',
  accentHover: '#1e40af',
  accentBg: '#eff6ff',
  accentBorder: '#bfdbfe',
  danger: '#991b1b',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  warning: '#854d0e',
  warningBg: '#fefce8',
  warningBorder: '#fef08a',
  success: '#166534',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
  disabledBg: '#d4d4d8',
  disabledText: '#71717a',
}

interface ButtonProps {
  children: ReactNode
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  style,
}: ButtonProps) {
  const isClickable = !disabled && !loading

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!isClickable}
      onPress={onPress}
      style={({ pressed }) => [
        s.btnBase,
        s[`btn_${variant}`],
        s[`btnSize_${size}`],
        fullWidth && s.btnFullWidth,
        (!isClickable || pressed) && s[`btnPressed_${variant}`],
        disabled && s.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#ffffff' : '#18181b'}
        />
      ) : typeof children === 'string' || typeof children === 'number' || (Array.isArray(children) && children.every(c => typeof c === 'string' || typeof c === 'number')) ? (
        <Text
          style={[
            s.btnTextBase,
            s[`btnText_${variant}`],
            s[`btnTextSize_${size}`],
            disabled && s.btnTextDisabled,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

interface FieldProps extends TextInputProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  containerStyle?: ViewStyle
  /** Registers this field under a validation-error key so the form shell can
   * scroll it into view when validation fails (and when it gains focus). */
  errorKey?: string
}

export function Field({
  label,
  error,
  hint,
  required = false,
  containerStyle,
  errorKey,
  style,
  ...props
}: FieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<View>(null)
  const scrollApi = useContext(FormScrollContext)

  // Expose the container for scroll-to-first-error.
  useEffect(() => {
    if (!errorKey || !scrollApi) return
    return scrollApi.registerField(errorKey, containerRef.current)
  }, [errorKey, scrollApi])

  const revealOnFocus = () => {
    setIsFocused(true)
    if (scrollApi && containerRef.current) scrollApi.revealNode(containerRef.current)
  }

  return (
    <View ref={containerRef} style={[s.fieldContainer, containerStyle]} collapsable={false}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>
          {label}
          {required && <Text style={s.fieldRequired}> *</Text>}
        </Text>
      </View>
      <TextInput
        style={[
          s.fieldInput,
          isFocused && s.fieldInputFocused,
          error ? s.fieldInputError : null,
          props.multiline && s.fieldInputMultiline,
          props.editable === false && s.fieldInputDisabled,
          style,
        ]}
        placeholderTextColor="#a1a1aa"
        onFocus={(e) => {
          revealOnFocus()
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setIsFocused(false)
          props.onBlur?.(e)
        }}
        {...props}
      />
      {error ? (
        <Text style={s.fieldErrorText}>{error}</Text>
      ) : hint ? (
        <Text style={s.fieldHintText}>{hint}</Text>
      ) : null}
    </View>
  )
}

interface CardProps {
  children: ReactNode
  title?: string
  subtitle?: string
  badge?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function Card({ children, title, subtitle, badge, style }: CardProps) {
  return (
    <View style={[s.card, style]}>
      {(title || subtitle || badge) && (
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            {title && <Text style={s.cardTitle}>{title}</Text>}
            {subtitle && <Text style={s.cardSubtitle}>{subtitle}</Text>}
          </View>
          {badge && <View style={s.cardBadgeContainer}>{badge}</View>}
        </View>
      )}
      {children}
    </View>
  )
}

export interface ChipOption<T = string> {
  label: string
  value: T
  caption?: string
}

interface ChipPickerProps<T = string> {
  label?: string
  options: ChipOption<T>[]
  value: T
  onChange: (val: T) => void
  error?: string
  hint?: string
  disabled?: boolean
  horizontal?: boolean
  /** Validation-error key for scroll-into-view registration. */
  errorKey?: string
}

export function ChipPicker<T extends string = string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  horizontal = true,
  errorKey,
}: ChipPickerProps<T>) {
  const containerRef = useRef<View>(null)
  const scrollApi = useContext(FormScrollContext)

  useEffect(() => {
    if (!errorKey || !scrollApi) return
    return scrollApi.registerField(errorKey, containerRef.current)
  }, [errorKey, scrollApi])

  return (
    <View ref={containerRef} style={s.fieldContainer} collapsable={false}>
      {label && <Text style={s.fieldLabel}>{label}</Text>}
      <View style={[s.chipContainer, !horizontal && s.chipContainerVertical]}>
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => [
                s.chip,
                isSelected ? s.chipSelected : s.chipUnselected,
                disabled && s.chipDisabled,
                pressed && !disabled && s.chipPressed,
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  isSelected ? s.chipTextSelected : s.chipTextUnselected,
                  disabled && s.chipTextDisabled,
                ]}
              >
                {opt.label}
              </Text>
              {opt.caption && (
                <Text
                  style={[
                    s.chipCaption,
                    isSelected ? s.chipCaptionSelected : s.chipCaptionUnselected,
                  ]}
                >
                  {opt.caption}
                </Text>
              )}
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text style={s.fieldErrorText}>{error}</Text>
      ) : hint ? (
        <Text style={s.fieldHintText}>{hint}</Text>
      ) : null}
    </View>
  )
}

interface MultiChipPickerProps<T = string> {
  label?: string
  options: ChipOption<T>[]
  values: T[]
  onToggle: (val: T) => void
  error?: string
  hint?: string
  disabled?: boolean
  horizontal?: boolean
  /** Validation-error key for scroll-into-view registration. */
  errorKey?: string
}

export function MultiChipPicker<T extends string = string>({
  label,
  options,
  values,
  onToggle,
  error,
  hint,
  disabled = false,
  horizontal = true,
  errorKey,
}: MultiChipPickerProps<T>) {
  const containerRef = useRef<View>(null)
  const scrollApi = useContext(FormScrollContext)

  useEffect(() => {
    if (!errorKey || !scrollApi) return
    return scrollApi.registerField(errorKey, containerRef.current)
  }, [errorKey, scrollApi])

  return (
    <View ref={containerRef} style={s.fieldContainer} collapsable={false}>
      {label && <Text style={s.fieldLabel}>{label}</Text>}
      <View style={[s.chipContainer, !horizontal && s.chipContainerVertical]}>
        {options.map((opt) => {
          const isSelected = values.includes(opt.value)
          return (
            <Pressable
              key={opt.value}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onToggle(opt.value)}
              style={({ pressed }) => [
                s.chip,
                isSelected ? s.chipSelected : s.chipUnselected,
                disabled && s.chipDisabled,
                pressed && !disabled && s.chipPressed,
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  isSelected ? s.chipTextSelected : s.chipTextUnselected,
                  disabled && s.chipTextDisabled,
                ]}
              >
                {isSelected ? '✓ ' : ''}{opt.label}
              </Text>
              {opt.caption && (
                <Text
                  style={[
                    s.chipCaption,
                    isSelected ? s.chipCaptionSelected : s.chipCaptionUnselected,
                  ]}
                >
                  {opt.caption}
                </Text>
              )}
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text style={s.fieldErrorText}>{error}</Text>
      ) : hint ? (
        <Text style={s.fieldHintText}>{hint}</Text>
      ) : null}
    </View>
  )
}


interface StatusBadgeProps {
  label: string
  variant?: 'neutral' | 'success' | 'danger' | 'warning' | 'inverse'
  style?: StyleProp<ViewStyle>
}

export function StatusBadge({ label, variant = 'neutral', style }: StatusBadgeProps) {
  return (
    <View style={[s.badge, s[`badge_${variant}`], style]}>
      <Text style={[s.badgeText, s[`badgeText_${variant}`]]}>{label}</Text>
    </View>
  )
}

interface NoticeBannerProps {
  type?: 'info' | 'warning' | 'error' | 'offline'
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

export function NoticeBanner({
  type = 'info',
  title,
  message,
  actionLabel,
  onAction,
  style,
}: NoticeBannerProps) {
  const isDanger = type === 'error'
  const isWarning = type === 'warning' || type === 'offline'

  const containerStyle = isDanger
    ? s.noticeDanger
    : isWarning
      ? s.noticeWarning
      : s.noticeInfo

  const textStyle = isDanger
    ? s.noticeDangerText
    : isWarning
      ? s.noticeWarningText
      : s.noticeInfoText

  return (
    <View style={[s.noticeBase, containerStyle, style]}>
      {title && <Text style={[s.noticeTitle, textStyle]}>{title}</Text>}
      <Text style={[s.noticeMessage, textStyle]}>{message}</Text>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={s.noticeActionBtn}
        >
          <Text style={[s.noticeActionText, textStyle]}>{actionLabel} →</Text>
        </Pressable>
      )}
    </View>
  )
}

interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  labels?: string[]
}

export function StepIndicator({
  currentStep,
  totalSteps,
  labels,
}: StepIndicatorProps) {
  return (
    <View style={s.stepContainer}>
      <View style={s.stepBarsRow}>
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNumber = idx + 1
          const isDone = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          return (
            <View
              key={idx}
              style={[
                s.stepBar,
                isDone || isCurrent ? s.stepBarActive : s.stepBarInactive,
              ]}
            />
          )
        })}
      </View>
      <View style={s.stepLabelRow}>
        <Text style={s.stepCountText}>
          Step {currentStep} of {totalSteps}
        </Text>
        {labels && labels[currentStep - 1] && (
          <Text style={s.stepCurrentTitle}>{labels[currentStep - 1]}</Text>
        )}
      </View>
    </View>
  )
}

interface EmptyStateProps {
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyStateTitle}>{title}</Text>
      {message && <Text style={s.emptyStateMessage}>{message}</Text>}
      {actionLabel && onAction && (
        <View style={{ marginTop: 12 }}>
          <Button variant="secondary" size="sm" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      )}
    </View>
  )
}

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <View style={s.loadingSpinner}>
      <ActivityIndicator size="large" color="#18181b" />
      {message && <Text style={s.loadingSpinnerText}>{message}</Text>}
    </View>
  )
}

/* ---------------------------------------------------------------------------
 * FormShell: keyboard-safe scrollable form container.
 *
 * - KeyboardAvoidingView pads on iOS; on Android we rely on the window
 *   resize mode (app.json android.softwareKeyboardLayoutMode: "resize"), so
 *   the scroll area and the sticky footer compress above the keyboard.
 * - The optional `footer` renders OUTSIDE the ScrollView (sticky bottom bar),
 *   keeping Previous/Next/Submit reachable even with the keyboard open.
 * - Exposes a FormScrollApi through context: focus-aware scrolling
 *   (revealNode), scroll-to-first-error (registered via errorKey props),
 *   and scrollToTop. Inputs registered with errorKey get `collapsable={false}`
 *   so they stay measurable in the native hierarchy on Android.
 * ------------------------------------------------------------------------- */

export interface FormScrollApi {
  registerField: (key: string, node: View | null) => () => void
  revealNode: (node: View | null) => void
  scrollToError: (key: string) => void
  scrollToTop: () => void
}

const FormScrollContext = createContext<FormScrollApi | null>(null)

export function useFormScroll(): FormScrollApi | null {
  return useContext(FormScrollContext)
}

interface FormShellProps {
  children: ReactNode
  /** Sticky bottom controls (navigation/submit); rendered above the keyboard. */
  footer?: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  /** If provided, receives the FormScrollApi so a screen-level handler
   * (which sits OUTSIDE the context provider) can scroll to errors. */
  scrollApiRef?: { current: FormScrollApi | null }
}

export function FormShell({ children, footer, contentContainerStyle, style, scrollApiRef }: FormShellProps) {
  const insets = useSafeAreaInsets()
  const scrollViewRef = useRef<ScrollView>(null)
  const fieldsRef = useRef(new Map<string, View>())

  const api = useMemo<FormScrollApi>(() => ({
    registerField(key, node) {
      if (!node) return () => {}
      fieldsRef.current.set(key, node)
      return () => {
        if (fieldsRef.current.get(key) === node) fieldsRef.current.delete(key)
      }
    },
    revealNode(node) {
      const sv = scrollViewRef.current
      if (!sv || !node) return
      // Preferred: RN's ScrollResponder helper computes visibility against
      // the keyboard and scrolls only when the node would be obscured.
      const responder = (sv as any).getScrollResponder?.bind
        ? (sv as any).getScrollResponder()
        : null
      if (responder?.scrollResponderScrollNativeHandleToKeyboard) {
        try {
          responder.scrollResponderScrollNativeHandleToKeyboard(node, 90, true)
          return
        } catch {
          /* fall through to manual measurement */
        }
      }
      // Fallback: measure relative to the scroll content and scroll manually.
      const inner: any = typeof (sv as any).getInnerViewNode === 'function'
        ? (sv as any).getInnerViewNode()
        : sv
      try {
        node.measureLayout(inner, (_x, y) => {
          if (typeof y !== 'number' || y < 0) return
          sv.scrollTo({ y: Math.max(0, y - 88), animated: true })
        }, () => { /* not laid out yet */ })
      } catch {
        /* node unmounted between registration and call */
      }
    },
    scrollToError(key) {
      const node = fieldsRef.current.get(key)
      if (node) api.revealNode(node)
      else scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    },
    scrollToTop() {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    },
  }), [])

  // Publish the api to the parent screen (hook context only reaches
  // descendants, and screen-level handlers render FormShell itself).
  useEffect(() => {
    if (scrollApiRef) scrollApiRef.current = api
  }, [api, scrollApiRef])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[s.shell, style]}
    >
      <FormScrollContext.Provider value={api}>
        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[s.shellContent, { paddingBottom: (insets.bottom || 0) + 24 }, contentContainerStyle]}
        >
          {children}
        </ScrollView>
        {footer ? (
          <View style={[s.shellFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {footer}
          </View>
        ) : null}
      </FormScrollContext.Provider>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  // Button
  btnBase: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnFullWidth: {
    width: '100%',
  },
  btnSize_sm: {
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnSize_md: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  btnSize_lg: {
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  btn_primary: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnPressed_primary: {
    backgroundColor: colors.accentHover,
  },
  btn_secondary: {
    backgroundColor: '#f4f4f5',
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  btnPressed_secondary: {
    backgroundColor: '#e4e4e7',
  },
  btn_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d4d4d8',
  },
  btnPressed_outline: {
    backgroundColor: '#f4f4f5',
  },
  btn_ghost: {
    backgroundColor: 'transparent',
  },
  btnPressed_ghost: {
    backgroundColor: '#f4f4f5',
  },
  btn_danger: {
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  btnPressed_danger: {
    backgroundColor: '#7f1d1d',
  },
  btnDisabled: {
    backgroundColor: '#e4e4e7',
    borderColor: '#e4e4e7',
  },
  btnTextBase: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  btnTextSize_sm: {
    fontSize: 13,
  },
  btnTextSize_md: {
    fontSize: 15,
  },
  btnTextSize_lg: {
    fontSize: 16,
  },
  btnText_primary: {
    color: '#ffffff',
  },
  btnText_secondary: {
    color: '#18181b',
  },
  btnText_outline: {
    color: '#18181b',
  },
  btnText_ghost: {
    color: '#18181b',
  },
  btnText_danger: {
    color: '#ffffff',
  },
  btnTextDisabled: {
    color: '#a1a1aa',
  },

  // Field
  fieldContainer: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27272a',
  },
  fieldRequired: {
    color: '#b91c1c',
  },
  fieldInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d4d4d8',
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: '#18181b',
    minHeight: 46,
  },
  fieldInputFocused: {
    borderColor: '#18181b',
  },
  fieldInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fffafb',
  },
  fieldInputMultiline: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  fieldInputDisabled: {
    backgroundColor: '#f4f4f5',
    color: '#71717a',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#b91c1c',
    marginTop: 2,
  },
  fieldHintText: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181b',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  cardBadgeContainer: {
    alignSelf: 'flex-start',
  },

  // ChipPicker
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipContainerVertical: {
    flexDirection: 'column',
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  chipSelected: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  chipUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
  },
  chipDisabled: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  chipTextUnselected: {
    color: '#27272a',
  },
  chipTextDisabled: {
    color: '#a1a1aa',
  },
  chipCaption: {
    fontSize: 10,
    marginTop: 2,
  },
  chipCaptionSelected: {
    color: '#d4d4d8',
  },
  chipCaptionUnselected: {
    color: '#71717a',
  },

  // StatusBadge
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badge_neutral: {
    backgroundColor: '#f4f4f5',
    borderColor: '#e4e4e7',
  },
  badgeText_neutral: {
    color: '#3f3f46',
  },
  badge_success: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  badgeText_success: {
    color: '#166534',
  },
  badge_danger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  badgeText_danger: {
    color: '#991b1b',
  },
  badge_warning: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
  },
  badgeText_warning: {
    color: '#854d0e',
  },
  badge_inverse: {
    backgroundColor: '#18181b',
    borderColor: '#18181b',
  },
  badgeText_inverse: {
    color: '#ffffff',
  },

  // NoticeBanner
  noticeBase: {
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  noticeInfo: {
    backgroundColor: '#fafafa',
    borderColor: '#e4e4e7',
  },
  noticeInfoText: {
    color: '#3f3f46',
  },
  noticeWarning: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
  },
  noticeWarningText: {
    color: '#854d0e',
  },
  noticeDanger: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  noticeDangerText: {
    color: '#991b1b',
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  noticeMessage: {
    fontSize: 12,
    lineHeight: 18,
  },
  noticeActionBtn: {
    marginTop: 4,
  },
  noticeActionText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // StepIndicator
  stepContainer: {
    gap: 8,
    marginVertical: 4,
  },
  stepBarsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepBarActive: {
    backgroundColor: colors.accent,
  },
  stepBarInactive: {
    backgroundColor: '#e4e4e7',
  },
  stepLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  stepCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepCurrentTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181b',
  },

  // EmptyState
  // LoadingSpinner
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  loadingSpinnerText: {
    fontSize: 14,
    color: '#71717a',
  },
  // FormShell
  shell: {
    flex: 1,
    backgroundColor: '#f4f4f5',
  },
  shellContent: {
    padding: 18,
    paddingTop: 16,
    gap: 16,
  },
  shellFooter: {
    paddingTop: 10,
    paddingHorizontal: 18,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
    gap: 10,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#18181b',
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 13,
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 18,
  },

  // LoadingSpinner
  loadingContainer: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#71717a',
  },
})

// Keep backward-compatible styles export
export const styles = s
