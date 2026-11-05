import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
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

export default function FollowUpsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();
  const { workerId: preselectedWorkerId } = useLocalSearchParams<{ workerId?: string }>();

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Follow-up record modal state
  const [recordModal, setRecordModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(preselectedWorkerId || '');
  const [selectedWorkerName, setSelectedWorkerName] = useState<string>('');
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const [attendedReferral, setAttendedReferral] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const prof = await healthWorkerApi.me(token);
      const facId = prof.activeFacility?.id || prof.assignedFacilities?.[0]?.id;
      if (facId) {
        const list = await healthWorkerApi.followUps(token, facId);
        setFollowUps(list);
      }
    } catch (e: any) {
      if (!isNetworkError(e)) {
        Alert.alert(t('common.error', 'Error'), e?.message || 'Could not load follow-ups');
      }
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadData();
    if (preselectedWorkerId) {
      setSelectedWorkerId(preselectedWorkerId);
      setRecordModal(true);
    }
  }, [loadData, preselectedWorkerId]);

  const handleRecordFollowUp = async () => {
    if (!token || !selectedWorkerId || !response.trim()) {
      Alert.alert(t('common.error', 'Error'), t('healthWorker.responseRequired', 'Please enter a visit response.'));
      return;
    }

    setSubmitting(true);
    const payload = {
      workerId: selectedWorkerId,
      question: 'Routine health worker follow-up visit and adherence check',
      response: response.trim(),
      note: note.trim() || null,
      attendedReferral,
    };

    try {
      await healthWorkerApi.recordFollowUp(token, payload);
      Alert.alert(t('common.success', 'Success'), t('healthWorker.followUpSaved', 'Follow-up visit recorded successfully.'));
      setRecordModal(false);
      setResponse('');
      setNote('');
      await loadData();
    } catch (err: any) {
      if (isNetworkError(err)) {
        outboxRepo.enqueue({
          entityType: 'hw_follow_up',
          localId: uuid(),
          payload,
        });
        Alert.alert(t('common.offline', 'Offline'), t('healthWorker.offlineSaved', 'Saved offline. Record will upload when connection returns.'));
        setRecordModal(false);
      } else {
        Alert.alert(t('common.error', 'Error'), err?.message || 'Could not record follow-up');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <View style={{ padding: spacing.md, flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={styles.headerTitle}>
            {t('healthWorker.pendingFollowUps', 'Pending Case Follow-ups')} ({followUps.length})
          </Text>
          <AudioGuidanceButton
            text="Follow-up management. Review workers with pending post-treatment checks and record visit outcomes or referral attendance."
            size="small"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : followUps.length === 0 ? (
          <Card style={{ marginVertical: spacing.md, alignItems: 'center', padding: spacing.lg }}>
            <Text style={{ fontSize: 32, marginBottom: spacing.xs }}>✅</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: palette.text }}>
              {t('healthWorker.noPendingFollowUps', 'All follow-ups complete!')}
            </Text>
            <Body style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {t('healthWorker.allCaughtUp', 'No workers currently require urgent post-treatment or referral follow-up.')}
            </Body>
          </Card>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
            {followUps.map((fu) => (
              <Card key={fu.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{fu.worker?.name || 'Worker'}</Text>
                    <Text style={styles.code}>{fu.worker?.workerCode} · 📱 {fu.worker?.phone}</Text>
                    <Text style={styles.questionText}>Check: {fu.question}</Text>
                    {fu.response ? (
                      <Text style={styles.responseText}>Outcome: {fu.response}</Text>
                    ) : (
                      <Text style={[styles.responseText, { color: palette.warning }]}>Status: Pending Visit</Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => {
                      setSelectedWorkerId(fu.worker?.id);
                      setSelectedWorkerName(fu.worker?.name || '');
                      setRecordModal(true);
                    }}
                    style={styles.actionBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionBtnText}>{t('healthWorker.recordVisit', 'Record Visit')}</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Record Follow-up Modal */}
      <Modal visible={recordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('healthWorker.recordFollowUpTitle', 'Record Follow-up Visit')}
            </Text>
            <Text style={styles.modalSub}>{selectedWorkerName || 'Worker'}</Text>

            <Text style={styles.inputLabel}>{t('healthWorker.visitOutcome', 'Visit Outcome / Adherence Response *')}</Text>
            <TextInput
              value={response}
              onChangeText={setResponse}
              placeholder="e.g. Fever resolved, taking Day 3 ACT medication on schedule"
              placeholderTextColor={palette.textMuted}
              style={styles.input}
            />

            <Pressable
              onPress={() => setAttendedReferral(!attendedReferral)}
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: attendedReferral }}
            >
              <Text style={{ fontSize: 18, color: attendedReferral ? palette.primary : '#CBD5E1' }}>
                {attendedReferral ? '☑' : '☐'}
              </Text>
              <Text style={styles.checkLabel}>
                {t('healthWorker.attendedReferral', 'Worker attended referred health clinic or hospital')}
              </Text>
            </Pressable>

            <Text style={styles.inputLabel}>{t('healthWorker.notes', 'Field Notes')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Any clinical observations or remarks..."
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { height: 60 }]}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button label={t('common.cancel', 'Cancel')} variant="ghost" onPress={() => setRecordModal(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save Record')}
                  variant="primary"
                  onPress={handleRecordFollowUp}
                  disabled={submitting}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  code: {
    fontSize: fontSize.xs,
    color: palette.primary,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  questionText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 4,
  },
  responseText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: palette.success,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  modalSub: {
    fontSize: fontSize.sm,
    color: palette.primary,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: fontSize.sm,
    color: palette.text,
    minHeight: 48,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: spacing.sm,
    minHeight: 48,
  },
  checkLabel: {
    fontSize: fontSize.xs,
    color: palette.text,
    flex: 1,
  },
});
