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

const COMMON_SYMPTOMS = [
  { key: 'fever', label: 'High Fever (तेज़ बुखार)', icon: '🔥' },
  { key: 'chills', label: 'Chills & Rigors (कंपकंपी / ठंड)', icon: '🥶' },
  { key: 'sweating', label: 'Profuse Sweating (पसीना आना)', icon: '💦' },
  { key: 'headache', label: 'Severe Headache (सिरदर्द)', icon: '🤕' },
  { key: 'vomiting', label: 'Nausea / Vomiting (उल्टी)', icon: '🤢' },
  { key: 'fatigue', label: 'Extreme Fatigue (कमजोरी / थकान)', icon: '🛌' },
];

export default function SuspectedCaseFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();
  const { workerId, workerName } = useLocalSearchParams<{ workerId?: string; workerName?: string }>();

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['fever', 'chills']);
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [observations, setObservations] = useState('');
  const [requestTest, setRequestTest] = useState(true);
  const [testType, setTestType] = useState<'RDT' | 'MICROSCOPY'>('RDT');
  const [submitting, setSubmitting] = useState(false);

  const toggleSymptom = (key: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  };

  const handleSubmit = async () => {
    if (!token || !workerId) {
      Alert.alert(t('common.error', 'Error'), t('healthWorker.missingWorkerId', 'No worker selected.'));
      return;
    }

    setSubmitting(true);
    try {
      const profile = await healthWorkerApi.me(token).catch(() => null);
      const facilityId = profile?.activeFacility?.id || profile?.assignedFacilities?.[0]?.id;

      if (!facilityId) {
        Alert.alert(t('common.error', 'Error'), t('healthWorker.noFacilityAssigned', 'No active facility assigned.'));
        setSubmitting(false);
        return;
      }

      const casePayload = {
        workerId,
        facilityId,
        onsetDate,
        symptoms: selectedSymptoms,
        clinicalObservations: observations.trim() || 'Suspected malaria recorded on mobile',
      };

      let episodeId: string | null = null;
      try {
        const episode = await healthWorkerApi.recordSuspectedCase(token, casePayload);
        episodeId = episode.id;

        if (requestTest && episodeId) {
          const testPayload = {
            episodeId,
            workerId,
            facilityId,
            testType,
            sampleDetails: `${testType} initiated onsite at field health facility.`,
          };
          await healthWorkerApi.recordTestRequest(token, testPayload);
        }

        Alert.alert(
          t('common.success', 'Success'),
          t('healthWorker.caseRecordedSuccess', 'Suspected malaria case and diagnostic request registered successfully.'),
        );
        router.back();
      } catch (err: any) {
        if (isNetworkError(err)) {
          // Offline queue
          const localCaseId = uuid();
          outboxRepo.enqueue({
            entityType: 'hw_suspected_case',
            localId: localCaseId,
            payload: casePayload,
          });

          if (requestTest) {
            outboxRepo.enqueue({
              entityType: 'hw_test_request',
              localId: uuid(),
              payload: {
                episodeId: localCaseId,
                workerId,
                facilityId,
                testType,
                sampleDetails: `${testType} initiated onsite (offline queued).`,
              },
            });
          }

          Alert.alert(
            t('common.offline', 'Offline'),
            t('healthWorker.offlineSaved', 'Saved offline. Records will sync when connectivity returns.'),
          );
          router.back();
        } else {
          throw err;
        }
      }
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.message || 'Could not record suspected case');
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
              <Text style={styles.targetLabel}>{t('healthWorker.suspectedCaseFor', 'Recording Suspected Case For')}</Text>
              <Text style={styles.targetName}>{workerName || 'Worker'}</Text>
            </View>
            <AudioGuidanceButton
              text={`Suspected malaria report for ${workerName}. Select all symptoms present, enter onset date, and initiate rapid test request.`}
              size="small"
            />
          </View>
        </Card>

        {/* Symptoms Selection */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('healthWorker.selectSymptoms', 'Observed & Reported Symptoms')}</Text>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {COMMON_SYMPTOMS.map((s) => {
              const checked = selectedSymptoms.includes(s.key);
              return (
                <Pressable
                  key={s.key}
                  onPress={() => toggleSymptom(s.key)}
                  style={[styles.symptomRow, checked && styles.symptomRowChecked]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                  <Text style={[styles.symptomLabel, checked && { fontWeight: fontWeight.bold, color: palette.primary }]}>
                    {s.label}
                  </Text>
                  <Text style={{ fontSize: 18, color: checked ? palette.primary : '#CBD5E1' }}>
                    {checked ? '☑' : '☐'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Diagnostic Test Request Options */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('healthWorker.diagnosticTestRequest', 'Diagnostic Test Request')}</Text>
          <Body style={{ marginBottom: spacing.sm }}>
            {t('healthWorker.diagTestNotice', 'Health Workers initiate the test request. Authorized lab staff/pathologists confirm official diagnostic results.')}
          </Body>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <Pressable
              onPress={() => setTestType('RDT')}
              style={[styles.testTypeBtn, testType === 'RDT' && styles.testTypeBtnActive]}
            >
              <Text style={[styles.testTypeText, testType === 'RDT' && styles.testTypeTextActive]}>
                🩸 Rapid Diagnostic Test (RDT)
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTestType('MICROSCOPY')}
              style={[styles.testTypeBtn, testType === 'MICROSCOPY' && styles.testTypeBtnActive]}
            >
              <Text style={[styles.testTypeText, testType === 'MICROSCOPY' && styles.testTypeTextActive]}>
                🔬 Lab Microscopy Slide
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Clinical Notes */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>{t('healthWorker.observations', 'Clinical Notes & Patient Details')}</Text>
          <TextInput
            value={observations}
            onChangeText={setObservations}
            placeholder="Clinical observations, suspected species, travel remarks..."
            placeholderTextColor={palette.textMuted}
            style={[styles.input, { height: 72 }]}
            multiline
          />
        </Card>

        {/* Submit Button */}
        <View style={{ marginTop: spacing.md }}>
          <Button
            label={submitting ? t('common.saving', 'Recording...') : t('healthWorker.submitCase', 'Submit Suspected Case & Request Test')}
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
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginBottom: spacing.xs,
  },
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 48,
    gap: spacing.sm,
  },
  symptomRowChecked: {
    borderColor: palette.primary,
    backgroundColor: '#F0F9FF',
  },
  symptomLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: palette.text,
  },
  testTypeBtn: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  testTypeBtnActive: {
    borderColor: palette.primary,
    backgroundColor: '#EEF2FF',
  },
  testTypeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: palette.text,
    textAlign: 'center',
  },
  testTypeTextActive: {
    fontWeight: fontWeight.bold,
    color: palette.primary,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    color: palette.text,
  },
});
