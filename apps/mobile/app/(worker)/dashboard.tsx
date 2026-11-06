import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { MalariaStatusChip, SyncStateChip } from '@/components/StatusChips';
import { WorkerHeader } from '@/components/WorkerHeader';
import { workerApi, recordsApi, type WorkerProfile, ApiError, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { pendingCount, flushOutbox } from '@/services/sync';
import { screeningLocalRepo } from '@/services/screeningLocal';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import {
  WorkerGuidedTour,
  WorkerActionGuide,
  type ActionGuideWorkflow,
  TOUR_COMPLETION_STORAGE_KEY,
} from '@/components/worker-guide';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

// Section 11: Primary dashboard features (Profile, Family & Household, Travel, Transfer, Feeling Unwell).
const ACTIONS: { key: string; route: string; labelKey: string; color: string; descKey: string; icon: string }[] = [
  { key: 'profile', route: '/(worker)/profile', labelKey: 'nav.profile', color: palette.primary, descKey: 'nav.profileDesc', icon: '👤' },
  { key: 'household', route: '/(worker)/household', labelKey: 'nav.household', color: '#8B5CF6', descKey: 'nav.householdDesc', icon: '👨‍👩‍👧' },
  { key: 'travel', route: '/(worker)/travel', labelKey: 'nav.travel', color: palette.info, descKey: 'nav.travelDesc', icon: '✈️' },
  { key: 'transfer', route: '/(worker)/transfer', labelKey: 'nav.transfer', color: palette.accent, descKey: 'nav.transferDesc', icon: '🔄' },
  { key: 'unwell', route: '/(worker)/unwell', labelKey: 'nav.feelingUnwell', color: palette.warning, descKey: 'nav.unwellDesc', icon: '🤒' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut, language, setLanguage } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [householdStats, setHouseholdStats] = useState<{
    totalCount: number;
    activeCount?: number;
    inactiveCount?: number;
    dependentCount?: number;
  } | null>(null);
  const [currentRx, setCurrentRx] = useState<{ details: string; issuedAt: string } | null>(null);
  const [latestDiag, setLatestDiag] = useState<{ result: string; testType: string; species?: string; testDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [installConsentPrompt, setInstallConsentPrompt] = useState(false);
  const [tourVisible, setTourVisible] = useState(false);
  const [actionGuideWorkflow, setActionGuideWorkflow] = useState<ActionGuideWorkflow | null>(null);

  React.useEffect(() => {
    void AsyncStorage.getItem(TOUR_COMPLETION_STORAGE_KEY).then((done) => {
      if (!done) {
        setTourVisible(true);
      }
    });
  }, []);

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

      // Check App Installation Consent status
      const workerId = user?.workerId || user?.userId || 'current_worker';
      const storedConsent = await AsyncStorage.getItem(`m3_install_consent_${workerId}`);
      if (!storedConsent) {
        setInstallConsentPrompt(true);
      }

      // Fetch household stats for surveillance tracking
      try {
        const hh = await workerApi.getHousehold(token);
        if (hh?.stats) {
          setHouseholdStats(hh.stats);
        }
      } catch {
        // non-fatal
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
      <WorkerHeader
        title={t('dashboard.greeting', { name: user?.displayName ?? '' })}
        subtitle={user?.workerId ? `${t('dashboard.workerId')}: ${user.workerId}` : t('app.name')}
        showBack={false}
      />

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

            {/* App Installation Consent Banner */}
            {installConsentPrompt ? (
              <Card accent={palette.primary}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, flex: 1 }}>
                    📋 App Installation Consent
                  </Text>
                  <AudioGuidanceButton
                    text="App Installation Consent. Please confirm if you agree to install and use the M3 malaria surveillance application for health monitoring."
                    label="Listen"
                    size="small"
                  />
                </View>
                <Body>
                  Welcome to the M3 Malaria Surveillance Platform. Do you agree to install and use this application for health monitoring and malaria prevention in Goa?
                </Body>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="I Agree"
                      variant="primary"
                      onPress={async () => {
                        const payload = {
                          consentVersion: '1.0',
                          language,
                          status: 'ACCEPTED',
                          deviceInfo: 'Worker Mobile App',
                        };
                        if (token) {
                          try {
                            await workerApi.consentInstall(token, payload);
                          } catch (err) {
                            if (isNetworkError(err)) {
                              outboxRepo.enqueue({
                                entityType: 'consent_install',
                                localId: uuid(),
                                payload,
                              });
                            }
                          }
                        }
                        const workerId = user?.workerId || user?.userId || 'current_worker';
                        await AsyncStorage.setItem(`m3_install_consent_${workerId}`, 'ACCEPTED');
                        setInstallConsentPrompt(false);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Decline"
                      variant="ghost"
                      onPress={async () => {
                        const payload = {
                          consentVersion: '1.0',
                          language,
                          status: 'REJECTED',
                          deviceInfo: 'Worker Mobile App',
                        };
                        if (token) {
                          try {
                            await workerApi.consentInstall(token, payload);
                          } catch (err) {
                            if (isNetworkError(err)) {
                              outboxRepo.enqueue({
                                entityType: 'consent_install',
                                localId: uuid(),
                                payload,
                              });
                            }
                          }
                        }
                        const workerId = user?.workerId || user?.userId || 'current_worker';
                        await AsyncStorage.setItem(`m3_install_consent_${workerId}`, 'REJECTED');
                        setInstallConsentPrompt(false);
                      }}
                    />
                  </View>
                </View>
              </Card>
            ) : null}

            {/* Visual Tour & Picture Guide Launcher Button */}
            <Pressable
              onPress={() => setTourVisible(true)}
              style={({ pressed }) => ({
                backgroundColor: '#F0FDFA',
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1.5,
                borderColor: '#99F6E4',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.9 : 1,
                minHeight: 56,
                ...shadow.card,
              })}
              accessibilityRole="button"
              accessibilityLabel="Replay Visual Tour"
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
                <Text style={{ fontSize: 24 }}>📖</Text>
              </View>
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: '#0F766E' }}>
                  Visual Tour & Spoken Guide
                </Text>
                <Text style={{ fontSize: 11, color: '#115E59', marginTop: 2 }}>
                  चित्र और आवाज़ से समझें • Tap to replay guide anytime
                </Text>
              </View>
              <View style={{ backgroundColor: '#0D9488', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Open Tour →</Text>
              </View>
            </Pressable>

            {/* QR Worker Pass Banner */}
            <Pressable
              onPress={() => router.push('/(worker)/pass')}
              style={({ pressed }) => ({
                backgroundColor: '#EEF2FF',
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: '#C7D2FE',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: pressed ? 0.9 : 1,
                ...shadow.card,
              })}
            >
              <View style={{ flex: 1, paddingRight: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: '#3730A3' }}>
                    📱 {t('pass.title', 'QR Worker Pass')}
                  </Text>
                </View>
                <Text style={{ fontSize: fontSize.xs, color: '#4B5563', lineHeight: 16 }}>
                  {t(
                    'pass.subtitle',
                    'Show this QR code to your contractor to join their workforce or request a site transfer.',
                  )}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: '#4338CA',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: fontSize.xs }}>
                  View Pass →
                </Text>
              </View>
            </Pressable>

            {/* ── Family & Household Members Surveillance Card ──────────────── */}
            <Pressable
              onPress={() => router.push('/(worker)/household')}
              style={({ pressed }) => ({
                backgroundColor: '#FAF5FF',
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1.5,
                borderColor: '#D8B4FE',
                opacity: pressed ? 0.9 : 1,
                ...shadow.card,
              })}
              accessibilityRole="button"
              accessibilityLabel="View and manage household members"
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: spacing.sm }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: '#F3E8FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>👨‍👩‍👧‍👦</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: '#581C87' }}>
                      {t('household.familyCardTitle', 'Family & Household Members')}
                    </Text>
                    <Text style={{ fontSize: fontSize.xs, color: '#7E22CE', marginTop: 2 }}>
                      {householdStats
                        ? `${householdStats.activeCount ?? householdStats.totalCount} active in Goa · ${householdStats.totalCount} registered`
                        : t('household.familyCardSubtitle', 'Register family and roommates for free health screening')}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: '#7E22CE',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.md,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: fontSize.xs }}>
                    {t('common.manage', 'Manage →')}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: spacing.sm,
                  paddingTop: spacing.xs,
                  borderTopWidth: 1,
                  borderTopColor: '#E9D5FF',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, color: '#6B21A8', fontWeight: '600' }}>
                  🛡️ {t('household.surveillanceBadge', 'Continuous Malaria Surveillance')}
                </Text>
                <Text style={{ fontSize: 11, color: '#9333EA', fontWeight: '500' }}>
                  {householdStats?.inactiveCount ? `${householdStats.inactiveCount} inactive retained` : 'All members monitored'}
                </Text>
              </View>
            </Pressable>

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
                    onPress={() => router.push({ pathname: '/(worker)/profile', params: { tab: 'records' } } as never)}
                  >
                    <Text style={styles.clinicalButtonText}>{t('clinical.viewRxHistory')}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.clinicalButton}
                    onPress={() => router.push({ pathname: '/(worker)/profile', params: { tab: 'records' } } as never)}
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

            {/* ── Quick Actions Grid (Accessible) ─────────────────────────── */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
              <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold as '600', color: palette.text }}>
                {t('dashboard.quickActions')}
              </Text>
              <AudioGuidanceButton
                text="Here are your main actions: Profile, Family and Household, Travel reporting, Site transfer, and Feeling Unwell report."
                size="small"
              />
            </View>
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
                    borderWidth: 1.5,
                    borderColor: palette.border,
                    minHeight: 120,
                  })}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: a.color, marginBottom: spacing.xs, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{a.icon}</Text>
                  </View>
                  <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text }}>{t(a.labelKey, a.key)}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: palette.textMuted, marginTop: 2 }}>{t(a.descKey, '')}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Button label={t('nav.signOut')} variant="ghost" onPress={() => void signOut().then(() => router.replace('/language'))} />
            </View>
          </>
        )}
      </ScrollView>

      {/* First-time Visual Tour Modal */}
      <WorkerGuidedTour
        visible={tourVisible}
        onFinish={() => setTourVisible(false)}
      />

      {/* Contextual Action Guide Modal */}
      <WorkerActionGuide
        visible={actionGuideWorkflow !== null}
        workflow={actionGuideWorkflow || 'screening'}
        onClose={() => setActionGuideWorkflow(null)}
      />
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
