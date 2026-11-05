import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card } from '@/components/ui';
import { MalariaStatusChip } from '@/components/StatusChips';
import {
  contractorApi,
  type ContractorSiteStats,
  type ContractorWorkerRow,
} from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';
import type { MalariaStatus } from '@m3/shared';

type FilterType = 'ALL' | 'POSITIVE' | 'NEGATIVE';

export default function ContractorWorkersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, selectedSiteCode } = useSession();

  const [stats, setStats] = useState<ContractorSiteStats | null>(null);
  const [workers, setWorkers] = useState<ContractorWorkerRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkers = useCallback(async () => {
    if (!token || !selectedSiteCode) return;
    try {
      setError(null);
      const [statsData, workersData] = await Promise.all([
        contractorApi.stats(token, selectedSiteCode),
        contractorApi.workers(token, selectedSiteCode, {
          search: search.trim() || undefined,
          malaria: filter !== 'ALL' ? filter : undefined,
        }),
      ]);
      setStats(statsData);
      setWorkers(workersData.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workers.');
    }
  }, [token, selectedSiteCode, search, filter]);

  useEffect(() => {
    setLoading(true);
    void fetchWorkers().finally(() => setLoading(false));
  }, [fetchWorkers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkers();
    setRefreshing(false);
  };

  const filterTabs: Array<{ id: FilterType; label: string }> = [
    { id: 'ALL', label: t('contractor.filterAll', 'All Workers') },
    { id: 'POSITIVE', label: t('status.malaria_positive', 'Positive') },
    { id: 'NEGATIVE', label: t('status.malaria_negative', 'Negative') },
  ];

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1 }}>
        {/* Header with Site Info & Stats */}
        <View style={styles.topBanner}>
          <Text style={styles.siteHeaderLabel}>
            {t('contractor.siteLabel', 'Site')}: <Text style={{ color: palette.primary, fontWeight: '800' }}>{selectedSiteCode ?? '—'}</Text>
          </Text>

          {/* Stats Bar */}
          {stats ? (
            <View style={styles.statsRow}>
              <StatItem label={t('contractor.total', 'Total')} count={stats.totalWorkers} />
              <StatItem label={t('status.malaria_positive', 'Pos')} count={stats.positive} color={palette.danger} />
              <StatItem label={t('status.malaria_negative', 'Neg')} count={stats.negative} color={palette.success} />
              <StatItem label={t('contractor.awaiting', 'Await')} count={stats.awaitingResults} color={palette.warning} />
              <StatItem label={t('contractor.noResult', 'None')} count={stats.noResultRecorded} color={palette.textMuted} />
            </View>
          ) : null}
        </View>

        {/* Search Field */}
        <View style={styles.searchBox}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('contractor.searchPlaceholder', 'Search by name, Worker ID or mobile…')}
            placeholderTextColor={palette.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Text style={{ color: palette.textMuted, fontSize: 16 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterScroll}>
          {filterTabs.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                style={[styles.filterPill, active ? styles.filterPillActive : null]}
                onPress={() => setFilter(f.id)}
              >
                <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Workers List */}
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={{ marginTop: spacing.sm, color: palette.textMuted }}>
              {t('common.loading', 'Loading workers…')}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={{ color: palette.danger, fontWeight: '700' }}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={fetchWorkers}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.retry', 'Retry')}</Text>
            </Pressable>
          </View>
        ) : workers.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={{ fontSize: 32 }}>👷</Text>
            <Text style={styles.emptyTitle}>{t('contractor.noWorkersFound', 'No workers found')}</Text>
            <Text style={styles.emptySubtitle}>
              {search || filter !== 'ALL'
                ? t('contractor.adjustFilters', 'Try adjusting your search or filters.')
                : t('contractor.noWorkersAtSite', 'No workers are currently assigned to this site.')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={workers}
            keyExtractor={(item) => item.workerId}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.workerCard, pressed ? styles.workerCardPressed : null]}
                onPress={() => router.push({ pathname: '/(contractor)/worker-detail', params: { workerCode: item.workerId } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{item.name}</Text>
                  <Text style={styles.workerIdText}>{item.workerId} · 📱 {item.phone}</Text>
                  <Text style={styles.demographicsText}>
                    {item.age ? `${item.age} yrs` : 'Age: —'} · {item.gender ?? 'Gender: —'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  {item.malariaStatus ? (
                    <MalariaStatusChip status={item.malariaStatus} />
                  ) : (
                    <View style={styles.undisclosedBadge}>
                      <Text style={styles.undisclosedBadgeText}>
                        {t('contractor.undisclosed', 'Undisclosed')}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.viewLinkText}>{t('common.view', 'View')} ›</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

function StatItem({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statNumber, color ? { color } : null]}>{count}</Text>
      <Text style={styles.statLabelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBanner: {
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  siteHeaderLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.xs,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: palette.text,
  },
  statLabelText: {
    fontSize: 9,
    color: palette.textMuted,
    fontWeight: '700',
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: palette.text,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  filterPillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterPillText: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  workerCard: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  workerCardPressed: {
    backgroundColor: '#F5F9FA',
  },
  workerName: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  workerIdText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  demographicsText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  viewLinkText: {
    fontSize: fontSize.xs,
    color: palette.primary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  undisclosedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  undisclosedBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: palette.textMuted,
  },
});
