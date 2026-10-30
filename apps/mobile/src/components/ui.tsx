import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette, radius, spacing, fontSize, fontWeight, shadow } from '@/theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.scrollContent}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, accent }: { children: React.ReactNode; style?: ViewStyle; accent?: string }) {
  return (
    <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null, style]}>
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}
export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}
export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted ? { color: palette.textMuted } : null]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary'
      ? palette.primary
      : variant === 'danger'
        ? palette.danger
        : variant === 'secondary'
          ? palette.secondary
          : 'transparent';
  const fg = variant === 'ghost' ? palette.primary : palette.textOnColor;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' ? styles.buttonGhost : null,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error ? { borderColor: palette.danger } : null]}
        placeholderTextColor={palette.textMuted}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function SelectRow({
  label,
  selected,
  onPress,
  sublabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  sublabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectRow,
        selected ? { borderColor: palette.primary, backgroundColor: palette.primarySoft } : null,
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.selectRowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.selectRowSub}>{sublabel}</Text> : null}
      </View>
      {selected ? <Text style={{ color: palette.primary, fontWeight: '700' }}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scrollContent: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold as '700', color: palette.text },
  subtitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold as '600', color: palette.text },
  body: { fontSize: fontSize.md, color: palette.text, lineHeight: 22 },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonGhost: { borderWidth: 1.5, borderColor: palette.primary },
  buttonText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold as '600' },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium as '500', color: palette.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: palette.text,
    backgroundColor: palette.surface,
  },
  errorText: { color: palette.danger, fontSize: fontSize.xs, marginTop: spacing.xs },
  chip: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, alignSelf: 'flex-start' },
  chipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold as '600' },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: palette.surface,
    marginBottom: spacing.sm,
  },
  selectRowLabel: { fontSize: fontSize.md, color: palette.text, fontWeight: fontWeight.medium as '500' },
  selectRowSub: { fontSize: fontSize.sm, color: palette.textMuted, marginTop: 2 },
});
