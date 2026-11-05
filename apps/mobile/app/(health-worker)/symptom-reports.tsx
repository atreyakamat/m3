import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { healthWorkerApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function SymptomReportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal
  const [reviewModal, setReviewModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [actionTaken, setActionTaken] = useState('Initiated onsite health worker screening');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const prof = await healthWorkerApi.me(token);
      const facId = prof.activeFacility?.id || prof.assignedFacilities?.[0]?.id;
      if (facId) {
        const list = await healthWorkerApi.symptomReports(token, facId);
        setReports(list);
      }
    } catch (e: any) {
      if (!isNetworkError(e)) {
        Alert.alert(t('common.error', 'Error'), e?.message || 'Could not load symptom reports');
      }
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenReview = (report: any) => {
    setSelectedReport(report);
    setActionTaken('Initiated onsite health worker assessment and rapid diagnostic test');
    setReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!token || !selectedReport) return;
    setSubmitting(true);
    try {
      await healthWorkerApi.reviewSymptomReport(token, selectedReport.id, actionTaken);
      Alert.alert(t('common.success', 'Success'), t('healthWorker.reviewSaved', 'Symptom report review recorded.'));
      setReviewModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.message || 'Could not submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <View style={{ padding: spacing.md, flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={styles.headerTitle}>
            {t('healthWorker.unwellAlerts', 'Feeling Unwell Surveillance Reports')} ({reports.length})
          </Text>
          <AudioGuidanceButton
            text="Feeling unwell reports. Review alerts submitted by workers, protect worker privacy, and initiate onsite screening."
            size="small"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : reports.length === 0 ? (
          <Card style={{ marginVertical: spacing.md, alignItems: 'center', padding: spacing.lg }}>
            <Text style={{ fontSize: 32, marginBottom: spacing.xs }}>🌟</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: palette.text }}>
              {t('healthWorker.noUnwellReports', 'No unwell reports')}
            </Text>
            <Body style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {t('healthWorker.noUnwellDesc', 'No workers in this surveillance area have submitted recent feeling unwell alerts.')}
            </Body>
          </Card>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
            {reports.map((rep) => (
              <Card key={rep.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{rep.worker?.name || 'Worker'}</Text>
                    <Text style={styles.code}>{rep.worker?.workerCode} · 📱 {rep.worker?.phone}</Text>
                    <Text style={styles.dateText}>
                      Submitted: {new Date(rep.createdAt).toLocaleString()}
                    </Text>
                    <View style={styles.privacyNotice}>
                      <Text style={styles.privacyNoticeText}>
                        🔒 Non-stigmatizing alert. Clinical assessment required.
                      </Text>
                    </View>
                  </View>
                  <View style={{ gap: spacing.xs }}>
                    <Pressable
                      onPress={() => handleOpenReview(rep)}
                      style={styles.actionBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionBtnText}>{t('healthWorker.review', 'Review')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/(health-worker)/screening?workerId=${rep.worker?.id}&workerName=${encodeURIComponent(rep.worker?.name || '')}`)}
                      style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.actionBtnText}>{t('healthWorker.screen', 'Screen')}</Text>
                    </Pressable>
                  </View>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Review Modal */}
      <Modal visible={reviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('healthWorker.reviewAlertTitle', 'Review Feeling Unwell Alert')}</Text>
            <Text style={styles.modalSub}>{selectedReport?.worker?.name} ({selectedReport?.worker?.workerCode})</Text>

            <Text style={styles.inputLabel}>{t('healthWorker.actionTaken', 'Action Taken *')}</Text>
            <TextInput
              value={actionTaken}
              onChangeText={setActionTaken}
              placeholder="e.g. Conducted rapid test, advised rest, referred to PHC..."
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { height: 72 }]}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label={t('common.cancel', 'Cancel')} variant="ghost" onPress={() => setReviewModal(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={submitting ? t('common.saving', 'Saving...') : t('common.confirm', 'Confirm Review')}
                  variant="primary"
                  onPress={handleSubmitReview}
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
  dateText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 4,
  },
  privacyNotice: {
    backgroundColor: '#F1F5F9',
    borderRadius: radius.sm,
    padding: 6,
    marginTop: 6,
  },
  privacyNoticeText: {
    fontSize: 10,
    color: palette.textMuted,
  },
  actionBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});
