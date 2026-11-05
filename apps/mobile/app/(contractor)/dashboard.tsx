import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Button, Body } from '@/components/ui';
import {
  contractorApi,
  type ContractorSiteSummary,
  type ContractorSiteStats,
  type ContractorProfile,
} from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

export default function ContractorDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, selectedSiteCode, setSelectedSiteCode, signOut } = useSession();

  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [sites, setSites] = useState<ContractorSiteSummary[]>([]);
  const [stats, setStats] = useState<ContractorSiteStats | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [pendingTravelAlertsCount, setPendingTravelAlertsCount] = useState<number>(0);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Human-readable Contractor Code (avoid raw database UUID)
  const contractorCode =
    profile?.contractorId ??
    ((user as unknown as { stakeholderCode?: string })?.stakeholderCode) ??
    (user?.contractorId && user.contractorId.startsWith('C') ? user.contractorId : 'C000002');

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);

      // 1. Fetch profile & assigned sites
      const prof = await contractorApi.profile(token);
      setProfile(prof);
      const assigned = prof.assignedSites ?? [];
      setSites(assigned);

      // Determine active site code
      let activeCode = selectedSiteCode;
      if (!activeCode || !assigned.some((s) => s.siteId === activeCode)) {
        activeCode = assigned[0]?.siteId ?? null;
        if (activeCode) {
          await setSelectedSiteCode(activeCode);
        }
      }

      // 2. Fetch site statistics, pending requests & travel alerts
      if (activeCode) {
        const [statsData, requestsData, travelsData] = await Promise.all([
          contractorApi.stats(token, activeCode).catch(() => null),
          contractorApi.joinRequests(token, activeCode, 'PENDING').catch(() => null),
          contractorApi.travels(token, activeCode).catch(() => null),
        ]);

        setStats(statsData);
        setPendingRequestsCount(requestsData?.total ?? 0);

        const pendingAlerts =
          travelsData?.items?.filter((tr) => tr.isSevenDayAlert && !tr.hasReport).length ?? 0;
        setPendingTravelAlertsCount(pendingAlerts);
      } else {
        setStats(null);
        setPendingRequestsCount(0);
        setPendingTravelAlertsCount(0);
      }

      // 3. Fetch notifications unread count
      try {
        const notifs = await contractorApi.notifications(token, true);
        setUnreadCount(notifs.unread ?? 0);
      } catch {
        /* non-fatal */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard data');
    }
  }, [token, selectedSiteCode, setSelectedSiteCode]);

  useEffect(() => {
    setLoading(true);
    void loadData().finally(() => setLoading(false));
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const currentSite = sites.find((s) => s.siteId === selectedSiteCode) ?? sites[0] ?? null;

  async function handleSwitchSite(siteId: string) {
    await setSelectedSiteCode(siteId);
    setSwitcherVisible(false);
  }

  // 4 Primary Contractor Features matching Worker Dashboard visual design
  const ACTIONS = [
    {
      key: 'scan',
      route: '/(contractor)/scan',
      icon: '📷',
      color: '#4F46E5',
      labelKey: 'contractor.scanWorkerQr',
      defaultTitle: 'Scan Worker QR',
      descKey: 'contractorScan.subtitle',
      defaultDesc: 'Scan Worker QR Pass to assign or transfer into your workforce.',
      badge: undefined,
      badgeAlert: false,
    },
    {
      key: 'add-worker',
      route: '/(contractor)/add-worker',
      icon: '➕',
      color: '#059669',
      labelKey: 'contractor.addWorker',
      defaultTitle: 'Add Worker',
      descKey: 'addWorkerScreen.subtitle',
      defaultDesc: 'Onboard a worker via QR Pass, phone search, or registration.',
      badge: undefined,
      badgeAlert: false,
    },
    {
      key: 'workers',
      route: '/(contractor)/workers',
      icon: '👷',
      color: palette.primary,
      labelKey: 'contractor.navWorkers',
      defaultTitle: 'My Workers',
      descKey: 'contractor.navWorkersHint',
      defaultDesc: 'Search Workers and view authorised information for the active site.',
      badge: stats?.totalWorkers ? `${stats.totalWorkers}` : undefined,
      badgeAlert: false,
    },
    {
      key: 'requests',
      route: '/(contractor)/requests',
      icon: '📋',
      color: palette.info,
      labelKey: 'contractor.navRequests',
      defaultTitle: 'Worker Requests',
      descKey: 'contractor.navRequestsHint',
      defaultDesc: 'Review site joining requests and transfer requests.',
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount} pending` : undefined,
      badgeAlert: pendingRequestsCount > 0,
    },
    {
      key: 'travels',
      route: '/(contractor)/travels',
      icon: '✈️',
      color: palette.accent,
      labelKey: 'contractor.navTravels',
      defaultTitle: 'Worker Travels',
      descKey: 'contractor.navTravelsHint',
      defaultDesc: 'View upcoming travel and high-risk travel alerts.',
      badge: pendingTravelAlertsCount > 0 ? `${pendingTravelAlertsCount} alert` : undefined,
      badgeAlert: pendingTravelAlertsCount > 0,
    },
    {
      key: 'profile',
      route: '/(contractor)/profile',
      icon: '👤',
      color: palette.secondary,
      labelKey: 'contractor.navProfile',
      defaultTitle: 'My Profile',
      descKey: 'contractor.navProfileHint',
      defaultDesc: 'View account information, assigned sites and language settings.',
      badge: undefined,
      badgeAlert: false,
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      {/* Coloured Header matching Worker Dashboard */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.primary }}>
        <View style={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={{ color: palette.primarySoft, fontSize: fontSize.sm }}>
                {t('contractor.headerPlatformTitle', 'M3 Malaria Surveillance')}
              </Text>
              <Text style={{ color: palette.textOnColor, fontSize: fontSize.xxl, fontWeight: '800', marginTop: 2 }}>
                {t('dashboard.greeting', { name: profile?.name ?? user?.displayName ?? 'Contractor' })}
              </Text>
              <Text style={{ color: palette.primarySoft, marginTop: 4, fontSize: fontSize.sm }}>
                {t('contractor.contractorId', 'Contractor ID')}: {contractorCode}
              </Text>
            </View>

            {/* Notification Bell with Badge */}
            <Pressable
              style={styles.headerNotifButton}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push('/(contractor)/notifications')}
            >
              <Text style={{ fontSize: 20 }}>🔔</Text>
              {unreadCount > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
      >
        {error ? (
          <Card accent={palette.danger}>
            <Body>{error}</Body>
          </Card>
        ) : null}

        {loading && !stats && !currentSite ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {/* Construction Site Card (matches Worker Dashboard) */}
            <Card accent={palette.primary}>
              <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>
                {t('contractor.currentlyViewing', 'CURRENT CONSTRUCTION SITE')}
              </Text>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text, marginVertical: 2 }}>
                {currentSite ? currentSite.name : t('contractor.noSitesAssigned', 'No construction site assigned')}
              </Text>
              <Text style={{ fontSize: fontSize.xs, color: palette.textMuted }}>
                📍 {currentSite?.area ?? 'Goa'}{currentSite?.siteId ? ` · ${currentSite.siteId}` : ''}
              </Text>

              {/* Site Switcher Trigger */}
              <Pressable
                style={({ pressed }) => [
                  styles.switchButton,
                  pressed ? { opacity: 0.8 } : null,
                ]}
                accessibilityRole="button"
                onPress={() => setSwitcherVisible(true)}
                disabled={sites.length <= 1}
              >
                <Text style={styles.switchButtonText}>
                  {sites.length > 1
                    ? `⇄ ${t('contractor.switchSite', 'Switch Construction Site')} (${sites.length})`
                    : `✓ ${t('contractor.singleSiteAssigned', 'Assigned Construction Site')}`}
                </Text>
              </Pressable>
            </Card>

            {/* Quick Workforce Actions */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <Pressable
                onPress={() => router.push('/(contractor)/scan')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: '#EEF2FF',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: '#C7D2FE',
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                  ...shadow.card,
                })}
              >
                <Text style={{ fontSize: 24, marginBottom: 2 }}>📷</Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: '#3730A3' }}>
                  Scan Worker QR
                </Text>
                <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' }}>
                  Instant Pass Verification
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/(contractor)/add-worker')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: '#ECFDF5',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: '#A7F3D0',
                  alignItems: 'center',
                  opacity: pressed ? 0.85 : 1,
                  ...shadow.card,
                })}
              >
                <Text style={{ fontSize: 24, marginBottom: 2 }}>➕</Text>
                <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: '#065F46' }}>
                  Add Worker
                </Text>
                <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' }}>
                  QR or Phone Search
                </Text>
              </Pressable>
            </View>

            {/* Site Statistics Cards Section */}
            <View style={{ marginTop: spacing.xs }}>
              <Text
                style={{
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.semibold as '600',
                  color: palette.text,
                  marginBottom: spacing.xs,
                }}
              >
                {t('contractor.siteStatistics', 'Site Statistics')}
              </Text>

              <View style={styles.statsGrid}>
                {/* 1. Total Workers */}
                <View style={[styles.statCard, { borderLeftColor: palette.primary }]}>
                  <Text style={styles.statNumber}>{stats?.totalWorkers ?? 0}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('contractor.totalWorkers', 'Total')}
                  </Text>
                </View>

                {/* 2. Positive Workers */}
                <View style={[styles.statCard, { borderLeftColor: palette.danger }]}>
                  <Text style={[styles.statNumber, { color: palette.danger }]}>{stats?.positive ?? 0}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('status.malaria_positive', 'Positive')}
                  </Text>
                </View>

                {/* 3. Negative Workers */}
                <View style={[styles.statCard, { borderLeftColor: palette.success }]}>
                  <Text style={[styles.statNumber, { color: palette.success }]}>{stats?.negative ?? 0}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('status.malaria_negative', 'Negative')}
                  </Text>
                </View>

                {/* 4. Awaiting Results */}
                <View style={[styles.statCard, { borderLeftColor: palette.warning }]}>
                  <Text style={[styles.statNumber, { color: palette.warning }]}>{stats?.awaitingResults ?? 0}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('contractor.awaiting', 'Awaiting')}
                  </Text>
                </View>

                {/* 5. No Result Recorded */}
                <View style={[styles.statCard, { borderLeftColor: palette.textMuted }]}>
                  <Text style={[styles.statNumber, { color: palette.textMuted }]}>
                    {stats?.noResultRecorded ?? 0}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {t('contractor.noResult', 'No Result')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Feature Cards Grid (matching Worker Dashboard Quick Actions) */}
            <View style={{ marginTop: spacing.xs }}>
              <Text
                style={{
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.semibold as '600',
                  color: palette.text,
                  marginBottom: spacing.xs,
                }}
              >
                {t('contractor.featuresHeading', 'Features')}
              </Text>

              <View style={styles.featuresGrid}>
                {ACTIONS.map((a) => (
                  <Pressable
                    key={a.key}
                    onPress={() => router.push(a.route as never)}
                    style={({ pressed }) => [
                      styles.featureCard,
                      { opacity: pressed ? 0.88 : 1 },
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={styles.featureHeaderRow}>
                      <View style={[styles.iconContainer, { backgroundColor: a.color }]}>
                        <Text style={{ fontSize: 20 }}>{a.icon}</Text>
                      </View>
                      {a.badge ? (
                        <View
                          style={[
                            styles.featureBadge,
                            a.badgeAlert ? { backgroundColor: palette.danger } : null,
                          ]}
                        >
                          <Text style={styles.featureBadgeText}>{a.badge}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.featureTitle}>{t(a.labelKey, a.defaultTitle)}</Text>
                    <Text style={styles.featureDesc}>{t(a.descKey, a.defaultDesc)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Ghost Sign Out Button (matching Worker Dashboard) */}
            <View style={{ marginTop: spacing.md }}>
              <Button
                label={t('auth.signOut', 'Sign Out')}
                variant="ghost"
                onPress={() => void signOut().then(() => router.replace('/sign-in'))}
              />
            </View>
          </>
        )}

        {/* Site Switcher Bottom Modal */}
        <Modal
          visible={switcherVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setSwitcherVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSwitcherVisible(false)}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('contractor.selectSiteTitle', 'Select Construction Site')}</Text>
                <Text style={styles.modalSubtitle}>
                  {t('contractor.selectSiteHint', 'Switch between your assigned construction sites')}
                </Text>
              </View>

              <ScrollView style={{ maxHeight: 360, marginTop: spacing.md }}>
                {sites.map((s) => {
                  const isSelected = s.siteId === selectedSiteCode;
                  return (
                    <Pressable
                      key={s.siteId}
                      style={[styles.siteOptionItem, isSelected ? styles.siteOptionSelected : null]}
                      onPress={() => handleSwitchSite(s.siteId)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.siteOptionName, isSelected ? { color: palette.primary } : null]}>
                          {s.name}
                        </Text>
                        <Text style={styles.siteOptionMeta}>
                          {s.siteId} · {s.area} · {s.activeWorkers} {t('contractor.workers', 'workers')}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.selectedCircle}>
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>
                        </View>
                      ) : (
                        <View style={styles.unselectedCircle} />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Button
                label={t('common.close', 'Close')}
                variant="secondary"
                onPress={() => setSwitcherVisible(false)}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerNotifButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: palette.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: palette.primary,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  switchButton: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  switchButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.primaryDark,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flexBasis: '28%',
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 4,
    ...shadow.card,
  },
  statNumber: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: palette.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.card,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBadge: {
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  featureBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  featureTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
    marginTop: spacing.xs,
  },
  featureDesc: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: palette.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  modalHeader: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: palette.text,
  },
  modalSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  siteOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  siteOptionSelected: {
    backgroundColor: '#EBF4F6',
  },
  siteOptionName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  siteOptionMeta: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  selectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.border,
  },
});
