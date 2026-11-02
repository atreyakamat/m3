import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
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
import { contractorApi, type ContractorTravelRow } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function ContractorTravelsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, selectedSiteCode } = useSession();

  const [travels, setTravels] = useState<ContractorTravelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchTravels = useCallback(async () => {
    if (!token || !selectedSiteCode) return;
    try {
      const res = await contractorApi.travels(token, selectedSiteCode);
      setTravels(res.items ?? []);
    } catch (e) {
      /* non-fatal */
    }
  }, [token, selectedSiteCode]);

  useEffect(() => {
    setLoading(true);
    void fetchTravels().finally(() => setLoading(false));
  }, [fetchTravels]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTravels();
    setRefreshing(false);
  };

  const flaggedTravels = travels.filter((t) => t.isSevenDayAlert && !t.hasReport);
  const upcomingTravels = travels.filter((t) => t.isUpcoming);
  const historyTravels = travels.filter((t) => !t.isUpcoming);

  const displayedList = showHistory ? historyTravels : upcomingTravels;

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1 }}>
        {/* Top Segmented Controls */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabItem, !showHistory ? styles.tabItemActive : null]}
            onPress={() => setShowHistory(false)}
          >
            <Text style={[styles.tabText, !showHistory ? styles.tabTextActive : null]}>
              {t('contractor.upcomingTravels', 'Upcoming Travels')} ({upcomingTravels.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, showHistory ? styles.tabItemActive : null]}
            onPress={() => setShowHistory(true)}
          >
            <Text style={[styles.tabText, showHistory ? styles.tabTextActive : null]}>
              {t('contractor.travelHistory', 'Travel History')} ({historyTravels.length})
            </Text>
          </Pressable>
        </View>

        {/* 7-Day Alert Banner for Positive Cases */}
        {!showHistory && flaggedTravels.length > 0 ? (
          <View style={styles.alertBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 18 }}>⚠️</Text>
              <Text style={styles.alertBannerTitle}>
                {t('contractor.sevenDayAlertHeading', '7-Day High Risk Travel Alert')}
              </Text>
            </View>
            <Text style={styles.alertBannerBody}>
              {t(
                'contractor.sevenDayAlertDesc',
                'Positive malaria cases departing within 7 days require a mandatory travel report to health authorities.',
              )}
            </Text>
          </View>
        ) : null}

        {/* List Content */}
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : displayedList.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={{ fontSize: 32 }}>✈️</Text>
            <Text style={styles.emptyTitle}>
              {showHistory
                ? t('contractor.noTravelHistory', 'No travel history')
                : t('contractor.noUpcomingTravels', 'No upcoming travels')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showHistory
                ? t('contractor.noPastTravelsHint', 'Completed or cancelled travel records will appear here.')
                : t('contractor.noUpcomingTravelsHint', 'Workers planning to travel outside Goa will appear here.')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayedList}
            keyExtractor={(item) => item.travelRecordId}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
            renderItem={({ item }) => {
              const isFlagged = item.isSevenDayAlert && !item.hasReport;
              return (
                <Card style={[styles.travelCard, isFlagged ? styles.travelCardFlagged : null]}>
                  {isFlagged ? (
                    <View style={styles.flaggedBadge}>
                      <Text style={styles.flaggedBadgeText}>
                        🚨 {t('contractor.actionRequired', 'ACTION REQUIRED · POSITIVE DEPARTING SOON')}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workerName}>{item.workerName}</Text>
                      <Text style={styles.workerMeta}>{item.workerId} · 📱 {item.phone}</Text>
                    </View>
                    {item.malariaStatus ? (
                      <MalariaStatusChip status={item.malariaStatus} />
                    ) : (
                      <View style={styles.undisclosedBadge}>
                        <Text style={styles.undisclosedBadgeText}>
                          {t('contractor.undisclosed', 'Undisclosed')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.routeBox}>
                    <Text style={styles.routeText}>
                      📍 {item.destination ?? '—'} {item.state ? `(${item.state})` : ''}
                    </Text>
                    <Text style={styles.dateText}>
                      📅 {t('contractor.departure', 'Departure')}:{' '}
                      <Text style={{ fontWeight: '700', color: palette.text }}>
                        {item.departureDate ? new Date(item.departureDate).toLocaleDateString() : '—'}
                      </Text>
                    </Text>
                    {item.returnDate ? (
                      <Text style={styles.dateText}>
                        ↩ {t('contractor.return', 'Return')}: {new Date(item.returnDate).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>

                  {/* Travel Status Pill */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <Text style={styles.statusMutedText}>
                      {t('contractor.recordStatus', 'Status')}: <Text style={{ fontWeight: '700' }}>{item.status}</Text>
                    </Text>
                    {item.hasReport ? (
                      <View style={styles.reportSubmittedBadge}>
                        <Text style={styles.reportSubmittedText}>✓ {t('contractor.reportSubmitted', 'Report Filed')}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Prompt for Positive Travel Report */}
                  {isFlagged ? (
                    <Pressable
                      style={styles.submitReportBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/(contractor)/travel-report-form',
                          params: {
                            travelRecordId: item.travelRecordId,
                            workerId: item.workerId,
                            workerName: item.workerName,
                            destination: item.destination ?? '',
                            departureDate: item.departureDate ?? '',
                            returnDate: item.returnDate ?? '',
                          },
                        })
                      }
                    >
                      <Text style={styles.submitReportBtnText}>
                        📋 {t('contractor.submitTravelReportBtn', 'Submit High-Risk Travel Report')}
                      </Text>
                    </Pressable>
                  ) : null}
                </Card>
              );
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    padding: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabItemActive: {
    backgroundColor: '#EDF5F6',
  },
  tabText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: palette.primary,
    fontWeight: '800',
  },
  alertBanner: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: palette.warning,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
  },
  alertBannerTitle: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: '#E65100',
  },
  alertBannerBody: {
    fontSize: 11,
    color: '#BF360C',
    marginTop: 2,
    lineHeight: 15,
  },
  travelCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  travelCardFlagged: {
    borderColor: palette.danger,
    borderWidth: 2,
    backgroundColor: '#FFFBFB',
  },
  flaggedBadge: {
    backgroundColor: palette.danger,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  flaggedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  workerName: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  workerMeta: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  routeBox: {
    backgroundColor: '#F8FAFC',
    padding: spacing.xs,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  routeText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  statusMutedText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  reportSubmittedBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reportSubmittedText: {
    color: palette.success,
    fontSize: 10,
    fontWeight: '700',
  },
  submitReportBtn: {
    backgroundColor: palette.danger,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitReportBtnText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
