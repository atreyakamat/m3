/**
 * RegisterLocationScreen — Post-Registration Device Location Capture Step.
 *
 * Implements Section 4 requirements:
 * - Triggered immediately after successful account creation.
 * - Requests device location permission.
 * - Captures coordinates and associates them with registration timestamp.
 * - Displays clear location-captured state.
 * - Graceful retry/fallback if permission denied or GPS unavailable.
 * - Continues to Worker Dashboard upon completion.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Card, Button } from '@/components/ui';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function RegisterLocationScreen() {
  const router = useRouter();
  const { user } = useSession();

  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCapture() {
    setLoading(true);
    setError(null);
    try {
      const loc = await captureDeviceLocation();
      setLocation(loc);

      // Save registration coordinates in local storage
      const record = {
        workerId: user?.workerId || user?.userId || 'worker',
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        timestamp: loc.timestamp,
        formattedText: loc.formattedText,
        capturedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem('m3_registration_location', JSON.stringify(record));
    } catch (err: any) {
      setError(
        err?.message || 'Location permission was denied or GPS is unavailable on this device.'
      );
    } finally {
      setLoading(false);
    }
  }

  function handleContinue() {
    router.replace('/(worker)/dashboard');
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Branding / Step Indicator */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Registration Step 2 of 2</Text>
          </View>
          <Text style={styles.title}>Capture Device Location</Text>
          <Text style={styles.subtitle}>
            Welcome, {user?.displayName || 'Worker'}! Capture your current device location to complete registration with the ICMR–NIMR Malaria Surveillance Project.
          </Text>
        </View>

        {/* Location Capture Card */}
        <Card style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={{ fontSize: 36 }}>📍</Text>
          </View>

          {location ? (
            <View style={styles.successBox}>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>✓ Location Captured Successfully</Text>
              </View>

              <Text style={styles.coordText}>{location.formattedText}</Text>
              <Text style={styles.timeText}>
                Registration Timestamp:{' '}
                {new Date(location.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </Text>

              <Pressable
                onPress={handleCapture}
                disabled={loading}
                style={styles.recaptureLink}
              >
                <Text style={styles.recaptureText}>🔄 Re-capture Location</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.promptBox}>
              <Text style={styles.promptText}>
                Device GPS coordinates are recorded only once during registration to associate your account with your worksite area.
              </Text>

              <Pressable
                onPress={handleCapture}
                disabled={loading}
                style={[styles.captureBtn, loading && styles.btnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.captureBtnText}>📍 Capture Device Location</Text>
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
            </View>
          )}
        </Card>

        {/* Bottom Actions — Standardised Submit label */}
        <View style={styles.footer}>
          <Button
            label="Submit"
            onPress={handleContinue}
            variant="primary"
            style={{ minHeight: 52 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: '#CCFBF1',
    borderColor: '#14B8A6',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  badgeText: {
    color: '#0F766E', // Teal
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A', // Dark navy
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDFA', // Light teal
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: '#0D9488',
  },
  promptBox: {
    width: '100%',
    alignItems: 'center',
  },
  promptText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  captureBtn: {
    backgroundColor: '#0D9488', // Teal accent
    width: '100%',
    minHeight: 52,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  captureBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    width: '100%',
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
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    marginLeft: 6,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  successBox: {
    width: '100%',
    alignItems: 'center',
  },
  successBadge: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  successBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  coordText: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  recaptureLink: {
    padding: 6,
  },
  recaptureText: {
    fontSize: fontSize.xs,
    color: '#0D9488',
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.xl,
  },
});
