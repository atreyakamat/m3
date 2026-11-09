import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { INDIAN_STATES, type IndianState } from '@m3/shared';
import { Screen, Card, TextField, Button } from '@/components/ui';
import { DatePickerField } from '@/components/DatePickerField';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { travelApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { travelLocalRepo } from '@/services/travelLocal';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

const TRAVEL_MODES = [
  { id: 'train', label: '🚆 Train (ट्रेन)', desc: 'Indian Railways' },
  { id: 'bus', label: '🚌 Bus (बस)', desc: 'Interstate / Private bus' },
  { id: 'car', label: '🚗 Car / Taxi (टैक्सी)', desc: 'Personal or shared cab' },
  { id: 'flight', label: '✈️ Flight (विमान)', desc: 'Goa Airport (Dabolim/Mopa)' },
  { id: 'other', label: '🚲 Other (अन्य)', desc: 'Two-wheeler or other' },
];

export default function EntryInGoaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  // Form Fields
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [originState, setOriginState] = useState<IndianState>('Bihar');
  const [originDistrict, setOriginDistrict] = useState('');
  const [originTown, setOriginTown] = useState('');
  const [travelMode, setTravelMode] = useState('train');

  // Health screening questions (Approved ICMR–NIMR protocol)
  const [hadFever, setHadFever] = useState<'yes' | 'no'>('no');
  const [treatmentGiven, setTreatmentGiven] = useState<'yes' | 'no'>('no');
  const [completedCourse, setCompletedCourse] = useState<'yes' | 'no'>('no');
  const [treatmentPlace, setTreatmentPlace] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedConfirmed, setSubmittedConfirmed] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  async function submitEntry() {
    if (!arrivalDate) {
      Alert.alert('Required Field', 'Please enter your date of arrival in Goa.');
      return;
    }

    const payload = {
      arrivalDate,
      originState,
      originDistrict: originDistrict.trim() || undefined,
      originTown: originTown.trim() || undefined,
      travelMode,
      hadFeverOrMalaria: hadFever === 'yes',
      treatmentGiven: treatmentGiven === 'yes',
      completedCourse: completedCourse === 'yes',
      treatmentPlace: treatmentPlace.trim() || undefined,
      notes: notes.trim() ? `Mode: ${travelMode}. ${notes.trim()}` : `Mode: ${travelMode}`,
      idempotencyKey: uuid(),
    };

    setSubmitting(true);
    try {
      if (token) {
        try {
          await travelApi.enter(token, payload);
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'travel_enter',
              localId: payload.idempotencyKey,
              payload,
            });
          } else {
            throw err;
          }
        }
      }

      // Save locally to maintain instant travel history offline
      travelLocalRepo.createRecord(
        {
          planningTravel: false,
          departureDate: null,
          returnDate: arrivalDate,
          destination: `Arrived in Goa from ${originTown || originState}`,
          state: originState,
          hadFeverOrMalaria: hadFever === 'yes',
          treatmentGiven: treatmentGiven === 'yes',
          completedCourse: completedCourse === 'yes',
          treatmentPlace: treatmentPlace || null,
        },
        token ? 'SYNCED' : 'PENDING'
      );

      setSubmittedData({
        arrivalDate,
        originState,
        originTown,
        travelMode,
        hadFever: hadFever === 'yes',
      });
      setSubmittedConfirmed(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not record entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorkerHeader
        title={t('travel.enterGoaAction', 'Entry in Goa')}
        subtitle="Arrival Report & Health Screening"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Entry in Goa. Please select your arrival date, state and town where you came from, how you traveled, and answer health questions about fever or malaria."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Purpose Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconCircle}>
            <Text style={{ fontSize: 24 }}>🛬</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Entering Goa Surveillance</Text>
            <Text style={styles.bannerSubtitle}>
              Reporting your arrival helps protect you, your family, and fellow workers through free health follow-ups.
            </Text>
          </View>
        </View>

        {/* Form Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>1. Arrival & Journey Information</Text>

          <DatePickerField
            label="Date of Arrival in Goa *"
            value={arrivalDate}
            onChange={setArrivalDate}
            maximumDate={new Date()}
          />

          {/* Origin State Selector */}
          <Text style={styles.fieldLabel}>Origin State (कहाँ से आए) *</Text>
          <Pressable
            onPress={() => setStateModalVisible(true)}
            style={styles.stateSelector}
            accessibilityRole="button"
          >
            <Text style={styles.stateSelectorText}>{originState}</Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </Pressable>

          <TextField
            label="Origin City / Town / District"
            placeholder="e.g. Patna, Muzaffarpur, Malda..."
            value={originTown}
            onChangeText={setOriginTown}
          />

          {/* Travel Mode Chips */}
          <Text style={styles.fieldLabel}>Travel Mode (यात्रा का साधन) *</Text>
          <View style={styles.modesContainer}>
            {TRAVEL_MODES.map((m) => {
              const isSelected = travelMode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setTravelMode(m.id)}
                  style={[
                    styles.modeChip,
                    isSelected && styles.modeChipSelected,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modeLabel, isSelected && styles.modeLabelSelected]}>
                    {m.label}
                  </Text>
                  <Text style={[styles.modeDesc, isSelected && styles.modeDescSelected]}>
                    {m.desc}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Health Questions */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
            2. Travel-Related Health Questions
          </Text>
          <Text style={styles.healthIntro}>
            Answer accurately to receive rapid assistance from the site health team.
          </Text>

          {/* Question 1: Fever or malaria */}
          <View style={styles.questionBox}>
            <Text style={styles.questionText}>
              During this journey or in the last 14 days, did you have fever or were you diagnosed with malaria?
            </Text>
            <Text style={styles.questionHindi}>
              क्या इस यात्रा के दौरान आपको बुखार या मलेरिया हुआ था?
            </Text>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setHadFever('no')}
                style={[styles.toggleBtn, hadFever === 'no' && styles.toggleBtnActiveNo]}
              >
                <Text style={[styles.toggleText, hadFever === 'no' && styles.toggleTextActive]}>
                  No (नहीं)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setHadFever('yes')}
                style={[styles.toggleBtn, hadFever === 'yes' && styles.toggleBtnActiveYes]}
              >
                <Text style={[styles.toggleText, hadFever === 'yes' && styles.toggleTextActive]}>
                  Yes (हाँ)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Conditional Treatment Questions */}
          {hadFever === 'yes' && (
            <View style={styles.conditionalBox}>
              <Text style={styles.alertNote}>
                ⚠️ We have flagged this for free follow-up by the ICMR–NIMR health team.
              </Text>

              <Text style={[styles.questionText, { marginTop: spacing.sm }]}>
                Was any malaria test done or treatment given?
              </Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setTreatmentGiven('no')}
                  style={[styles.toggleBtn, treatmentGiven === 'no' && styles.toggleBtnActiveNo]}
                >
                  <Text style={[styles.toggleText, treatmentGiven === 'no' && styles.toggleTextActive]}>
                    No (नहीं)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setTreatmentGiven('yes')}
                  style={[styles.toggleBtn, treatmentGiven === 'yes' && styles.toggleBtnActiveYes]}
                >
                  <Text style={[styles.toggleText, treatmentGiven === 'yes' && styles.toggleTextActive]}>
                    Yes (हाँ)
                  </Text>
                </Pressable>
              </View>

              {treatmentGiven === 'yes' && (
                <>
                  <Text style={[styles.questionText, { marginTop: spacing.sm }]}>
                    Did you complete the full medicine course?
                  </Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() => setCompletedCourse('no')}
                      style={[styles.toggleBtn, completedCourse === 'no' && styles.toggleBtnActiveNo]}
                    >
                      <Text style={[styles.toggleText, completedCourse === 'no' && styles.toggleTextActive]}>
                        No (नहीं)
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setCompletedCourse('yes')}
                      style={[styles.toggleBtn, completedCourse === 'yes' && styles.toggleBtnActiveYes]}
                    >
                      <Text style={[styles.toggleText, completedCourse === 'yes' && styles.toggleTextActive]}>
                        Yes (हाँ)
                      </Text>
                    </Pressable>
                  </View>

                  <TextField
                    label="Where was treatment received?"
                    placeholder="e.g. District Hospital, PHC, Private Clinic..."
                    value={treatmentPlace}
                    onChangeText={setTreatmentPlace}
                  />
                </>
              )}
            </View>
          )}

          <TextField
            label="Additional Notes (Optional)"
            placeholder="Any other details about your journey..."
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Button
            label={submitting ? 'Submitting...' : 'Submit Entry in Goa ✓'}
            onPress={submitEntry}
            loading={submitting}
            style={{ marginTop: spacing.md, minHeight: 52 }}
          />
        </Card>
      </ScrollView>

      {/* State Selection Modal */}
      <Modal
        visible={stateModalVisible}
        animationType="slide"
        onRequestClose={() => setStateModalVisible(false)}
      >
        <Screen>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>
              Select Origin State
            </Text>
            <Pressable onPress={() => setStateModalVisible(false)} style={{ padding: spacing.xs }}>
              <Text style={{ fontSize: fontSize.md, color: palette.primary, fontWeight: '700' }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView>
            {INDIAN_STATES.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  setOriginState(s);
                  setStateModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.stateItem,
                  originState === s && styles.stateItemSelected,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.stateItemText, originState === s && styles.stateItemTextSelected]}>
                  {s}
                </Text>
                {originState === s && <Text style={{ color: palette.primary, fontWeight: '700' }}>✓</Text>}
              </Pressable>
            ))}
          </ScrollView>
        </Screen>
      </Modal>

      {/* Confirmation Screen / Modal */}
      <Modal
        visible={submittedConfirmed}
        transparent
        animationType="fade"
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Text style={{ fontSize: 36 }}>🎉</Text>
            </View>
            <Text style={styles.confirmTitle}>Arrival Successfully Recorded!</Text>
            <Text style={styles.confirmSubtitle}>
              Your Entry in Goa record has been logged in your travel history.
            </Text>

            <View style={styles.confirmDetailsBox}>
              <Text style={styles.confirmDetailLine}>
                <Text style={{ fontWeight: '700' }}>Arrival Date: </Text>
                {submittedData?.arrivalDate}
              </Text>
              <Text style={styles.confirmDetailLine}>
                <Text style={{ fontWeight: '700' }}>Origin: </Text>
                {submittedData?.originTown ? `${submittedData.originTown}, ` : ''}{submittedData?.originState}
              </Text>
              <Text style={styles.confirmDetailLine}>
                <Text style={{ fontWeight: '700' }}>Mode: </Text>
                {submittedData?.travelMode?.toUpperCase()}
              </Text>
              {submittedData?.hadFever && (
                <Text style={[styles.confirmDetailLine, { color: '#B91C1C', fontWeight: '700', marginTop: 4 }]}>
                  🚨 Fever reported: Health team alerted for on-site screening
                </Text>
              )}
            </View>

            <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                label="Return to Dashboard"
                onPress={() => {
                  setSubmittedConfirmed(false);
                  router.replace('/(worker)/dashboard');
                }}
              />
              <Button
                label="View Travel History"
                variant="ghost"
                onPress={() => {
                  setSubmittedConfirmed(false);
                  router.replace('/(worker)/travel');
                }}
              />
            </View>
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
  },
  banner: {
    backgroundColor: '#F0F9FF',
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    marginBottom: spacing.md,
  },
  bannerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#0369A1',
  },
  bannerSubtitle: {
    fontSize: fontSize.xs,
    color: '#0284C7',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as '500',
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  stateSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: '#F8FAFC',
    marginBottom: spacing.md,
    minHeight: 48,
  },
  stateSelectorText: {
    fontSize: fontSize.md,
    color: palette.text,
    fontWeight: '600',
  },
  dropdownIcon: {
    fontSize: 12,
    color: palette.textMuted,
  },
  modesContainer: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  modeChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  modeChipSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  modeLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  modeLabelSelected: {
    color: '#0369A1',
  },
  modeDesc: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  modeDescSelected: {
    color: '#0284C7',
  },
  healthIntro: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  questionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.md,
  },
  questionText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
    lineHeight: 20,
  },
  questionHindi: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleBtnActiveNo: {
    backgroundColor: '#F1F5F9',
    borderColor: '#64748B',
  },
  toggleBtnActiveYes: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  toggleText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  toggleTextActive: {
    color: '#000000',
  },
  conditionalBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: spacing.md,
  },
  alertNote: {
    fontSize: 11,
    color: '#C2410C',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    alignItems: 'center',
    minHeight: 48,
  },
  stateItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  stateItemText: {
    fontSize: fontSize.md,
    color: palette.text,
  },
  stateItemTextSelected: {
    fontWeight: '700',
    color: palette.primary,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...shadow.card,
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  confirmDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    gap: 4,
  },
  confirmDetailLine: {
    fontSize: fontSize.xs,
    color: palette.text,
    lineHeight: 18,
  },
});
