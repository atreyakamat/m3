/**
 * TravelScreen — Recurring Travel Record Submissions and Travel History.
 *
 * Implements Section 9 requirements:
 * - Separate dashboard feature for repeated travel outside Goa.
 * - Workers can submit multiple travel records (append-only history).
 * - Departure & expected return dates with native date pickers and constraints.
 * - Conditional fever / malaria treatment details.
 * - Full offline persistence via SQLite and Outbox sync.
 * - Travel history list with departure, return, destination, submission date, and status.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Card, Body, TextField, Button } from '@/components/ui';
import { SyncStateChip } from '@/components/StatusChips';
import { DatePickerField } from '@/components/DatePickerField';
import { recordsApi, type TravelRecordDto } from '@/api';
import { useSession } from '@/store/session';
import { travelLocalRepo, type LocalTravelRecord } from '@/services/travelLocal';
import { flushOutbox } from '@/services/sync';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

export default function TravelScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [records, setRecords] = useState<LocalTravelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [planningTravel, setPlanningTravel] = useState<'yes' | 'no'>('yes');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [destination, setDestination] = useState('');
  const [stateName, setStateName] = useState('');
  const [hadFever, setHadFever] = useState<'yes' | 'no'>('no');
  const [treatmentGiven, setTreatmentGiven] = useState<'yes' | 'no'>('no');
  const [completedCourse, setCompletedCourse] = useState<'yes' | 'no'>('no');
  const [treatmentPlace, setTreatmentPlace] = useState('');

  const load = useCallback(async () => {
    // 1. Read local SQLite records first (offline-first)
    const local = travelLocalRepo.listAll();
    setRecords(local);

    // 2. Fetch server records if online
    if (token) {
      try {
        await flushOutbox(token);
        const remote = await recordsApi.travel(token);
        travelLocalRepo.saveRemoteRecords(remote);
        setRecords(travelLocalRepo.listAll());
      } catch {
        // Offline: continue with local records
      }
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date();

  function minReturnDate(): Date {
    if (departureDate) {
      const [y, m, d] = departureDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return today;
  }

  async function submit() {
    // Validation
    if (planningTravel === 'yes' && departureDate && returnDate && returnDate < departureDate) {
      Alert.alert(t('common.error', 'Validation Error'), t('screening.returnBeforeDeparture', 'Return date cannot be earlier than departure date.'));
      return;
    }

    setSubmitting(true);
    const data = {
      planningTravel: planningTravel === 'yes',
      departureDate: departureDate || null,
      returnDate: returnDate || null,
      destination: destination.trim() || null,
      state: stateName.trim() || null,
      hadFeverOrMalaria: hadFever === 'yes',
      treatmentGiven: hadFever === 'yes' && treatmentGiven === 'yes',
      completedCourse: hadFever === 'yes' && treatmentGiven === 'yes' && completedCourse === 'yes',
      treatmentPlace: treatmentPlace.trim() || null,
    };

    if (token) {
      try {
        await recordsApi.submitTravel(token, data);
        travelLocalRepo.createRecord(data, 'SYNCED');
        Alert.alert(t('travel.title'), t('travel.syncedAlert'));
      } catch {
        // Offline: save locally and queue to outbox
        travelLocalRepo.createRecord(data, 'PENDING');
        Alert.alert(t('travel.title'), t('travel.savedAlert'));
      }
    } else {
      travelLocalRepo.createRecord(data, 'PENDING');
      Alert.alert(t('travel.title'), t('travel.savedAlert'));
    }

    // Reset form
    setDepartureDate('');
    setReturnDate('');
    setDestination('');
    setStateName('');
    setHadFever('no');
    setTreatmentGiven('no');
    setCompletedCourse('no');
    setTreatmentPlace('');
    setShowForm(false);
    setSubmitting(false);

    // Refresh list
    setRecords(travelLocalRepo.listAll());
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
        <Card accent={palette.info}>
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text, marginBottom: spacing.xs }}>
            {t('travel.title')}
          </Text>
          <Body muted>
            {t('travel.subtitle')}
          </Body>
        </Card>

        {!showForm ? (
          <Button
            label={t('travel.submitNew')}
            onPress={() => setShowForm(true)}
            variant="primary"
          />
        ) : (
          <View style={styles.formContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text }}>
                {t('travel.newRecord')}
              </Text>
              <Pressable onPress={() => setShowForm(false)}>
                <Text style={{ color: palette.danger, fontWeight: '600' }}>{t('travel.cancel')}</Text>
              </Pressable>
            </View>

            {/* Q1: Planning to travel? */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>{t('travel.planningTravel')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['yes', 'no'] as const).map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setPlanningTravel(opt)}
                    style={[styles.radioCard, planningTravel === opt && styles.radioCardActive]}
                  >
                    <Text style={[styles.radioText, planningTravel === opt && styles.radioTextActive]}>
                      {opt === 'yes' ? t('travel.yes') : t('travel.alreadyReturned')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Q2: Departure Date */}
            <DatePickerField
              label={t('travel.departureDate')}
              value={departureDate}
              onChange={(iso) => {
                setDepartureDate(iso);
                if (returnDate && returnDate < iso) setReturnDate('');
              }}
              minimumDate={new Date(today.getFullYear() - 1, 0, 1)}
              maximumDate={new Date(today.getFullYear() + 2, 11, 31)}
              placeholder={t('travel.selectDeparture')}
            />

            {/* Q3: Return Date */}
            <DatePickerField
              label={t('travel.returnDate')}
              value={returnDate}
              onChange={setReturnDate}
              minimumDate={minReturnDate()}
              maximumDate={new Date(today.getFullYear() + 2, 11, 31)}
              placeholder={t('travel.selectReturn')}
            />

            {/* Q4: Destination & State */}
            <TextField
              label={t('travel.city')}
              value={destination}
              onChangeText={setDestination}
              placeholder={t('travel.cityPlaceholder')}
            />
            <TextField
              label={t('travel.state')}
              value={stateName}
              onChangeText={setStateName}
              placeholder={t('travel.statePlaceholder')}
            />

            {/* Q5: Fever or malaria during travel? */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>
                {t('travel.feverQuestion')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['yes', 'no'] as const).map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setHadFever(opt)}
                    style={[styles.radioCard, hadFever === opt && styles.radioCardActive]}
                  >
                    <Text style={[styles.radioText, hadFever === opt && styles.radioTextActive]}>
                      {opt === 'yes' ? t('common.yes') : t('common.no')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Conditional: Treatment questions if fever === yes */}
            {hadFever === 'yes' && (
              <View style={styles.conditionalBlock}>
                <View style={styles.fieldWrapper}>
                  <Text style={styles.fieldLabel}>{t('travel.treatmentQuestion')}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {(['yes', 'no'] as const).map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => setTreatmentGiven(opt)}
                        style={[styles.radioCard, treatmentGiven === opt && styles.radioCardActive]}
                      >
                        <Text style={[styles.radioText, treatmentGiven === opt && styles.radioTextActive]}>
                          {opt === 'yes' ? t('common.yes') : t('common.no')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {treatmentGiven === 'yes' && (
                  <>
                    <View style={styles.fieldWrapper}>
                      <Text style={styles.fieldLabel}>{t('q.treatment_completed_past', 'Was the full course of medicine completed?')}</Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        {(['yes', 'no'] as const).map((opt) => (
                          <Pressable
                            key={opt}
                            onPress={() => setCompletedCourse(opt)}
                            style={[styles.radioCard, completedCourse === opt && styles.radioCardActive]}
                          >
                            <Text style={[styles.radioText, completedCourse === opt && styles.radioTextActive]}>
                              {opt === 'yes' ? t('common.yes') : t('common.no')}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>

                    <TextField
                      label={t('q.last_detection_place', 'Place of Treatment')}
                      value={treatmentPlace}
                      onChangeText={setTreatmentPlace}
                      placeholder="e.g. Government PHC, Private Clinic"
                    />
                  </>
                )}
              </View>
            )}

            <Button
              label={t('travel.submit')}
              onPress={submit}
              loading={submitting}
              variant="primary"
            />
          </View>
        )}

        {/* Travel History List */}
        <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginTop: spacing.md }}>
          {t('travel.history')} ({records.length})
        </Text>

        {loading ? (
          <ActivityIndicator color={palette.primary} />
        ) : records.length === 0 ? (
          <Card>
            <Body muted>{t('travel.empty')}</Body>
          </Card>
        ) : (
          records.map((r) => (
            <View key={r.id} style={styles.historyCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.destText}>
                  📍 {r.destination ? `${r.destination}, ${r.state || ''}` : t('travel.title')}
                </Text>
                <SyncStateChip state={r.syncState} />
              </View>

              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>{t('travel.departure')}</Text>
                <Text style={styles.historyVal}>{r.departureDate || '—'}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>{t('travel.expectedReturn')}</Text>
                <Text style={styles.historyVal}>{r.returnDate || '—'}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>{t('travel.feverMalaria')}</Text>
                <Text style={[styles.historyVal, r.hadFeverOrMalaria && { color: palette.danger }]}>
                  {r.hadFeverOrMalaria ? t('travel.reported') : t('travel.none')}
                </Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>{t('travel.submitted')}</Text>
                <Text style={styles.historyVal}>{new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ))
        )}

        <Button
          label={t('dashboard.title')}
          onPress={() => router.replace('/(worker)/dashboard')}
          variant="ghost"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    backgroundColor: palette.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    gap: spacing.md,
  },
  fieldWrapper: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: palette.text },
  radioCard: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  radioCardActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  radioText: { fontSize: fontSize.xs, color: palette.text, textAlign: 'center' },
  radioTextActive: { color: palette.primaryDark, fontWeight: '700' },
  conditionalBlock: {
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    gap: spacing.sm,
  },
  historyCard: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xs,
  },
  destText: { fontSize: fontSize.sm, fontWeight: '700', color: palette.text },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  historyLabel: { fontSize: fontSize.xs, color: palette.textMuted },
  historyVal: { fontSize: fontSize.xs, color: palette.text, fontWeight: '500' },
});
