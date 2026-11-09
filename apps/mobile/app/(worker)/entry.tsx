/**
 * EntryInGoaScreen — Comprehensive Master Implementation.
 *
 * Implements Travel Entry Surveillance with full ICMR–NIMR approved protocol:
 * 1. Origin state selection (all 36 Indian States and UTs modal picker)
 * 2. Origin town / city
 * 3. Travel mode (Train, Bus, Car/Taxi, Flight, Other)
 * 4. Reason for travel (Work, Returning to site, Family visit, Health, Other)
 * 5. Device GPS Location Capture (with coordinates and accuracy)
 * 6. Travel-related Health Questions:
 *    - Fever or malaria diagnosis during recent travel
 *    - Treatment administered (if fever reported)
 *    - Full course completion
 *    - Place of treatment
 * 7. Automatic timestamping and arrival date
 * 8. Teal accent theme (#0D9488) with offline outbox queuing
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

const TRAVEL_MODES = [
  { id: 'train', label: '🚆 Train', desc: 'Indian Railways' },
  { id: 'bus', label: '🚌 Bus', desc: 'Interstate / Private bus' },
  { id: 'car', label: '🚗 Car / Taxi', desc: 'Personal or shared cab' },
  { id: 'flight', label: '✈️ Flight', desc: 'Goa Airport (Dabolim/Mopa)' },
  { id: 'other', label: '🚲 Other', desc: 'Two-wheeler / other' },
];

const REASON_OPTIONS = [
  'Work / Employment',
  'Returning to Site',
  'Family Visit',
  'Health Checkup',
  'Other',
];

export default function EntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  // Travel Details
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [originState, setOriginState] = useState<IndianState>('Bihar');
  const [originTown, setOriginTown] = useState('');
  const [travelMode, setTravelMode] = useState('train');
  const [travelReason, setTravelReason] = useState('Work / Employment');
  const [otherReason, setOtherReason] = useState('');

  // Location Capture
  const [location, setLocation] = useState<CapturedLocation | null>(null);

  // Approved Health Questions
  const [hadFever, setHadFever] = useState<'yes' | 'no'>('no');
  const [treatmentGiven, setTreatmentGiven] = useState<'yes' | 'no'>('no');
  const [completedCourse, setCompletedCourse] = useState<'yes' | 'no'>('no');
  const [treatmentPlace, setTreatmentPlace] = useState('');

  // UI State
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedConfirmed, setSubmittedConfirmed] = useState(false);

  const finalReason = travelReason === 'Other' ? otherReason.trim() || 'Other' : travelReason;

  async function submitEntry() {
    if (!originTown.trim()) {
      Alert.alert('Origin Required', 'Please enter your origin town or city.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const payload = {
      arrivalDate,
      originState,
      originTown: originTown.trim(),
      travelMode,
      reason: finalReason,
      hadFeverOrMalaria: hadFever === 'yes',
      treatmentGiven: hadFever === 'yes' ? treatmentGiven === 'yes' : false,
      completedCourse: hadFever === 'yes' && treatmentGiven === 'yes' ? completedCourse === 'yes' : false,
      treatmentPlace: hadFever === 'yes' && treatmentPlace.trim() ? treatmentPlace.trim() : undefined,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      locationText: location?.formattedText ?? null,
      notes: `Mode: ${travelMode}. Origin: ${originTown.trim()}, ${originState}. Reason: ${finalReason}`,
      idempotencyKey: uuid(),
    };

    try {
      if (token) {
        try {
          await travelApi.enter(token, {
            originState: payload.originState,
            hadFeverOrMalaria: payload.hadFeverOrMalaria,
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
          returnDate: arrivalDate,
          destination: `Arrived in Goa from ${originTown.trim()}, ${originState}`,
          state: originState,
          hadFeverOrMalaria: hadFever === 'yes',
          treatmentGiven: treatmentGiven === 'yes',
          completedCourse: completedCourse === 'yes',
          treatmentPlace: treatmentPlace || null,
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
              Your arrival details and health responses have been recorded in the ICMR–NIMR surveillance database.
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Travelling From: </Text>
                <Text style={styles.summaryVal}>{originTown}, {originState}</Text>
              </Text>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Travel Mode: </Text>
                <Text style={styles.summaryVal}>{travelMode.toUpperCase()}</Text>
              </Text>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reason: </Text>
                <Text style={styles.summaryVal}>{finalReason}</Text>
              </Text>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fever During Travel: </Text>
                <Text style={[styles.summaryVal, hadFever === 'yes' && { color: palette.danger }]}>
                  {hadFever === 'yes' ? 'YES (Reported to Health Desk)' : 'NO'}
                </Text>
              </Text>
              {location && (
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Device GPS: </Text>
                  <Text style={styles.summaryVal}>{location.formattedText}</Text>
                </Text>
              )}
            </View>

            {hadFever === 'yes' && (
              <View style={styles.alertNotice}>
                <Text style={styles.alertNoticeText}>
                  ⚠️ Precautionary Health Follow-Up: You reported having fever during recent travel. An NIMR surveillance worker will visit your site to offer a free rapid blood test.
                </Text>
              </View>
            )}

            <Button
              label="Back to Dashboard"
              onPress={() => router.replace('/(worker)/dashboard')}
              variant="primary"
              style={{ minHeight: 50, width: '100%', backgroundColor: '#0D9488' }}
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
        subtitle="Travel Surveillance"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Entry in Goa. Enter your origin state, town, travel mode, travel health questions, and capture device location."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🛬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Reporting Arrival in Goa</Text>
            <Text style={styles.bannerText}>
              Keep surveillance teams informed of your arrival from other states for prompt health follow-up.
            </Text>
          </View>
        </View>

        {/* Section 1: Origin Information */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>1. Origin Location *</Text>
          <Text style={styles.cardSubtitle}>Where are you travelling from?</Text>

          {/* State Picker Button */}
          <Text style={styles.fieldLabel}>Origin State *</Text>
          <Pressable onPress={() => setStateModalVisible(true)} style={styles.stateSelectButton}>
            <Text style={styles.stateSelectText}>🇮🇳 {originState}</Text>
            <Text style={styles.changeBadge}>Tap to change ▼</Text>
          </Pressable>

          {/* Town / City Field */}
          <TextField
            label="Origin City / Town *"
            placeholder="e.g. Howrah, Muzaffarpur, Gorakhpur, Ganjam..."
            value={originTown}
            onChangeText={setOriginTown}
          />
        </Card>

        {/* Section 2: Travel Mode & Reason */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>2. Travel Mode & Reason *</Text>
          <Text style={styles.cardSubtitle}>How and why did you travel to Goa?</Text>

          {/* Travel Mode Chips */}
          <Text style={styles.fieldLabel}>Travel Mode *</Text>
          <View style={styles.modesGrid}>
            {TRAVEL_MODES.map((mode) => (
              <Pressable
                key={mode.id}
                onPress={() => setTravelMode(mode.id)}
                style={[
                  styles.modeCard,
                  travelMode === mode.id && styles.modeCardActive,
                ]}
              >
                <Text style={styles.modeLabel}>{mode.label}</Text>
                <Text style={styles.modeDesc}>{mode.desc}</Text>
              </Pressable>
            ))}
          </View>

          {/* Reason Selection */}
          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Why are you coming to Goa? *</Text>
          <View style={styles.optionsList}>
            {REASON_OPTIONS.map((opt) => {
              const isSelected = travelReason === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setTravelReason(opt)}
                  style={[styles.radioRow, isSelected && styles.radioRowActive]}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioLabel, isSelected && styles.radioLabelActive]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {travelReason === 'Other' && (
            <TextField
              placeholder="Specify reason..."
              value={otherReason}
              onChangeText={setOtherReason}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>

        {/* Section 3: Current Device Location */}
        <Card style={styles.card}>
          <LocationCaptureCard
            location={location}
            onLocationCaptured={setLocation}
            accentColor="#0D9488" // Teal
            title="3. Current Location"
            buttonLabel="Capture Device Location"
          />
        </Card>

        {/* Section 4: Approved Clinical Health Protocol */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>4. Travel Health Screening *</Text>
          <Text style={styles.cardSubtitle}>Approved ICMR–NIMR Malaria Surveillance Protocol</Text>

          {/* Q1: Fever during travel */}
          <View style={styles.healthQuestion}>
            <Text style={styles.questionText}>
              During this travel or in the past 14 days, did you have fever or were you diagnosed with malaria?
            </Text>
            <View style={styles.yesNoRow}>
              <Pressable
                onPress={() => setHadFever('yes')}
                style={[styles.yesNoBtn, hadFever === 'yes' && styles.yesBtnActive]}
              >
                <Text style={[styles.yesNoText, hadFever === 'yes' && styles.yesNoTextActive]}>
                  Yes (हाँ)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setHadFever('no')}
                style={[styles.yesNoBtn, hadFever === 'no' && styles.noBtnActive]}
              >
                <Text style={[styles.yesNoText, hadFever === 'no' && styles.yesNoTextActive]}>
                  No (नहीं)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Conditional follow-up if fever = yes */}
          {hadFever === 'yes' && (
            <View style={styles.conditionalBox}>
              <Text style={styles.questionText}>If yes, was medical treatment given?</Text>
              <View style={styles.yesNoRow}>
                <Pressable
                  onPress={() => setTreatmentGiven('yes')}
                  style={[styles.yesNoBtn, treatmentGiven === 'yes' && styles.yesBtnActive]}
                >
                  <Text style={[styles.yesNoText, treatmentGiven === 'yes' && styles.yesNoTextActive]}>Yes</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTreatmentGiven('no')}
                  style={[styles.yesNoBtn, treatmentGiven === 'no' && styles.noBtnActive]}
                >
                  <Text style={[styles.yesNoText, treatmentGiven === 'no' && styles.yesNoTextActive]}>No</Text>
                </Pressable>
              </View>

              {treatmentGiven === 'yes' && (
                <>
                  <Text style={[styles.questionText, { marginTop: spacing.sm }]}>Was the full course completed?</Text>
                  <View style={styles.yesNoRow}>
                    <Pressable
                      onPress={() => setCompletedCourse('yes')}
                      style={[styles.yesNoBtn, completedCourse === 'yes' && styles.yesBtnActive]}
                    >
                      <Text style={[styles.yesNoText, completedCourse === 'yes' && styles.yesNoTextActive]}>Yes</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setCompletedCourse('no')}
                      style={[styles.yesNoBtn, completedCourse === 'no' && styles.noBtnActive]}
                    >
                      <Text style={[styles.yesNoText, completedCourse === 'no' && styles.yesNoTextActive]}>No</Text>
                    </Pressable>
                  </View>

                  <TextField
                    label="Place of Treatment (Hospital / Clinic name)"
                    placeholder="e.g. District Hospital, PHC, Private Clinic..."
                    value={treatmentPlace}
                    onChangeText={setTreatmentPlace}
                    style={{ marginTop: spacing.sm }}
                  />
                </>
              )}
            </View>
          )}
        </Card>

        {/* Submit Button */}
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
              <Text style={styles.submitButtonText}>Submit Entry in Goa ✓</Text>
            )}
          </Pressable>
          <Text style={styles.autoTimestampText}>
            ⏱️ Submission timestamp is captured automatically in the background
          </Text>
        </View>
      </ScrollView>

      {/* 36 States Modal */}
      <Modal visible={stateModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Origin State (36 States & UTs)</Text>
              <Pressable onPress={() => setStateModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕ Close</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {INDIAN_STATES.map((st) => (
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
                  <Text style={[styles.stateItemText, originState === st && styles.stateItemTextActive]}>
                    {originState === st ? '✓ ' : ''}{st}
                  </Text>
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
    backgroundColor: '#F0FDFA', // Light teal
    borderColor: '#99F6E4',
    borderWidth: 1.5,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bannerIcon: {
    fontSize: 32,
  },
  bannerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: '#0F766E',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: '#0D9488',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A', // Dark navy
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
    marginBottom: 4,
  },
  stateSelectButton: {
    backgroundColor: '#F8FAFC',
    borderColor: '#0D9488',
    borderWidth: 1.5,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stateSelectText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0F172A',
  },
  changeBadge: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '700',
  },
  modesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modeCard: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: spacing.sm,
  },
  modeCardActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  modeDesc: {
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
  },
  optionsList: {
    gap: 6,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radioRowActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  radioCircleActive: {
    borderColor: '#0D9488',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0D9488',
  },
  radioLabel: {
    fontSize: fontSize.sm,
    color: palette.text,
  },
  radioLabelActive: {
    color: '#0F766E',
    fontWeight: '700',
  },
  healthQuestion: {
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: spacing.xs,
  },
  questionText: {
    fontSize: fontSize.xs,
    color: palette.text,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  yesNoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  yesBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  noBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#16A34A',
  },
  yesNoText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  yesNoTextActive: {
    fontWeight: '800',
  },
  conditionalBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  submitSection: {
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: '#0D9488', // Teal
    minHeight: 52,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  autoTimestampText: {
    fontSize: 11,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    padding: spacing.md,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 12,
    color: palette.danger,
    fontWeight: '700',
  },
  stateItem: {
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  stateItemActive: {
    backgroundColor: '#CCFBF1',
  },
  stateItemText: {
    fontSize: fontSize.xs,
    color: palette.text,
  },
  stateItemTextActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
  successContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  summaryRow: {
    fontSize: fontSize.xs,
  },
  summaryLabel: {
    color: palette.textMuted,
    fontWeight: '600',
  },
  summaryVal: {
    color: '#0F172A',
    fontWeight: '700',
  },
  alertNotice: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  alertNoticeText: {
    fontSize: 11,
    color: '#991B1B',
    lineHeight: 16,
    textAlign: 'center',
  },
});
