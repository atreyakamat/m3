import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  RefreshControl,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Button } from '@/components/ui';
import { contractorApi, type ContractorSiteSummary, type ContractorSiteStats } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

export default function ContractorDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, selectedSiteCode, setSelectedSiteCode } = useSession();

  const [sites, setSites] = useState<ContractorSiteSummary[]>([]);
  const [stats, setStats] = useState<ContractorSiteStats | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractorId = user?.contractorId ?? 'C000001';

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      // 1. Fetch assigned sites
      const assigned = await contractorApi.sites(token);
      setSites(assigned);

      // Determine active site code
      let activeCode = selectedSiteCode;
      if (!activeCode || !assigned.some((s) => s.siteId === activeCode)) {
        activeCode = assigned[0]?.siteId ?? null;
        if (activeCode) {
          await setSelectedSiteCode(activeCode);
        }
      }

      // 2. Fetch stats for active site if available
      if (activeCode) {
        try {
          const s = await contractorApi.stats(token, activeCode);
          setStats(s);
        } catch {
          setStats(null);
        }
      } else {
        setStats(null);
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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSubtitle}>{t('contractor.dashboardTitle', 'CONTRACTOR DASHBOARD')}</Text>
            <Text style={styles.headerContractorId}>
              {t('contractor.contractorId', 'Contractor')}: <Text style={{ color: palette.accent }}>{contractorId}</Text>
            </Text>
          </View>
          <Pressable
            style={styles.notifButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/(contractor)/notifications')}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Current Site Card with Switcher */}
        <Card style={styles.siteCard}>
          <Text style={styles.siteCardHeader}>{t('contractor.currentlyViewing', 'CURRENTLY VIEWING')}</Text>
          {currentSite ? (
            <View style={{ marginTop: spacing.xs }}>
              <Text style={styles.siteName}>{currentSite.name}</Text>
              <View style={styles.siteMetaRow}>
                <View style={styles.siteBadge}>
                  <Text style={styles.siteBadgeText}>{currentSite.siteId}</Text>
                </View>
                {currentSite.area ? (
                  <Text style={styles.siteAreaText}>📍 {currentSite.area}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={[styles.siteName, { color: palette.textMuted }]}>
              {t('contractor.noSitesAssigned', 'No construction site assigned')}
            </Text>
          )}

          <Pressable
            style={styles.switchButton}
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

        {/* Aggregate Quick Stats Preview */}
        {stats ? (
          <View style={styles.statsContainer}>
            <View style={[styles.statBox, { borderLeftColor: palette.primary }]}>
              <Text style={styles.statNumber}>{stats.totalWorkers}</Text>
              <Text style={styles.statLabel}>{t('contractor.totalWorkers', 'Total')}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftColor: palette.danger }]}>
              <Text style={[styles.statNumber, { color: palette.danger }]}>{stats.positive}</Text>
              <Text style={styles.statLabel}>{t('status.malaria_positive', 'Positive')}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftColor: palette.success }]}>
              <Text style={[styles.statNumber, { color: palette.success }]}>{stats.negative}</Text>
              <Text style={styles.statLabel}>{t('status.malaria_negative', 'Negative')}</Text>
            </View>
            <View style={[styles.statBox, { borderLeftColor: palette.warning }]}>
              <Text style={[styles.statNumber, { color: palette.warning }]}>{stats.awaitingResults}</Text>
              <Text style={styles.statLabel}>{t('contractor.awaiting', 'Awaiting')}</Text>
            </View>
          </View>
        ) : null}

        {/* 4 Main Features */}
        <Text style={styles.sectionHeading}>{t('contractor.featuresHeading', 'Features')}</Text>
        <View style={{ gap: spacing.md }}>
          <DashboardNavCard
            icon="👤"
            title={t('contractor.navProfile', 'Profile')}
            subtitle={t('contractor.navProfileHint', 'Account info, registered sites, language, sign out')}
            onPress={() => router.push('/(contractor)/profile')}
          />
          <DashboardNavCard
            icon="👷"
            title={t('contractor.navWorkers', 'My Workers')}
            subtitle={t('contractor.navWorkersHint', 'Search, filter and view malaria status for this site')}
            badge={stats ? `${stats.totalWorkers} Workers` : undefined}
            onPress={() => router.push('/(contractor)/workers')}
          />
          <DashboardNavCard
            icon="📋"
            title={t('contractor.navRequests', 'Worker Requests')}
            subtitle={t('contractor.navRequestsHint', 'Accept or decline site joining and transfer requests')}
            onPress={() => router.push('/(contractor)/requests')}
          />
          <DashboardNavCard
            icon="✈️"
            title={t('contractor.navTravels', 'Worker Travels')}
            subtitle={t('contractor.navTravelsHint', 'Upcoming travels, 7-day alerts and positive reporting')}
            accent={palette.accent}
            onPress={() => router.push('/(contractor)/travels')}
          />
        </View>

        {/* Site Switcher Bottom Modal (Instagram Account Switcher Style) */}
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
    </Screen>
  );
}

function DashboardNavCard({
  icon,
  title,
  subtitle,
  badge,
  accent,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badge?: string;
  accent?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.navCard, pressed ? styles.navCardPressed : null]}
      accessibilityRole="button"
      onPress={onPress}
    >
      <View style={styles.navCardIconBox}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={styles.navCardTitle}>{title}</Text>
          {badge ? (
            <View style={styles.navCardBadge}>
              <Text style={styles.navCardBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.navCardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.navCardChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 1.2,
  },
  headerContractorId: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: palette.text,
    marginTop: 2,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: palette.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  siteCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderTopWidth: 4,
    borderTopColor: palette.primary,
    marginBottom: spacing.md,
  },
  siteCardHeader: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 1,
  },
  siteName: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: palette.text,
  },
  siteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  siteBadge: {
    backgroundColor: '#EBF4F6',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  siteBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.primary,
  },
  siteAreaText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: spacing.md,
    backgroundColor: '#F0F4F6',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  switchButtonText: {
    color: palette.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: palette.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  statLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  navCardPressed: {
    backgroundColor: '#F5F9FA',
    opacity: 0.9,
  },
  navCardIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EDF5F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  navCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  navCardSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  navCardBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  navCardBadgeText: {
    color: palette.success,
    fontSize: 10,
    fontWeight: '700',
  },
  navCardChevron: {
    fontSize: 22,
    color: palette.textMuted,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
