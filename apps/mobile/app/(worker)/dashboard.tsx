import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { MalariaStatusChip, SyncStateChip } from '@/components/StatusChips';
import { workerApi, recordsApi, type WorkerProfile, ApiError, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { pendingCount, flushOutbox } from '@/services/sync';
import { screeningLocalRepo } from '@/services/screeningLocal';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

// Section 11: Six primary dashboard features.
// Normal construction site selection is removed. Site changes use Transfer.
const ACTIONS: { key: string; route: string; labelKey: string; color: string; descKey: string }[] = [
  { key: 'profile', route: '/(worker)/profile', labelKey: 'nav.profile', color: palette.textMuted, descKey: 'nav.profileDesc' },
  { key: 'screening', route: '/(worker)/screening', labelKey: 'nav.screening', color: palette.primary, descKey: 'nav.screeningDesc' },
  { key: 'travel', route: '/(worker)/travel', labelKey: 'nav.travel', color: palette.info, descKey: 'nav.travelDesc' },
  { key: 'transfer', route: '/(worker)/transfer', labelKey: 'nav.transfer', color: palette.accent, descKey: 'nav.transferDesc' },
  { key: 'unwell', route: '/(worker)/unwell', labelKey: 'nav.feelingUnwell', color: palette.warning, descKey: 'nav.unwellDesc' },
  { key: 'followups', route: '/(worker)/followups', labelKey: 'nav.followUps', color: palette.primaryLight, descKey: 'nav.checkinsDesc' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut, language, setLanguage } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [currentRx, setCurrentRx] = useState<{ details: string; issuedAt: string } | null>(null);
  const [latestDiag, setLatestDiag] = useState<{ result: string; testType: string; species?: string; testDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      try { await flushOutbox(token); } catch { /* offline or non-fatal */ }

      const p = await workerApi.me(token);
      setProfile(p);
      setOffline(false);

      if (p.preferredLanguage && p.preferredLanguage !== language) {
        void setLanguage(p.preferredLanguage);
      }

      // Registration gate step 3: Must select construction site during initial registration
      if (!p.currentSite) {
        router.replace('/(worker)/site?initial=true');
        return;
      }

      // Registration gate step 5: Must complete initial screening before dashboard access
      if (p.screening?.status !== 'COMPLETE') {
        const workerId = user?.workerId || user?.userId || 'current_worker';
        const local = screeningLocalRepo.getLocal(workerId);
        if (local?.status !== 'COMPLETE') {
          router.replace('/(worker)/screening');
          return;
        }
      }

      // If positive or has diagnostics, load clinical records
      try {
        const diags = (await recordsApi.diagnostics(token)) as { result: string; testType: string; species?: string; testDate: string }[];
        if (diags && diags.length > 0) {
          setLatestDiag(diags[0]);
        }
        if (p.malariaStatus === 'POSITIVE') {
          const rx = (await recordsApi.currentPrescription(token)) as { details: string; issuedAt: string } | null;
          setCurrentRx(rx);
        }
      } catch {
        // non-fatal
      }
    } catch (e) {
      if (isNetworkError(e)) {
        setOffline(true);
        const workerId = user?.workerId || user?.userId || 'current_worker';
        const local = screeningLocalRepo.getLocal(workerId);
        if (local?.status !== 'COMPLETE') {
          router.replace('/(worker)/screening');
          return;
        }
      } else if (e instanceof ApiError && e.status === 401) {
        void signOut();
      }
    } finally {
      setLoading(false);
      try { setQueued(pendingCount()); } catch { /* db not ready */ }
    }
  }, [token, signOut, user, router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const status = profile?.malariaStatus ?? 'NO_RESULT';
  const isPositive = status === 'POSITIVE';
  const isNegative = status === 'NEGATIVE';
  const isAwaiting = status === 'AWAITING';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      {/* Coloured header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.primary }}>
        <View style={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <Text style={{ color: palette.primarySoft, fontSize: fontSize.sm }}>{t('app.name')}</Text>
          <Text style={{ color: palette.textOnColor, fontSize: fontSize.xxl, fontWeight: '800' }}>
            {t('dashboard.greeting', { name: user?.displayName ?? '' })}
          </Text>
          {user?.workerId ? (
            <Text style={{ color: palette.primarySoft, marginTop: 4 }}>
              {t('dashboard.workerId')}: {user.workerId}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {offline ? (
          <Card accent={palette.warning}>
            <Body>{t('status.offline')}</Body>
          </Card>
        ) : null}

        {loading && !profile ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {/* Construction site card */}
            <Card accent={palette.primary}>
              <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{t('dashboard.currentSite')}</Text>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text, marginVertical: 2 }}>
                {profile?.currentSite ? profile.currentSite.name : t('dashboard.noSite')}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: palette.textMuted }}>
                📍 {profile?.currentSite?.area || t('dashboard.assignedDuringRegistration')}
              </Text>

              {/* Status row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{t('dashboard.malariaStatus')}</Text>
                {profile ? <MalariaStatusChip status={profile.malariaStatus} /> : null}
              </View>

              {queued > 0 ? (
                <View style={{ marginTop: spacing.sm }}>
                  <SyncStateChip state="PENDING" />
                </View>
              ) : null}
            </Card>

            {/* ── Section 11.1: POSITIVE MALARIA RESULT VIEW ────────────────── */}
            {isPositive && (
              <View style={styles.clinicalAlertBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.clinicalAlertTitle}>{t('clinical.positiveDiagnosis')}</Text>
                  <Text style={styles.clinicalBadge}>{t('clinical.authorizedResult')}</Text>
                </View>
                {latestDiag ? (
                  <View style={{ marginTop: spacing.xs, gap: 2 }}>
                    <Text style={styles.clinicalDetail}>{t('clinical.test')}: {latestDiag.testType} ({latestDiag.result})</Text>
                    {latestDiag.species && <Text style={styles.clinicalDetail}>{t('clinical.species')}: {latestDiag.species}</Text>}
                    <Text style={styles.clinicalDetail}>{t('clinical.date')}: {new Date(latestDiag.testDate).toLocaleDateString()}</Text>
                  </View>
                ) : null}

                {/* Current Prescription (shown by default for positive workers) */}
                {currentRx ? (
                  <View style={styles.rxSubCard}>
                    <Text style={styles.rxTitle}>{t('clinical.activePrescription')}</Text>
                    <Text style={styles.rxDetails}>{currentRx.details}</Text>
                    <Text style={styles.rxDate}>{t('clinical.issued')}: {new Date(currentRx.issuedAt).toLocaleDateString()}</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: fontSize.xs, color: palette.textMuted, marginTop: 4 }}>
                    {t('clinical.rxPending')}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <Pressable
                    style={styles.clinicalButton}
                    onPress={() => router.push('/(worker)/prescriptions' as never)}
                  >
                    <Text style={styles.clinicalButtonText}>{t('clinical.viewRxHistory')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.clinicalButton}
                    onPress={() => router.push('/(worker)/malaria' as never)}
                  >
                    <Text style={styles.clinicalButtonText}>{t('clinical.diagnosticDetails')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── Section 11.2: NEGATIVE MALARIA RESULT VIEW ────────────────── */}
            {isNegative && (
              <View style={styles.negativeAlertBox}>
                <Text style={styles.negativeAlertTitle}>{t('clinical.verifiedNegative')}</Text>
                <Text style={styles.negativeAlertText}>
                  {t('clinical.negativeAdvice')}
                </Text>
                {latestDiag ? (
                  <Text style={styles.negativeMeta}>
                    {t('clinical.latestTest')}: {latestDiag.testType} ({new Date(latestDiag.testDate).toLocaleDateString()})
                  </Text>
                ) : null}
              </View>
            )}

            {/* ── Section 11.3: AWAITING OR NO RESULT VIEW ───────────────────── */}
            {isAwaiting && (
              <View style={styles.awaitingAlertBox}>
                <Text style={styles.awaitingTitle}>{t('clinical.sampleUnderAnalysis')}</Text>
                <Text style={styles.awaitingText}>
                  {t('clinical.awaitingAdvice')}
                </Text>
              </View>
            )}

            {status === 'NO_RESULT' && (
              <View style={styles.neutralAlertBox}>
                <Text style={styles.neutralText}>
                  {t('clinical.noResultAdvice')}
                </Text>
              </View>
            )}

            {/* ── Quick Actions Grid (6 Features) ─────────────────────────── */}
            <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold as '600', color: palette.text, marginTop: spacing.sm }}>
              {t('dashboard.quickActions')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {ACTIONS.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => router.push(a.route as never)}
                  style={({ pressed }) => ({
                    width: '47%',
                    backgroundColor: palette.surface,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    opacity: pressed ? 0.9 : 1,
                    ...shadow.card,
                    borderWidth: 1,
                    borderColor: palette.border,
                  })}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: a.color, marginBottom: spacing.xs }} />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text }}>{t(a.labelKey)}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: palette.textMuted, marginTop: 2 }}>{t(a.descKey)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Button label={t('nav.signOut')} variant="ghost" onPress={() => void signOut().then(() => router.replace('/language'))} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clinicalAlertBox: {
    backgroundColor: '#FEF2F2',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: palette.danger,
    gap: spacing.xs,
  },
  clinicalAlertTitle: { fontSize: fontSize.md, fontWeight: '700', color: '#991B1B' },
  clinicalBadge: { fontSize: fontSize.xs, fontWeight: '700', color: '#991B1B', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  clinicalDetail: { fontSize: fontSize.xs, color: '#7F1D1D', fontWeight: '500' },
  rxSubCard: {
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rxTitle: { fontSize: fontSize.xs, fontWeight: '700', color: palette.text },
  rxDetails: { fontSize: fontSize.xs, color: palette.text, fontWeight: '500', marginVertical: 2 },
  rxDate: { fontSize: 10, color: palette.textMuted },
  clinicalButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  clinicalButtonText: { fontSize: fontSize.xs, fontWeight: '600', color: '#991B1B' },

  negativeAlertBox: {
    backgroundColor: '#ECFDF5',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: palette.success,
    gap: 3,
  },
  negativeAlertTitle: { fontSize: fontSize.md, fontWeight: '700', color: '#065F46' },
  negativeAlertText: { fontSize: fontSize.xs, color: '#047857', lineHeight: 18 },
  negativeMeta: { fontSize: fontSize.xs, color: '#065F46', fontWeight: '600', marginTop: 2 },

  awaitingAlertBox: {
    backgroundColor: '#FFFBEB',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: palette.warning,
    gap: 2,
  },
  awaitingTitle: { fontSize: fontSize.sm, fontWeight: '700', color: '#92400E' },
  awaitingText: { fontSize: fontSize.xs, color: '#78350F', lineHeight: 18 },

  neutralAlertBox: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  neutralText: { fontSize: fontSize.xs, color: palette.textMuted, lineHeight: 18 },
});
