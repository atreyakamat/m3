import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { healthWorkerApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function HealthWorkerScreeningScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();
  const { workerId, workerName, memberId, memberName } = useLocalSearchParams<{
    workerId?: string;
    workerName?: string;
    memberId?: string;
    memberName?: string;
  }>();

  const isHousehold = Boolean(memberId);
  const subjectName = isHousehold ? memberName : workerName;

  const [feverToday, setFeverToday] = useState<'yes' | 'no'>('no');
  const [chills, setChills] = useState<'yes' | 'no'>('no');
  const [headache, setHeadache] = useState<'yes' | 'no'>('no');
  const [antimalarialTaken, setAntimalarialTaken] = useState<'yes' | 'no'>('no');
  const [observations, setObservations] = useState('');
  const [temperature, setTemperature] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!token) return;

    setSubmitting(true);
    const symptoms: string[] = [];
    if (feverToday === 'yes') symptoms.push('fever');
    if (chills === 'yes') symptoms.push('chills');
    if (headache === 'yes') symptoms.push('headache');

    const profile = await healthWorkerApi.me(token).catch(() => null);
    const facilityId = profile?.activeFacility?.id || profile?.assignedFacilities?.[0]?.id;

    if (!facilityId) {
      Alert.alert(t('common.error', 'Error'), t('healthWorker.noFacilityAssigned', 'No active facility assigned.'));
      setSubmitting(false);
      return;
    }

    try {
      if (isHousehold && memberId) {
        const payload = {
          memberId,
          facilityId,
          symptoms,
          examinationFindings: `Temp: ${temperature || 'Normal'}. ${observations}`.trim(),
          testRequested: feverToday === 'yes' || chills === 'yes',
          clinicalHistory: antimalarialTaken === 'yes' ? 'Reported antimalarials taken in past 28 days' : 'None',
        };

        try {
          await healthWorkerApi.recordHouseholdScreening(token, payload);
          Alert.alert(t('common.success', 'Success'), t('healthWorker.householdScreeningSaved', 'Household member screening saved.'));
          router.back();
        } catch (err: any) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'hw_household_assessment',
              localId: uuid(),
              payload,
            });
            Alert.alert(t('common.offline', 'Offline'), t('healthWorker.offlineSaved', 'Saved offline. Record will upload when connection returns.'));
            router.back();
          } else {
            throw err;
          }
        }
      } else if (workerId) {
        const answers = {
          fever_today: feverToday,
          chills,
          headache,
          antimalarial_past_28_days: antimalarialTaken,
          temperature: temperature || null,
        };
        const payload = {
          workerId,
          facilityId,
          answers,
          clinicalObservations: observations.trim() || null,
          isAssisted: true,
        };

        try {
          await healthWorkerApi.recordScreening(token, payload);
          Alert.alert(t('common.success', 'Success'), t('healthWorker.screeningCompleted', 'Assisted health screening saved successfully.'));
          router.back();
        } catch (err: any) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'hw_screening',
              localId: uuid(),
              payload,
            });
            Alert.alert(t('common.offline', 'Offline'), t('healthWorker.offlineSaved', 'Saved offline. Record will upload when connection returns.'));
            router.back();
          } else {
            throw err;
          }
        }
      }
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.message || 'Could not save screening');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}>
        <Card style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.targetLabel}>
                {isHousehold ? t('healthWorker.screeningFamily', 'Screening Household Member') : t('healthWorker.screeningWorker', 'Screening Worker')}
              </Text>
              <Text style={styles.targetName}>{subjectName || (isHousehold ? 'Family Member' : 'Worker')}</Text>
            </View>
            <AudioGuidanceButton
              text={`Health screening form for ${subjectName}. Confirm if patient has fever today, chills, headache, or has taken malaria medicine recently.`}
              size="small"
            />
          </View>
        </Card>

        {/* Question 1: Fever Today */}
        <Card style={styles.card}>
          <Text style={styles.qText}>{t('screening.feverToday', '1. Does the patient currently have fever or high body temperature?')}</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => setFeverToday('yes')}
              style={[styles.choiceBtn, feverToday === 'yes' && styles.choiceActiveYes]}
            >
              <Text style={[styles.choiceText, feverToday === 'yes' && styles.choiceTextActive]}>
                🔥 {t('common.yes', 'Yes')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFeverToday('no')}
              style={[styles.choiceBtn, feverToday === 'no' && styles.choiceActiveNo]}
            >
              <Text style={[styles.choiceText, feverToday === 'no' && styles.choiceTextActive]}>
                ❄️ {t('common.no', 'No')}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Question 2: Chills */}
        <Card style={styles.card}>
          <Text style={styles.qText}>{t('screening.chills', '2. Is the patient experiencing chills or shivering?')}</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => setChills('yes')}
              style={[styles.choiceBtn, chills === 'yes' && styles.choiceActiveYes]}
            >
              <Text style={[styles.choiceText, chills === 'yes' && styles.choiceTextActive]}>
                🥶 {t('common.yes', 'Yes')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setChills('no')}
              style={[styles.choiceBtn, chills === 'no' && styles.choiceActiveNo]}
            >
              <Text style={[styles.choiceText, chills === 'no' && styles.choiceTextActive]}>
                👍 {t('common.no', 'No')}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Question 3: Headache */}
        <Card style={styles.card}>
          <Text style={styles.qText}>{t('screening.headache', '3. Is the patient suffering from headache or body ache?')}</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => setHeadache('yes')}
              style={[styles.choiceBtn, headache === 'yes' && styles.choiceActiveYes]}
            >
              <Text style={[styles.choiceText, headache === 'yes' && styles.choiceTextActive]}>
                🤕 {t('common.yes', 'Yes')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setHeadache('no')}
              style={[styles.choiceBtn, headache === 'no' && styles.choiceActiveNo]}
            >
              <Text style={[styles.choiceText, headache === 'no' && styles.choiceTextActive]}>
                👌 {t('common.no', 'No')}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Question 4: Prior Antimalarial */}
        <Card style={styles.card}>
          <Text style={styles.qText}>{t('screening.priorMeds', '4. Has the patient taken antimalarial medicine in the past 28 days?')}</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => setAntimalarialTaken('yes')}
              style={[styles.choiceBtn, antimalarialTaken === 'yes' && styles.choiceActiveYes]}
            >
              <Text style={[styles.choiceText, antimalarialTaken === 'yes' && styles.choiceTextActive]}>
                💊 {t('common.yes', 'Yes')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAntimalarialTaken('no')}
              style={[styles.choiceBtn, antimalarialTaken === 'no' && styles.choiceActiveNo]}
            >
              <Text style={[styles.choiceText, antimalarialTaken === 'no' && styles.choiceTextActive]}>
                ❌ {t('common.no', 'No')}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Clinical Observations */}
        <Card style={styles.card}>
          <Text style={styles.qText}>{t('healthWorker.observations', '5. Clinical Observations & Body Temperature')}</Text>
          <TextInput
            value={temperature}
            onChangeText={setTemperature}
            placeholder="Temperature (e.g. 98.6 F or 101.2 F)"
            placeholderTextColor={palette.textMuted}
            style={styles.textInput}
            keyboardType="numeric"
          />
          <TextInput
            value={observations}
            onChangeText={setObservations}
            placeholder="Field observations, pallor, general condition..."
            placeholderTextColor={palette.textMuted}
            style={[styles.textInput, { height: 80, marginTop: spacing.xs }]}
            multiline
          />
        </Card>

        {/* Submit Screening Button */}
        <View style={{ marginTop: spacing.md }}>
          <Button
            label={submitting ? t('common.saving', 'Saving Screening...') : t('healthWorker.saveScreening', 'Save & Submit Screening')}
            variant="primary"
            onPress={handleSubmit}
            disabled={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  targetLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    color: palette.primary,
    fontWeight: fontWeight.bold,
  },
  targetName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginTop: 2,
  },
  qText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  choiceActiveYes: {
    borderColor: palette.danger,
    backgroundColor: '#FEF2F2',
  },
  choiceActiveNo: {
    borderColor: palette.success,
    backgroundColor: '#F0FDF4',
  },
  choiceText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: palette.text,
  },
  choiceTextActive: {
    fontWeight: fontWeight.bold,
  },
  textInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    color: palette.text,
  },
});
