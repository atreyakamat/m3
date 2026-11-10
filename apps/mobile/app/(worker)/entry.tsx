/**
 * EntryInGoaScreen — Master Implementation.
 *
 * Implements Section 8 requirements:
 * The screen contains ONLY the following:
 * 1. "Where are you coming from?" (Origin state & town selection)
 * 2. "Current Location" (Capture Device Location action & state)
 * 3. "Submit" button (Standardised Submit label)
 *
 * Important rules:
 * - Completely remove "Why are you coming to Goa?"
 * - No reason or purpose field
 * - No manual date
 * - No manually entered current-location details
 * - No unnecessary travel fields
 * - Automatic background timestamp
 * - Teal accent theme (#0D9488)
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

export default function EntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  // Origin details ("Where are you coming from?")
  const [originState, setOriginState] = useState<IndianState>('Bihar');
  const [originTown, setOriginTown] = useState('');

  // Current Location
  const [location, setLocation] = useState<CapturedLocation | null>(null);

  // UI state
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedConfirmed, setSubmittedConfirmed] = useState(false);

  const filteredStates = INDIAN_STATES.filter((st) =>
    st.toLowerCase().includes(stateSearch.toLowerCase().trim())
  );

  async function submitEntry() {
    if (!originTown.trim()) {
      Alert.alert('Origin Required', 'Please enter your origin town or city.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const payload = {
      arrivalDate: timestamp.slice(0, 10),
      originState,
      originTown: originTown.trim(),
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

      // Local storage for travel history
      travelLocalRepo.createRecord(
        {
          planningTravel: false,
          departureDate: null,
          returnDate: payload.arrivalDate,
          destination: `Arrived in Goa from ${originTown.trim()}, ${originState}`,
          state: originState,
          hadFeverOrMalaria: false,
          treatmentGiven: false,
          completedCourse: false,
          treatmentPlace: null,
        },
        token ? 'SYNCED' : 'PENDING'
      );

      setSubmittedConfirmed(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not record entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedConfirmed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <WorkerHeader
          title="Entry in Goa"
          subtitle="Arrival Recorded"
          showBack={true}
          fallbackRoute="/(worker)/dashboard"
        />
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={[styles.successIconCircle, { backgroundColor: '#F0FDFA', borderColor: '#0D9488' }]}>
              <Text style={{ fontSize: 40 }}>🛬</Text>
            </View>
            <Text style={styles.successTitle}>Entry in Goa Recorded ✓</Text>
            <Text style={styles.successSubtitle}>
              Your arrival from <Text style={{ fontWeight: '700' }}>{originTown}, {originState}</Text> has been successfully saved.
            </Text>

            {location && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Captured Location: </Text>
                  <Text style={styles.summaryVal}>{location.formattedText}</Text>
                </Text>
              </View>
            )}

            <Button
              label="Back to Dashboard"
              onPress={() => router.replace('/(worker)/dashboard')}
              variant="primary"
              style={{ minHeight: 50, width: '100%', backgroundColor: '#0D9488', marginTop: spacing.md }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Entry in Goa"
        subtitle="Arrival Report"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Entry in Goa. Enter the place you are travelling from, capture your device location, and tap Submit."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🛬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Arrival in Goa</Text>
            <Text style={styles.bannerText}>
              Report where you are travelling from to keep surveillance records up to date.
            </Text>
          </View>
        </View>

        {/* Section 1: Where are you coming from? */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Where are you coming from? *</Text>
          <Text style={styles.cardSubtitle}>
            Select or enter the place you are travelling from
          </Text>

          {/* State Picker Button */}
          <Text style={styles.fieldLabel}>Origin State *</Text>
          <Pressable onPress={() => setStateModalVisible(true)} style={styles.stateSelectButton}>
            <Text style={styles.stateSelectText}>🇮🇳 {originState}</Text>
            <Text style={styles.changeBadge}>Change State ▼</Text>
          </Pressable>

          {/* Town / City Field */}
          <TextField
            label="Origin Town / City *"
            placeholder="e.g. Howrah, Muzaffarpur, Gorakhpur, Ganjam..."
            value={originTown}
            onChangeText={setOriginTown}
          />
        </Card>

        {/* Section 2: Current Location */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Current Location</Text>
          <Text style={styles.cardSubtitle}>
            Capture your current device coordinates upon arrival
          </Text>
          <LocationCaptureCard
            location={location}
            onLocationCaptured={setLocation}
            accentColor="#0D9488" // Teal
            title="Current Location"
            buttonLabel="Capture Device Location"
          />
        </Card>

        {/* Submit Button — Standardised Submit label */}
        <View style={styles.submitSection}>
          <Pressable
            onPress={submitEntry}
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
              <Text style={styles.modalTitle}>Select Origin State</Text>
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
                    setOriginState(st);
                    setStateModalVisible(false);
                  }}
                  style={[
                    styles.stateItem,
                    originState === st && styles.stateItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stateItemText,
                      originState === st && styles.stateItemTextActive,
                    ]}
                  >
                    {st}
                  </Text>
                  {originState === st && <Text style={{ color: '#0D9488', fontWeight: 'bold' }}>✓</Text>}
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
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
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
    color: '#0D9488',
  },
  submitSection: {
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: '#0D9488', // Teal
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
    backgroundColor: '#F0FDFA',
    borderRadius: radius.md,
  },
  stateItemText: {
    fontSize: fontSize.sm,
    color: '#334155',
  },
  stateItemTextActive: {
    fontWeight: '700',
    color: '#0D9488',
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
    borderColor: '#99F6E4',
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
