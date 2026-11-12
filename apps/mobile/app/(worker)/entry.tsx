import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import { travelApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';

export default function EntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [place, setPlace] = useState('');
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [capturingLoc, setCapturingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleCaptureLocation() {
    setCapturingLoc(true);
    try {
      const loc = await captureDeviceLocation();
      setLocation(loc);
    } catch (err: any) {
      Alert.alert('Location Error', err?.message || 'Could not acquire GPS coordinates.');
    } finally {
      setCapturingLoc(false);
    }
  }

  async function submitEntry() {
    if (!place.trim()) {
      Alert.alert('Origin Required', 'Please enter where you are coming from.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const payload = {
      arrivalDate,
      originState: place.trim(),
      originTown: place.trim(),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      locationText: location?.formattedText ?? null,
      timestamp,
      idempotencyKey: uuid(),
    };

    try {
      if (token) {
        try {
          await travelApi.enter(token, {
            originState: payload.originState,
            hadFeverOrMalaria: false,
          });
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'travel_entering',
              localId: payload.idempotencyKey,
              payload,
            });
          } else {
            throw err;
          }
        }
      }

      Alert.alert(
        'Arrival Recorded',
        'Welcome back to Goa. Your entry has been recorded.',
        [{ text: 'OK', onPress: () => router.replace('/(worker)/dashboard') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not record arrival. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header Navigation */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Entry in Goa. Enter where you are coming from, your arrival date, tap Capture device location, and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title matching Slide 3 */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Entry in Goa</Text>
        </View>

        {/* Section 1: WHERE ARE YOU COMING FROM? */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>WHERE ARE YOU COMING FROM?</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Select / enter place"
              placeholderTextColor="#94A3B8"
              value={place}
              onChangeText={setPlace}
              accessibilityLabel="Where are you coming from?"
            />
          </View>
        </View>

        {/* Section 2: ARRIVAL DATE */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>ARRIVAL DATE</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Select / enter date"
              placeholderTextColor="#94A3B8"
              value={arrivalDate}
              onChangeText={setArrivalDate}
              accessibilityLabel="Arrival date"
            />
          </View>
        </View>

        {/* Section 3: CURRENT LOCATION */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>CURRENT LOCATION</Text>
          <Pressable
            style={({ pressed }) => [
              styles.locationCard,
              location && styles.locationCardSuccess,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleCaptureLocation}
            disabled={capturingLoc}
            accessibilityRole="button"
            accessibilityLabel="Capture device location"
          >
            <View style={styles.locRow}>
              <Text style={styles.locIcon}>◎</Text>
              <Text style={styles.locText}>
                {location ? location.formattedText || 'Location Captured' : 'Capture device location'}
              </Text>
              {capturingLoc && <ActivityIndicator color="#008B8B" style={{ marginLeft: 8 }} />}
            </View>
          </Pressable>
        </View>

        {/* Submit Button matching Slide 3 (Teal #008B8B) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            submitting && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={submitEntry}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="SUBMIT"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>SUBMIT</Text>
          )}
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3873B0',
  },
  titleBlock: {
    marginBottom: 28,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: -0.5,
  },
  fieldSection: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#707E88',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    fontSize: 16,
    color: '#23303A',
    paddingVertical: 10,
  },
  locationCard: {
    backgroundColor: '#E0F5F1',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  locationCardSuccess: {
    backgroundColor: '#CCFBF1',
    borderColor: '#008B8B',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locIcon: {
    fontSize: 18,
    color: '#008B8B',
    fontWeight: '700',
    marginRight: 10,
  },
  locText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#008B8B',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#008B8B',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#008B8B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
