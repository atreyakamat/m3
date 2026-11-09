import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
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
  TOUR_COMPLETION_STORAGE_KEY,
} from '@/components/worker-guide';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

// The 8 Primary Dashboard Action Buttons in clean 2-column grid
interface DashboardAction {
  id: string;
  route: string;
  titleKey: string;
  defaultTitle: string;
  descKey: string;
  defaultDesc: string;
  icon: string;
  badgeBg: string;
  borderColor: string;
}

const DASHBOARD_ACTIONS: DashboardAction[] = [
  {
    id: 'entry',
    route: '/(worker)/entry',
    titleKey: 'travel.enterGoaAction',
    defaultTitle: 'Entry in Goa',
    descKey: 'travel.enterGoaDesc',
    defaultDesc: 'Arrival health check & log',
    icon: '🛬',
    badgeBg: '#E0F2FE',
    borderColor: '#7DD3FC',
  },
  {
    id: 'exit',
    route: '/(worker)/exit',
    titleKey: 'travel.exitGoaAction',
    defaultTitle: 'Exit from Goa',
    descKey: 'travel.exitGoaDesc',
    defaultDesc: 'Departure & return report',
    icon: '🛫',
    badgeBg: '#FFEDD5',
    borderColor: '#FDBA74',
  },
  {
    id: 'unwell',
    route: '/(worker)/unwell',
    titleKey: 'nav.feelingUnwell',
    defaultTitle: 'Not Feeling Well',
    descKey: 'nav.unwellDesc',
    defaultDesc: 'Symptoms or voice note',
    icon: '🤒',
    badgeBg: '#FFE4E6',
    borderColor: '#FDA4AF',
  },
  {
    id: 'household',
    route: '/(worker)/household',
    titleKey: 'nav.household',
    defaultTitle: 'Household',
    descKey: 'nav.householdDesc',
    defaultDesc: 'Roommates & family',
    icon: '👨‍👩‍👧',
    badgeBg: '#F3E8FF',
    borderColor: '#D8B4FE',
  },
  {
    id: 'transfer',
    route: '/(worker)/transfer',
    titleKey: 'nav.transfer',
    defaultTitle: 'Transfer Site',
    descKey: 'nav.transferDesc',
    defaultDesc: 'Request worksite move',
    icon: '🔄',
    badgeBg: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  {
    id: 'site',
    route: '/(worker)/site',
    titleKey: 'nav.site',
    defaultTitle: 'Construction Site',
    descKey: 'nav.siteDesc',
    defaultDesc: 'Assigned site details',
    icon: '🏗️',
    badgeBg: '#CCFBF1',
    borderColor: '#99F6E4',
  },
  {
    id: 'profile',
    route: '/(worker)/profile',
    titleKey: 'nav.profile',
    defaultTitle: 'My Profile',
    descKey: 'nav.profileDesc',
    defaultDesc: 'Worker ID & identity',
    icon: '👤',
    badgeBg: '#E0E7FF',
    borderColor: '#A5B4FC',
  },
  {
    id: 'screening',
    route: '/(worker)/screening',
    titleKey: 'nav.screening',
    defaultTitle: 'Initial Screening',
    descKey: 'nav.screeningDesc',
    defaultDesc: 'Baseline health records',
    icon: '📋',
    badgeBg: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut, language, setLanguage } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [latestDiag, setLatestDiag] = useState<{ result: string; testType: string; species?: string; testDate: string } | null>(null);
  const [currentRx, setCurrentRx] = useState<{ details: string; issuedAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [tourVisible, setTourVisible] = useState(false);
  const [installConsentPrompt, setInstallConsentPrompt] = useState(false);

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
      try {
        await flushOutbox(token);
      } catch {
        /* offline or non-fatal */
      }

      const p = await workerApi.me(token);
      setProfile(p);
      setOffline(false);

      if (p.preferredLanguage && p.preferredLanguage !== language) {
        void setLanguage(p.preferredLanguage);
      }

      // Check App Installation Consent status
      const workerId = user?.workerId || user?.userId || 'current_worker';
      const storedConsent = await AsyncStorage.getItem(`m3_install_consent_${workerId}`);
      if (!storedConsent) {
        setInstallConsentPrompt(true);
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
        /* non-fatal */
      }
    } catch (e) {
      if (isNetworkError(e)) {
        setOffline(true);
      } else if (e instanceof ApiError && e.status === 401) {
        void signOut();
      }
    } finally {
      setLoading(false);
      try {
        setQueued(pendingCount());
      } catch {
        /* db not ready */
      }
    }
  }, [token, signOut, user, language, setLanguage]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const status = profile?.malariaStatus ?? 'NO_RESULT';
  const isPositive = status === 'POSITIVE';
  const workerDisplayName = profile?.name || user?.displayName || 'Worker';
  const currentSiteName = profile?.currentSite?.name || 'Candolim Beach Resort Project';
  const currentSiteArea = profile?.currentSite?.area || 'Candolim, North Goa';
  const currentSiteId = profile?.currentSite?.siteId || 'SITE-GOA-001';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      {/* Worker Header with Language Switcher */}
      <WorkerHeader
        title={t('dashboard.greeting', { name: workerDisplayName, defaultValue: `Namaste, ${workerDisplayName} 👋` })}
        subtitle={user?.workerId ? `Worker ID: ${user.workerId}` : 'ICMR–NIMR Malaria Surveillance'}
        showBack={false}
        rightElement={
          <AudioGuidanceButton
            text="Welcome to your M3 worker dashboard. Here you can report entry or exit from Goa, report symptoms if unwell, manage household members, check assigned construction site, view profile, and access screening records."
            size="small"
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {/* Offline Warning Banner */}
        {offline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📶 {t('status.offline', 'Offline Mode: Changes will save locally and sync when connected.')}
            </Text>
          </View>
        )}

        {/* Current Assigned Construction Site Card */}
        <Card style={styles.siteCard}>
          <View style={styles.siteCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.siteCardLabel}>
                {t('dashboard.currentSite', 'Currently Assigned Construction Site')}
              </Text>
              <Text style={styles.siteName}>{currentSiteName}</Text>
              <Text style={styles.siteLocation}>📍 {currentSiteArea}</Text>
              <Text style={styles.siteIdText}>Site ID: {currentSiteId}</Text>
            </View>
            <View style={styles.siteActiveBadge}>
              <Text style={styles.siteActiveText}>● Active Site</Text>
            </View>
          </View>

          {/* Worker Status Row */}
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>{t('dashboard.malariaStatus', 'Malaria Status:')}</Text>
              <MalariaStatusChip status={status} />
            </View>

            {queued > 0 && (
              <View style={styles.syncItem}>
                <SyncStateChip state="PENDING" />
              </View>
            )}
          </View>
        </Card>

        {/* Clinical Alert if Positive */}
        {isPositive && (
          <View style={styles.clinicalAlertBox}>
            <Text style={styles.clinicalAlertTitle}>🚨 Positive Malaria Diagnosis</Text>
            <Text style={styles.clinicalAlertDesc}>
              Medical care and prescription issued. Please complete all prescribed medication doses.
            </Text>
            {currentRx && (
              <View style={styles.rxSubCard}>
                <Text style={styles.rxTitle}>💊 Active Prescription:</Text>
                <Text style={styles.rxDetails}>{currentRx.details}</Text>
              </View>
            )}
          </View>
        )}

        {/* App Installation Consent Modal / Prompt */}
        {installConsentPrompt && (
          <Card style={styles.consentCard}>
            <Text style={styles.consentTitle}>📋 App Installation Consent</Text>
            <Body style={styles.consentBody}>
              Welcome to the M3 Malaria Surveillance Platform. Do you agree to use this application for health monitoring and malaria prevention in Goa?
            </Body>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="I Agree"
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
                      } catch {
                        /* offline */
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
                  label="Later"
                  variant="ghost"
                  onPress={() => setInstallConsentPrompt(false)}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Visual Tour & Audio Guide Launcher */}
        <Pressable
          onPress={() => setTourVisible(true)}
          style={({ pressed }) => [styles.tourButton, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Open Visual Tour"
        >
          <View style={styles.tourIconCircle}>
            <Text style={{ fontSize: 22 }}>📖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tourTitle}>Visual Tour & Spoken Guide</Text>
            <Text style={styles.tourSubtitle}>चित्र और आवाज़ से समझें • Tap to replay guide</Text>
          </View>
          <Text style={styles.tourArrow}>View →</Text>
        </Pressable>

        {/* Section Heading */}
        <View style={styles.gridHeadingRow}>
          <Text style={styles.gridHeading}>
            {t('dashboard.quickActions', 'Worker Actions')}
          </Text>
          <Text style={styles.gridSubheading}>Select an action below</Text>
        </View>

        {/* ── The 8 Primary Actions in a Clean Two-Column Grid ── */}
        <View style={styles.actionGrid}>
          {DASHBOARD_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => router.push(action.route as never)}
              style={({ pressed }) => [
                styles.actionCard,
                { borderColor: action.borderColor },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t(action.titleKey, action.defaultTitle)}
            >
              <View style={[styles.actionIconBadge, { backgroundColor: action.badgeBg }]}>
                <Text style={styles.actionIcon}>{action.icon}</Text>
              </View>

              <Text style={styles.actionTitle} numberOfLines={1}>
                {t(action.titleKey, action.defaultTitle)}
              </Text>
              <Text style={styles.actionDesc} numberOfLines={2}>
                {t(action.descKey, action.defaultDesc)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Sign Out Button */}
        <View style={styles.footerSection}>
          <Button
            label={t('nav.signOut', 'Sign Out')}
            variant="ghost"
            onPress={() => void signOut().then(() => router.replace('/sign-in'))}
          />
        </View>
      </ScrollView>

      {/* Guided Tour Modal */}
      <WorkerGuidedTour
        visible={tourVisible}
        onFinish={() => setTourVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  offlineText: {
    fontSize: fontSize.xs,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  siteCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    borderLeftColor: palette.primary,
    ...shadow.card,
  },
  siteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  siteCardLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  siteName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginTop: 2,
  },
  siteLocation: {
    fontSize: fontSize.xs,
    color: palette.primaryDark,
    marginTop: 2,
    fontWeight: '500',
  },
  siteIdText: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  siteActiveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  siteActiveText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  syncItem: {
    alignSelf: 'flex-end',
  },
  clinicalAlertBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#F87171',
  },
  clinicalAlertTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#B91C1C',
  },
  clinicalAlertDesc: {
    fontSize: fontSize.xs,
    color: '#991B1B',
    marginTop: 4,
    lineHeight: 18,
  },
  rxSubCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  rxTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#B91C1C',
  },
  rxDetails: {
    fontSize: fontSize.xs,
    color: palette.text,
    marginTop: 2,
  },
  consentCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.primary,
  },
  consentTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.primaryDark,
    marginBottom: 4,
  },
  consentBody: {
    fontSize: fontSize.xs,
    color: palette.text,
    lineHeight: 18,
  },
  tourButton: {
    backgroundColor: '#F0FDFA',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  tourIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  tourTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0F766E',
  },
  tourSubtitle: {
    fontSize: 11,
    color: '#115E59',
    marginTop: 1,
  },
  tourArrow: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#0D9488',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  gridHeadingRow: {
    marginTop: spacing.xs,
  },
  gridHeading: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  gridSubheading: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48.5%',
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    minHeight: 130,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  actionIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginTop: 4,
  },
  actionDesc: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  footerSection: {
    marginTop: spacing.md,
  },
});
