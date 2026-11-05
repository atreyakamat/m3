import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Title, Button } from '@/components/ui';
import { MalariaStatusChip } from '@/components/StatusChips';
import { contractorApi, type ContractorWorkerDetail } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function ContractorWorkerDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { workerCode } = useLocalSearchParams<{ workerCode: string }>();
  const { token } = useSession();

  const [worker, setWorker] = useState<ContractorWorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorker() {
      if (!token || !workerCode) return;
      try {
        setLoading(true);
        setError(null);
        const data = await contractorApi.workerDetail(token, workerCode);
        setWorker(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load worker details');
      } finally {
        setLoading(false);
      }
    }
    void loadWorker();
  }, [token, workerCode]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={{ marginTop: spacing.sm, color: palette.textMuted }}>
              {t('common.loading', 'Loading worker…')}
            </Text>
          </View>
        ) : error || !worker ? (
          <View style={styles.centerBox}>
            <Text style={{ color: palette.danger, fontWeight: '700' }}>{error ?? 'Worker not found'}</Text>
            <Button label={t('common.back', 'Back')} variant="secondary" onPress={() => router.back()} />
          </View>
        ) : (
          <>
            {/* Header Identity Card */}
            <Card style={styles.card}>
              <View style={styles.avatarCircle}>
                <Text style={{ fontSize: 28 }}>👤</Text>
              </View>
              <Text style={styles.workerName}>{worker.name}</Text>
              <Text style={styles.workerIdBadge}>{worker.workerId}</Text>

              <View style={{ marginTop: spacing.sm, alignItems: 'center' }}>
                {worker.malariaStatus ? (
                  <MalariaStatusChip status={worker.malariaStatus} />
                ) : (
                  <View style={styles.undisclosedBadge}>
                    <Text style={styles.undisclosedBadgeText}>
                      {t('contractor.undisclosedNotice', 'Undisclosed / Pending Verification')}
                    </Text>
                  </View>
                )}
              </View>
            </Card>

            {/* Demographics Card */}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{t('contractor.workerIdentity', 'Worker Identity')}</Text>

              <DetailRow
                label={t('contractor.workerId', 'Worker ID')}
                value={worker.workerId}
              />
              <DetailRow
                label={t('contractor.patientId', 'System ID')}
                value={worker.patientId}
              />
              <DetailRow
                label={t('contractor.phoneLabel', 'Mobile Number')}
                value={worker.phone || '—'}
              />
              <DetailRow
                label={t('contractor.age', 'Age')}
                value={worker.age ? `${worker.age} years` : '—'}
              />
              <DetailRow
                label={t('contractor.gender', 'Gender')}
                value={worker.gender ?? '—'}
              />
              <DetailRow
                label={t('contractor.dependantsCount', 'Registered Dependants')}
                value={worker.dependantsCount !== undefined ? `${worker.dependantsCount}` : '—'}
              />
              <DetailRow
                label={t('contractor.currentSite', 'Construction Site')}
                value={`${worker.currentSite.name} (${worker.currentSite.siteId})`}
              />
            </Card>

            {/* Malaria Status Rule Notice */}
            <Card style={styles.card}>
              <Text style={styles.cardTitle}>{t('contractor.malariaStatusTitle', 'Authorised Malaria Status')}</Text>
              <Text style={styles.noticeText}>
                {t(
                  'contractor.malariaStatusNotice',
                  'Diagnosis is verified only by authorised laboratory tests. Clinical details, prescriptions and medical species are restricted from contractor view per healthcare privacy regulations.',
                )}
              </Text>
            </Card>

            <Button
              label={t('common.back', 'Back to Workers')}
              variant="secondary"
              onPress={() => router.back()}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  centerBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EDF5F6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  workerName: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  workerIdBadge: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.primary,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  detailRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  detailLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: fontSize.sm,
    color: palette.text,
    fontWeight: '700',
    marginTop: 2,
  },
  noticeText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    lineHeight: 18,
  },
  undisclosedBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  undisclosedBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.textMuted,
  },
});
