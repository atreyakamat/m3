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

export default function ExitFromGoaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  // Form Fields
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().slice(0, 10));
  const [destState, setDestState] = useState<IndianState>('Bihar');
  const [destDistrict, setDestDistrict] = useState('');
  const [destTown, setDestTown] = useState('');

  // Expected Return
  const [hasExpectedReturn, setHasExpectedReturn] = useState(true);
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // Purpose & Travel Health questions
  const [purpose, setPurpose] = useState('Home visit / Leave');
  const [currentlyUnwell, setCurrentlyUnwell] = useState<'yes' | 'no'>('no');
  const [hasSupplies, setHasSupplies] = useState<'yes' | 'no'>('yes');
  const [notes, setNotes] = useState('');

  // UI state
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedConfirmed, setSubmittedConfirmed] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);

  async function submitExit() {
    if (!departureDate) {
      Alert.alert('Required Field', 'Please enter your date of departure from Goa.');
      return;
    }

    const payload = {
      departureDate,
      destinationState: destState,
      destinationDistrict: destDistrict.trim() || undefined,
      destinationTown: destTown.trim() || undefined,
      expectedReturnDate: hasExpectedReturn ? expectedReturnDate : undefined,
      purpose,
      notes: notes.trim()
        ? `Currently unwell: ${currentlyUnwell}. Has supplies: ${hasSupplies}. ${notes.trim()}`
        : `Currently unwell: ${currentlyUnwell}. Has supplies: ${hasSupplies}`,
      idempotencyKey: uuid(),
    };

    setSubmitting(true);
    try {
      if (token) {
        try {
          await travelApi.leave(token, payload);
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'travel_leave',
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
          planningTravel: true,
          departureDate,
          returnDate: hasExpectedReturn ? expectedReturnDate : null,
          destination: `Departure to ${destTown || destState}`,
          state: destState,
          hadFeverOrMalaria: currentlyUnwell === 'yes',
          treatmentGiven: false,
          completedCourse: false,
        },
        token ? 'SYNCED' : 'PENDING'
      );

      setSubmittedData({
        departureDate,
        destState,
        destTown,
        expectedReturnDate: hasExpectedReturn ? expectedReturnDate : 'Not specified',
        currentlyUnwell: currentlyUnwell === 'yes',
      });
      setSubmittedConfirmed(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not record exit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorkerHeader
        title={t('travel.exitGoaAction', 'Exit from Goa')}
        subtitle="Departure Report & Planned Return"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Exit from Goa. Please select your departure date, the state and town you are traveling to, and your expected date of return to Goa."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Purpose Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIconCircle}>
            <Text style={{ fontSize: 24 }}>🛫</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Leaving Goa Surveillance</Text>
            <Text style={styles.bannerSubtitle}>
              Letting us know when you leave Goa helps us keep your health record active and prepare for your safe return.
            </Text>
          </View>
        </View>

        {/* Departure Form Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>1. Departure & Destination</Text>

          <DatePickerField
            label="Date of Departure from Goa *"
            value={departureDate}
            onChange={setDepartureDate}
          />

          {/* Destination State Selector */}
          <Text style={styles.fieldLabel}>Destination State (कहाँ जा रहे हैं) *</Text>
          <Pressable
            onPress={() => setStateModalVisible(true)}
            style={styles.stateSelector}
            accessibilityRole="button"
          >
            <Text style={styles.stateSelectorText}>{destState}</Text>
            <Text style={styles.dropdownIcon}>▼</Text>
          </Pressable>

          <TextField
            label="Destination City / Town / Village"
            placeholder="e.g. Patna, Gorakhpur, Balasore..."
            value={destTown}
            onChangeText={setDestTown}
          />

          {/* Expected Return Date */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
            2. Expected Return to Goa
          </Text>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setHasExpectedReturn(true)}
              style={[styles.toggleBtn, hasExpectedReturn && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, hasExpectedReturn && styles.toggleTextActive]}>
                Planning to Return to Goa ✓
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setHasExpectedReturn(false)}
              style={[styles.toggleBtn, !hasExpectedReturn && styles.toggleBtnActive]}
            >
              <Text style={[styles.toggleText, !hasExpectedReturn && styles.toggleTextActive]}>
                Return Date Unknown / Not Returning
              </Text>
            </Pressable>
          </View>

          {hasExpectedReturn && (
            <View style={{ marginTop: spacing.sm }}>
              <DatePickerField
                label="Expected Date of Return"
                value={expectedReturnDate}
                onChange={setExpectedReturnDate}
                minimumDate={new Date()}
              />
            </View>
          )}

          {/* Health Questions */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
            3. Health Status Before Departure
          </Text>

          <View style={styles.questionBox}>
            <Text style={styles.questionText}>
              Are you currently experiencing any fever, chills, or headache before traveling?
            </Text>
            <Text style={styles.questionHindi}>
              क्या आपको अभी बुखार, ठंड या सिरदर्द महसूस हो रहा है?
            </Text>
            <View style={styles.toggleRowSmall}>
              <Pressable
                onPress={() => setCurrentlyUnwell('no')}
                style={[styles.toggleBtnSmall, currentlyUnwell === 'no' && styles.toggleBtnActiveNo]}
              >
                <Text style={[styles.toggleTextSmall, currentlyUnwell === 'no' && styles.toggleTextActive]}>
                  No (नहीं)
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCurrentlyUnwell('yes')}
                style={[styles.toggleBtnSmall, currentlyUnwell === 'yes' && styles.toggleBtnActiveYes]}
              >
                <Text style={[styles.toggleTextSmall, currentlyUnwell === 'yes' && styles.toggleTextActive]}>
                  Yes (हाँ)
                </Text>
              </Pressable>
            </View>
          </View>

          {currentlyUnwell === 'yes' && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ Please visit the on-site ICMR–NIMR Health Worker for a free 15-minute rapid blood test before traveling!
              </Text>
            </View>
          )}

          <TextField
            label="Additional Notes / Purpose (Optional)"
            placeholder="e.g. Festival vacation, family emergency, harvest season..."
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Button
            label={submitting ? 'Submitting...' : 'Submit Exit from Goa ✓'}
            onPress={submitExit}
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
              Select Destination State
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
                  setDestState(s);
                  setStateModalVisible(false);
                }}
                style={({ pressed }) => [
                  styles.stateItem,
                  destState === s && styles.stateItemSelected,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.stateItemText, destState === s && styles.stateItemTextSelected]}>
                  {s}
                </Text>
                {destState === s && <Text style={{ color: palette.primary, fontWeight: '700' }}>✓</Text>}
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
              <Text style={{ fontSize: 36 }}>🛫</Text>
            </View>
            <Text style={styles.confirmTitle}>Departure Successfully Recorded!</Text>
            <Text style={styles.confirmSubtitle}>
              Your Exit from Goa has been saved to your travel history.
            </Text>

            <View style={styles.confirmDetailsBox}>
              <Text style={styles.confirmDetailLine}>
                <Text style={{ fontWeight: '700' }}>Departure Date: </Text>
                {submittedData?.departureDate}
              </Text>
              <Text style={styles.confirmDetailLine}>
                <Text style={{ fontWeight: '700' }}>Destination: </Text>
                {submittedData?.destTown ? `${submittedData.destTown}, ` : ''}{submittedData?.destState}
              </Text>
              <Text style={styles.confirmDetailLine}>
                <Text style={{ fontWeight: '700' }}>Expected Return: </Text>
                {submittedData?.expectedReturnDate}
              </Text>
              <Text style={[styles.confirmDetailLine, { color: '#0369A1', marginTop: 4 }]}>
                ℹ️ When you return to Goa, please submit an "Entry in Goa" report.
              </Text>
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
    backgroundColor: '#FFF7ED',
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    marginBottom: spacing.md,
  },
  bannerIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#C2410C',
  },
  bannerSubtitle: {
    fontSize: fontSize.xs,
    color: '#9A3412',
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
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    minHeight: 46,
  },
  toggleBtnActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#F97316',
  },
  toggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textMuted,
    textAlign: 'center',
  },
  toggleTextActive: {
    color: '#9A3412',
    fontWeight: '700',
  },
  questionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
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
  toggleRowSmall: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtnSmall: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    minHeight: 42,
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
  toggleTextSmall: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  warningBox: {
    backgroundColor: '#FEF2F2',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: spacing.md,
  },
  warningText: {
    fontSize: fontSize.xs,
    color: '#991B1B',
    lineHeight: 18,
    fontWeight: '600',
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
    backgroundColor: '#FFF7ED',
  },
  stateItemText: {
    fontSize: fontSize.md,
    color: palette.text,
  },
  stateItemTextSelected: {
    fontWeight: '700',
    color: '#EA580C',
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
    backgroundColor: '#FFEDD5',
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
