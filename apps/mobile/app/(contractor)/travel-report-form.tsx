import React, { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Button } from '@/components/ui';
import { contractorApi } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function TravelReportFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    travelRecordId: string;
    workerId: string;
    workerName: string;
    destination: string;
    departureDate: string;
    returnDate: string;
  }>();

  const { token, selectedSiteCode } = useSession();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inReviewStep, setInReviewStep] = useState(false);

  function handleReviewPrompt() {
    if (!comment.trim()) {
      Alert.alert(
        t('contractor.commentRequiredTitle', 'Comment Required'),
        t('contractor.commentRequiredBody', 'A mandatory reason or comment is required before submitting the travel report.'),
      );
      return;
    }
    setInReviewStep(true);
  }

  async function handleFinalSubmit() {
    if (!token || !params.travelRecordId || !params.workerId) return;

    try {
      setSubmitting(true);
      await contractorApi.submitTravelReport(token, {
        workerId: params.workerId,
        travelRecordId: params.travelRecordId,
        comment: comment.trim(),
      });

      Alert.alert(
        t('contractor.reportSuccessTitle', 'Report Submitted'),
        t(
          'contractor.reportSuccessBody',
          'The high-risk travel report was successfully submitted. Health authorities (Admin, Research Lab, Clinician) have been notified.',
        ),
        [
          {
            text: t('common.ok', 'OK'),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (e) {
      Alert.alert(t('common.error', 'Error'), e instanceof Error ? e.message : 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {inReviewStep ? (
          /* Step 2: Pre-Submission Review Screen */
          <Card style={styles.card}>
            <View style={styles.reviewHeader}>
              <Text style={{ fontSize: 24 }}>📋</Text>
              <Text style={styles.title}>{t('contractor.reviewReportTitle', 'Review Before Submission')}</Text>
              <Text style={styles.subtitle}>
                {t('contractor.reviewNotice', 'Confirm that the information below is accurate. Once submitted, the report is permanent.')}
              </Text>
            </View>

            <ReviewRow label={t('contractor.workerName', 'Worker Name')} value={params.workerName || '—'} />
            <ReviewRow label={t('contractor.workerId', 'Worker ID')} value={params.workerId || '—'} />
            <ReviewRow label={t('contractor.siteLabel', 'Construction Site')} value={selectedSiteCode || '—'} />
            <ReviewRow label={t('contractor.destinationLabel', 'Destination')} value={params.destination || '—'} />
            <ReviewRow
              label={t('contractor.departure', 'Departure Date')}
              value={params.departureDate ? new Date(params.departureDate).toLocaleDateString() : '—'}
            />
            <ReviewRow
              label={t('contractor.return', 'Return Date')}
              value={params.returnDate ? new Date(params.returnDate).toLocaleDateString() : '—'}
            />
            <ReviewRow label={t('contractor.malariaStatus', 'Malaria Status')} value="POSITIVE (Verified)" isAlert />

            <View style={{ marginTop: spacing.md, backgroundColor: '#F8FAFC', padding: spacing.sm, borderRadius: radius.md }}>
              <Text style={styles.commentLabel}>{t('contractor.contractorComment', "Contractor's Reason / Comment")}:</Text>
              <Text style={styles.commentPreview}>{comment}</Text>
            </View>

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                label={t('contractor.confirmSubmitReport', 'Confirm and Submit Report')}
                variant="danger"
                onPress={handleFinalSubmit}
                loading={submitting}
              />
              <Button
                label={t('common.edit', 'Edit Comment')}
                variant="secondary"
                disabled={submitting}
                onPress={() => setInReviewStep(false)}
              />
            </View>
          </Card>
        ) : (
          /* Step 1: Form Input Screen */
          <Card style={styles.card}>
            <View style={styles.alertNoticeBox}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertNoticeTitle}>{t('contractor.highRiskTravelTitle', 'High-Risk Travel Case')}</Text>
                <Text style={styles.alertNoticeText}>
                  {t('contractor.highRiskTravelDesc', 'Worker is verified POSITIVE and scheduled to travel within 7 days.')}
                </Text>
              </View>
            </View>

            {/* Readonly Linked Details */}
            <View style={styles.detailsBox}>
              <DetailRow label={t('contractor.workerName', 'Worker')} value={params.workerName || '—'} />
              <DetailRow label={t('contractor.workerId', 'Worker ID')} value={params.workerId || '—'} />
              <DetailRow label={t('contractor.siteLabel', 'Site')} value={selectedSiteCode || '—'} />
              <DetailRow label={t('contractor.destinationLabel', 'Destination')} value={params.destination || '—'} />
              <DetailRow
                label={t('contractor.departure', 'Departure')}
                value={params.departureDate ? new Date(params.departureDate).toLocaleDateString() : '—'}
              />
              <DetailRow
                label={t('contractor.return', 'Expected Return')}
                value={params.returnDate ? new Date(params.returnDate).toLocaleDateString() : '—'}
              />
            </View>

            {/* Mandatory Comment Input */}
            <Text style={styles.inputLabel}>
              {t('contractor.commentLabel', 'Contractor Reason / Comments')} <Text style={{ color: palette.danger }}>*</Text>
            </Text>
            <Text style={styles.inputHint}>
              {t(
                'contractor.commentHint',
                'Enter mandatory operational details, e.g. antimalarial medication compliance, supervisor contact, travel reason.',
              )}
            </Text>

            <TextInput
              style={styles.commentInput}
              placeholder={t('contractor.commentPlaceholder', 'Enter mandatory reason or clinical coordination comment…')}
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
            />

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                label={t('contractor.reviewReportBtn', 'Review Report Before Submitting')}
                variant="primary"
                onPress={handleReviewPrompt}
                disabled={!comment.trim()}
              />
              <Button
                label={t('common.cancel', 'Cancel')}
                variant="ghost"
                onPress={() => router.back()}
              />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ReviewRow({ label, value, isAlert }: { label: string; value: string; isAlert?: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={[styles.reviewValue, isAlert ? { color: palette.danger, fontWeight: '800' } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  alertNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: palette.danger,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  alertNoticeTitle: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: '#D84315',
  },
  alertNoticeText: {
    fontSize: 11,
    color: '#BF360C',
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: palette.text,
  },
  inputHint: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  commentInput: {
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: palette.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reviewHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: palette.text,
    marginTop: 4,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  reviewLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  reviewValue: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '700',
  },
  commentLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.textMuted,
  },
  commentPreview: {
    fontSize: fontSize.sm,
    color: palette.text,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
