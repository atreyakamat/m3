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
import { INDIAN_STATES } from '@m3/shared';

export default function ExitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<'Work Completed' | 'Other' | null>(null);
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

  async function submitExit() {
    if (!destination.trim()) {
      Alert.alert('Destination Required', 'Please enter where you are going.');
      return;
    }
    if (!reason) {
      Alert.alert('Reason Required', 'Please select a departure reason: Work Completed or Other.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const resolvedState = INDIAN_STATES.find(
      (s) => destination.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(destination.toLowerCase())
    ) || 'Jharkhand';

    const payload = {
      departureDate,
      destinationState: resolvedState,
      destinationTown: destination.trim(),
      reason,
      purpose: reason,
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
          await travelApi.leave(token, {
            destinationState: payload.destinationState,
            destinationTown: payload.destinationTown,
            departureDate: payload.departureDate,
            reason: payload.reason,
            purpose: payload.purpose,
          });
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'travel_leaving',
              localId: payload.idempotencyKey,
              payload,
            });
          } else {
            throw err;
          }
        }
      }

      Alert.alert(
        'Departure Reported',
        'Your departure from Goa has been recorded.',
        [{ text: 'OK', onPress: () => router.replace('/(worker)/dashboard') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not record departure. Please try again.');
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
            text="Exit from Goa. Enter where you are going, your departure date, tap Capture device location, and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title matching Slide 4 */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Exit from Goa</Text>
        </View>

        {/* Section 1: WHERE ARE YOU GOING? */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>WHERE ARE YOU GOING?</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Select / enter destination"
              placeholderTextColor="#94A3B8"
              value={destination}
              onChangeText={setDestination}
              accessibilityLabel="Where are you going?"
            />
          </View>
        </View>

        {/* Section 2: DEPARTURE DATE */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>DEPARTURE DATE</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Select / enter date"
              placeholderTextColor="#94A3B8"
              value={departureDate}
              onChangeText={setDepartureDate}
              accessibilityLabel="Departure date"
            />
          </View>
        </View>

        {/* Section 3: REASON FOR DEPARTURE */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>REASON FOR DEPARTURE</Text>
          <View style={styles.reasonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.reasonChip,
                reason === 'Work Completed' && styles.reasonChipSelected,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setReason('Work Completed')}
              accessibilityRole="button"
              accessibilityLabel="Reason: Work Completed"
            >
              <View style={[styles.radioCircle, reason === 'Work Completed' && styles.radioCircleSelected]}>
                {reason === 'Work Completed' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.reasonText, reason === 'Work Completed' && styles.reasonTextSelected]}>
                Work Completed
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.reasonChip,
                reason === 'Other' && styles.reasonChipSelected,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setReason('Other')}
              accessibilityRole="button"
              accessibilityLabel="Reason: Other"
            >
              <View style={[styles.radioCircle, reason === 'Other' && styles.radioCircleSelected]}>
                {reason === 'Other' && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.reasonText, reason === 'Other' && styles.reasonTextSelected]}>
                Other
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Section 4: CURRENT LOCATION */}
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

        {/* Submit Button matching Slide 4 (Blue #3873B0) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            submitting && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={submitExit}
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
  reasonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reasonChip: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCE4E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  reasonChipSelected: {
    backgroundColor: '#E8F1FA',
    borderColor: '#3873B0',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  radioCircleSelected: {
    borderColor: '#3873B0',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3873B0',
  },
  reasonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#19364F',
    flexShrink: 1,
  },
  reasonTextSelected: {
    color: '#3873B0',
    fontWeight: '700',
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
    backgroundColor: '#3873B0',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#3873B0',
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
