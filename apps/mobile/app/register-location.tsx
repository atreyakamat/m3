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
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import { useSession } from '@/store/session';

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
        {/* Top Bar with Audio Guidance */}
        <View style={styles.topBar}>
          <AudioGuidanceButton
            text="Registration Complete. Tap Capture device location to record your registration GPS coordinates, then tap SUBMIT to enter your dashboard."
            size="small"
          />
        </View>

        {/* Title matching Slide 2 */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Registration Complete</Text>
        </View>

        {/* Card 1: Capture Device Location matching Slide 2 */}
        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            location && styles.actionCardSuccess,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleCapture}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Capture device location"
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardIcon}>◎</Text>
            <Text style={styles.cardActionText}>Capture device location</Text>
            {loading && <ActivityIndicator color="#008B8B" style={{ marginLeft: 8 }} />}
          </View>

          <Text style={styles.cardSubtext}>
            Allow location access to record the worker's registration location.
          </Text>

          {location && (
            <View style={styles.capturedBadge}>
              <Text style={styles.capturedBadgeText}>
                ✓ {location.formattedText || 'Coordinates Captured Successfully'}
              </Text>
            </View>
          )}

          {error && (
            <Text style={styles.errorText}>
              ⚠️ {error}
            </Text>
          )}
        </Pressable>

        {/* Card 2: Info Box matching Slide 2 */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoText}>
            Location is captured after account registration.
          </Text>
        </View>

        {/* Submit Button matching Slide 2 (Teal #008B8B) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="SUBMIT"
        >
          <Text style={styles.submitButtonText}>SUBMIT</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  headerBlock: {
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: -0.5,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardSuccess: {
    borderColor: '#008B8B',
    backgroundColor: '#F0FDFA',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 20,
    color: '#008B8B',
    marginRight: 10,
    fontWeight: '700',
  },
  cardActionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#008B8B',
  },
  cardSubtext: {
    fontSize: 14,
    color: '#707E88',
    marginTop: 10,
    lineHeight: 20,
  },
  capturedBadge: {
    backgroundColor: '#CCFBF1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  capturedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F766E',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 10,
  },
  infoBanner: {
    backgroundColor: '#E0F5F1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    color: '#008B8B',
    fontWeight: '500',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#008B8B',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
