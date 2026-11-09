/**
 * LocationCaptureCard — Reusable component for capturing device GPS coordinates.
 *
 * Provides:
 * - Direct capture button with loading spinner
 * - Clear captured state with latitude, longitude & timestamp
 * - Graceful permission error handling & retry
 * - Customizable theme accent color (teal, blue, red, amber)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

interface LocationCaptureCardProps {
  location: CapturedLocation | null;
  onLocationCaptured: (loc: CapturedLocation) => void;
  accentColor?: string;
  title?: string;
  buttonLabel?: string;
  required?: boolean;
}

export function LocationCaptureCard({
  location,
  onLocationCaptured,
  accentColor = palette.primary,
  title = 'Current Location',
  buttonLabel = 'Capture Device Location',
  required = false,
}: LocationCaptureCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setLoading(true);
    setError(null);
    try {
      const loc = await captureDeviceLocation();
      onLocationCaptured(loc);
    } catch (err: any) {
      setError(err?.message || 'Unable to retrieve location. Please check GPS settings and try again.');
    } finally {
      setLoading(false);
    }
  }

  const formattedTime = location
    ? new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {title} {required ? '*' : ''}
      </Text>

      {location ? (
        <View style={[styles.capturedCard, { borderColor: accentColor }]}>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>✓ Location Captured</Text>
            </View>
            <Pressable onPress={handleCapture} disabled={loading} style={styles.recaptureBtn}>
              <Text style={[styles.recaptureText, { color: accentColor }]}>🔄 Refresh</Text>
            </Pressable>
          </View>

          <Text style={styles.coordText}>📍 {location.formattedText}</Text>
          <Text style={styles.timeText}>
            Recorded: {formattedTime} {location.accuracy ? `(±${Math.round(location.accuracy)}m)` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.captureBox}>
          <Pressable
            onPress={handleCapture}
            disabled={loading}
            style={[
              styles.actionButton,
              { backgroundColor: accentColor },
              loading && styles.buttonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>📍 {buttonLabel}</Text>
            )}
          </Pressable>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
              <Pressable onPress={handleCapture} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {!error && !loading && (
            <Text style={styles.helperText}>
              Tap to capture current GPS coordinates with this submission
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A', // Dark navy
    marginBottom: spacing.xs,
  },
  capturedCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  recaptureBtn: {
    padding: 4,
  },
  recaptureText: {
    fontSize: 12,
    fontWeight: '600',
  },
  coordText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#0F172A',
    marginVertical: 4,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  captureBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  helperText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  errorBox: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    fontSize: fontSize.xs,
    color: palette.danger,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#DC2626',
    borderRadius: 4,
    marginLeft: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
