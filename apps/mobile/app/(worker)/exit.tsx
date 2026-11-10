/**
 * ExitFromGoaScreen — Master Implementation.
 *
 * Implements Section 7 requirements:
 * 1. "Where are you going?" (Destination selection & input)
 * 2. "Why are you leaving Goa?" (Work Completed or Other)
 * 3. "Current Location" (Capture Device Location action & state)
 * 4. "Submit" button (Standardised Submit label)
 *
 * Important rules:
 * - No manual date fields (automatic timestamp)
 * - No manual current-location fields
 * - No unnecessary travel details
 * - No unrequested contractor fields
 * - Blue accent theme (#2563EB)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { INDIAN_STATES, type IndianState } from '@m3/shared';
import { Card, TextField, Button } from '@/components/ui';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { LocationCaptureCard } from '@/components/LocationCaptureCard';
import { type CapturedLocation } from '@/services/location';
import { travelApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { travelLocalRepo } from '@/services/travelLocal';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

const REASON_OPTIONS = [
  'Work Completed',
  'Other',
];

export default function ExitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  // 1. Where are you going?
  const [destinationState, setDestinationState] = useState<IndianState>('West Bengal');
  const [destinationTown, setDestinationTown] = useState('');

  // 2. Why are you leaving Goa?
  const [selectedReason, setSelectedReason] = useState('Work Completed');
  const [otherReason, setOtherReason] = useState('');

  // 3. Current Location
  const [location, setLocation] = useState<CapturedLocation | null>(null);

  // UI state
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedConfirmed, setSubmittedConfirmed] = useState(false);

  const filteredStates = INDIAN_STATES.filter((st) =>
    st.toLowerCase().includes(stateSearch.toLowerCase().trim())
  );

  const finalReason = selectedReason === 'Other' ? otherReason.trim() || 'Other' : selectedReason;

  async function submitExit() {
    if (!destinationTown.trim()) {
      Alert.alert('Destination Required', 'Please enter your destination town or city.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const payload = {
      departureDate: timestamp.slice(0, 10),
      destinationState,
      destinationTown: destinationTown.trim(),
      reason: finalReason,
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
            departureDate: payload.departureDate,
            reason: payload.reason,
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

      // Local storage for travel history
      travelLocalRepo.createRecord(
        {
          planningTravel: true,
          departureDate: payload.departureDate,
          returnDate: null,
          destination: `Departing Goa for ${destinationTown.trim()}, ${destinationState}`,
          state: destinationState,
          hadFeverOrMalaria: false,
          treatmentGiven: false,
          completedCourse: false,
          treatmentPlace: null,
        },
        token ? 'SYNCED' : 'PENDING'
      );

      setSubmittedConfirmed(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not record exit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedConfirmed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <WorkerHeader
          title="Exit from Goa"
          subtitle="Departure Recorded"
          showBack={true}
          fallbackRoute="/(worker)/dashboard"
        />
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={[styles.successIconCircle, { backgroundColor: '#EFF6FF', borderColor: '#2563EB' }]}>
              <Text style={{ fontSize: 40 }}>🛫</Text>
            </View>
            <Text style={styles.successTitle}>Exit from Goa Recorded ✓</Text>
            <Text style={styles.successSubtitle}>
              Your departure to <Text style={{ fontWeight: '700' }}>{destinationTown}, {destinationState}</Text> has been successfully saved.
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Destination: </Text>
                <Text style={styles.summaryVal}>{destinationTown}, {destinationState}</Text>
              </Text>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reason for Leaving: </Text>
                <Text style={styles.summaryVal}>{finalReason}</Text>
              </Text>
              {location && (
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Captured Location: </Text>
                  <Text style={styles.summaryVal}>{location.formattedText}</Text>
                </Text>
              )}
            </View>

            <Button
              label="Back to Dashboard"
              onPress={() => router.replace('/(worker)/dashboard')}
              variant="primary"
              style={{ minHeight: 50, width: '100%', backgroundColor: '#2563EB', marginTop: spacing.md }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Exit from Goa"
        subtitle="Departure Report"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Exit from Goa. Enter your destination, select reason for leaving, capture your device location, and tap Submit."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🛫</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Departure from Goa</Text>
            <Text style={styles.bannerText}>
              Report where you are travelling to ensure continuity of your malaria surveillance records.
            </Text>
          </View>
        </View>

        {/* Section 1: Where are you going? */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Where are you going? *</Text>
          <Text style={styles.cardSubtitle}>
            Select or enter your destination state and town
          </Text>

          {/* State Picker Button */}
          <Text style={styles.fieldLabel}>Destination State *</Text>
          <Pressable onPress={() => setStateModalVisible(true)} style={styles.stateSelectButton}>
            <Text style={styles.stateSelectText}>🇮🇳 {destinationState}</Text>
            <Text style={styles.changeBadge}>Change State ▼</Text>
          </Pressable>

          {/* Town / City Field */}
          <TextField
            label="Destination Town / City *"
            placeholder="e.g. Kolkata, Patna, Varanasi, Berhampur..."
            value={destinationTown}
            onChangeText={setDestinationTown}
          />
        </Card>

        {/* Section 2: Why are you leaving Goa? */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Why are you leaving Goa? *</Text>
          <Text style={styles.cardSubtitle}>
            Select an appropriate reason
          </Text>

          <View style={styles.reasonRow}>
            {REASON_OPTIONS.map((opt) => {
              const isSelected = selectedReason === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSelectedReason(opt)}
                  style={[
                    styles.reasonBtn,
                    isSelected && styles.reasonBtnActive,
                  ]}
                >
                  <Text style={[styles.reasonBtnText, isSelected && styles.reasonBtnTextActive]}>
                    {opt === 'Work Completed' ? '🏗️ Work Completed' : '📝 Other'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedReason === 'Other' && (
            <TextField
              label="Specify Reason"
              placeholder="e.g. Vacation, Family function, Medical..."
              value={otherReason}
              onChangeText={setOtherReason}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>

        {/* Section 3: Current Location */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Current Location</Text>
          <Text style={styles.cardSubtitle}>
            Capture your current device coordinates before departure
          </Text>
          <LocationCaptureCard
            location={location}
            onLocationCaptured={setLocation}
            accentColor="#2563EB" // Blue
            title="Current Location"
            buttonLabel="Capture Device Location"
          />
        </Card>

        {/* Submit Button — Standardised Submit label */}
        <View style={styles.submitSection}>
          <Pressable
            onPress={submitExit}
            disabled={submitting}
            style={[
              styles.submitButton,
              submitting && { opacity: 0.7 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* State Picker Modal (All 36 Indian States & UTs) */}
      <Modal
        visible={stateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Destination State</Text>
              <Pressable onPress={() => setStateModalVisible(false)} hitSlop={10}>
                <Text style={styles.closeBtn}>✕</Text>
              </Pressable>
            </View>

            <TextField
              label="Search Indian States & UTs"
              placeholder="Search state..."
              value={stateSearch}
              onChangeText={setStateSearch}
            />

            <ScrollView style={styles.statesList}>
              {filteredStates.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => {
                    setDestinationState(st);
                    setStateModalVisible(false);
                  }}
                  style={[
                    styles.stateItem,
                    destinationState === st && styles.stateItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stateItemText,
                      destinationState === st && styles.stateItemTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                  {destinationState === st && <Text style={{ color: '#2563EB', fontWeight: 'bold' }}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  bannerIcon: {
    fontSize: 32,
  },
  bannerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: spacing.xs,
  },
  stateSelectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  stateSelectText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0F172A',
  },
  changeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  reasonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reasonBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  reasonBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: '#334155',
  },
  reasonBtnTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
  submitSection: {
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: '#2563EB', // Blue
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadow.card,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
  },
  closeBtn: {
    fontSize: 20,
    color: palette.textMuted,
    fontWeight: 'bold',
  },
  statesList: {
    maxHeight: 400,
    marginTop: spacing.sm,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateItemActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: radius.md,
  },
  stateItemText: {
    fontSize: fontSize.sm,
    color: '#334155',
  },
  stateItemTextActive: {
    fontWeight: '700',
    color: '#2563EB',
  },
  successContainer: {
    padding: spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    ...shadow.card,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.md,
  },
  summaryRow: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 4,
  },
  summaryLabel: {
    fontWeight: '600',
    color: '#64748B',
  },
  summaryVal: {
    fontWeight: '700',
    color: '#0F172A',
  },
});
