import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Button } from '@/components/ui';
import {
  contractorApi,
  type ContractorJoinRequest,
  type ContractorTransferRow,
} from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';

type RequestCategory = 'JOINING' | 'TRANSFERS';

export default function ContractorRequestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, selectedSiteCode } = useSession();

  const [category, setCategory] = useState<RequestCategory>('JOINING');
  const [joinRequests, setJoinRequests] = useState<ContractorJoinRequest[]>([]);
  const [transfers, setTransfers] = useState<ContractorTransferRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!token || !selectedSiteCode) return;
    try {
      if (category === 'JOINING') {
        const res = await contractorApi.joinRequests(token, selectedSiteCode);
        setJoinRequests(res.items ?? []);
      } else {
        const res = await contractorApi.transfers(token, selectedSiteCode);
        setTransfers(res.items ?? []);
      }
    } catch (e) {
      /* non-fatal */
    }
  }, [token, selectedSiteCode, category]);

  useEffect(() => {
    setLoading(true);
    void fetchRequests().finally(() => setLoading(false));
  }, [fetchRequests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  // Join request decision
  function promptJoinDecision(req: ContractorJoinRequest, approve: boolean) {
    const actionLabel = approve
      ? t('contractor.acceptRequest', 'Accept')
      : t('contractor.declineRequest', 'Decline');

    Alert.alert(
      `${actionLabel} ${t('contractor.joinRequestTitle', 'Join Request')}?`,
      approve
        ? t('contractor.confirmAcceptJoin', 'Worker will be assigned to this construction site.')
        : t('contractor.confirmDeclineJoin', 'Worker join request will be declined.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: actionLabel,
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              setBusyId(req.joinRequestId);
              await contractorApi.decideJoinRequest(token, req.joinRequestId, approve);
              await fetchRequests();
            } catch (e) {
              Alert.alert(t('common.error', 'Error'), e instanceof Error ? e.message : 'Action failed');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  // Transfer approval decision
  function promptTransferDecision(tr: ContractorTransferRow, approve: boolean) {
    const actionLabel = approve
      ? t('contractor.approveTransfer', 'Approve')
      : t('contractor.rejectTransfer', 'Reject');

    Alert.alert(
      `${actionLabel} ${t('contractor.transferTitle', 'Transfer')}?`,
      approve
        ? t('contractor.confirmApproveTransfer', 'Transfer will be approved for this site.')
        : t('contractor.confirmRejectTransfer', 'Transfer request will be rejected.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: actionLabel,
          style: approve ? 'default' : 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              setBusyId(tr.transferId);
              if (approve) {
                await contractorApi.approveTransfer(token, tr.transferId);
              } else {
                await contractorApi.rejectTransfer(token, tr.transferId, 'Rejected by contractor');
              }
              await fetchRequests();
            } catch (e) {
              Alert.alert(t('common.error', 'Error'), e instanceof Error ? e.message : 'Action failed');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1 }}>
        {/* Category Switcher Tabs */}
        <View style={styles.segmentBar}>
          <Pressable
            style={[styles.segmentTab, category === 'JOINING' ? styles.segmentTabActive : null]}
            onPress={() => setCategory('JOINING')}
          >
            <Text style={[styles.segmentText, category === 'JOINING' ? styles.segmentTextActive : null]}>
              {t('contractor.joiningRequestsTab', 'Site Joining')} ({joinRequests.filter((r) => r.status === 'PENDING').length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segmentTab, category === 'TRANSFERS' ? styles.segmentTabActive : null]}
            onPress={() => setCategory('TRANSFERS')}
          >
            <Text style={[styles.segmentText, category === 'TRANSFERS' ? styles.segmentTextActive : null]}>
              {t('contractor.transfersTab', 'Site Transfers')} ({transfers.filter((t) => t.isAwaitingMyApproval).length})
            </Text>
          </Pressable>
        </View>

        {/* Transfer Action Header */}
        {category === 'TRANSFERS' ? (
          <View style={styles.actionHeader}>
            <Text style={{ fontSize: fontSize.xs, color: palette.textMuted, flex: 1 }}>
              {t('contractor.transfersNotice', 'Inter-site worker transfers for this site.')}
            </Text>
            <Pressable
              style={styles.initiateButton}
              onPress={() => router.push('/(contractor)/initiate-transfer')}
            >
              <Text style={styles.initiateButtonText}>+ {t('contractor.initiateTransfer', 'Initiate')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* List Content */}
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : category === 'JOINING' ? (
          joinRequests.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={styles.emptyTitle}>{t('contractor.noJoiningRequests', 'No joining requests')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('contractor.noJoiningRequestsHint', 'New workers requesting to join this site will appear here.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={joinRequests}
              keyExtractor={(item) => item.joinRequestId}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
              renderItem={({ item }) => {
                const isPending = item.status === 'PENDING';
                const isBusy = busyId === item.joinRequestId;
                return (
                  <Card style={styles.requestCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestWorkerName}>{item.workerName}</Text>
                        <Text style={styles.requestWorkerMeta}>{item.workerId} · 📱 {item.phone}</Text>
                        <Text style={styles.requestWorkerDemographics}>
                          {item.age ? `${item.age} yrs` : '—'} · {item.gender ?? '—'}
                        </Text>
                      </View>
                      <StatusBadge status={item.status} />
                    </View>

                    <Text style={styles.requestDate}>
                      {t('contractor.requestedOn', 'Requested')}: {new Date(item.createdAt).toLocaleDateString()}
                    </Text>

                    {isPending ? (
                      <View style={styles.buttonRow}>
                        <Pressable
                          style={[styles.actionBtn, styles.acceptBtn, isBusy ? { opacity: 0.5 } : null]}
                          disabled={isBusy}
                          onPress={() => promptJoinDecision(item, true)}
                        >
                          <Text style={styles.btnTextWhite}>✓ {t('contractor.acceptRequest', 'Accept')}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, styles.declineBtn, isBusy ? { opacity: 0.5 } : null]}
                          disabled={isBusy}
                          onPress={() => promptJoinDecision(item, false)}
                        >
                          <Text style={styles.btnTextWhite}>✕ {t('contractor.declineRequest', 'Decline')}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Card>
                );
              }}
            />
          )
        ) : (
          transfers.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={{ fontSize: 32 }}>⇄</Text>
              <Text style={styles.emptyTitle}>{t('contractor.noTransfers', 'No transfers found')}</Text>
              <Text style={styles.emptySubtitle}>
                {t('contractor.noTransfersHint', 'Site transfer requests will appear here.')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={transfers}
              keyExtractor={(item) => item.transferId}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
              renderItem={({ item }) => {
                const isBusy = busyId === item.transferId;
                return (
                  <Card style={styles.requestCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.requestWorkerName}>{item.workerName}</Text>
                        <Text style={styles.requestWorkerMeta}>{item.workerId}</Text>
                      </View>
                      <StatusBadge status={item.status} />
                    </View>

                    <View style={styles.transferRouteBox}>
                      <Text style={styles.transferRouteText}>
                        {item.currentSite?.name ?? '—'} → <Text style={{ color: palette.primary, fontWeight: '700' }}>{item.destinationSite.name}</Text>
                      </Text>
                    </View>

                    <Text style={styles.requestDate}>
                      {t('contractor.initiatedBy', 'Initiator')}: {item.initiator === 'WORKER' ? 'Worker' : 'Contractor'} · {new Date(item.createdAt).toLocaleDateString()}
                    </Text>

                    {item.isAwaitingMyApproval ? (
                      <View style={styles.buttonRow}>
                        <Pressable
                          style={[styles.actionBtn, styles.acceptBtn, isBusy ? { opacity: 0.5 } : null]}
                          disabled={isBusy}
                          onPress={() => promptTransferDecision(item, true)}
                        >
                          <Text style={styles.btnTextWhite}>✓ {t('contractor.approveTransfer', 'Approve Transfer')}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, styles.declineBtn, isBusy ? { opacity: 0.5 } : null]}
                          disabled={isBusy}
                          onPress={() => promptTransferDecision(item, false)}
                        >
                          <Text style={styles.btnTextWhite}>✕ {t('contractor.rejectTransfer', 'Reject')}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </Card>
                );
              }}
            />
          )
        )}
      </View>
    </Screen>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isAccepted = status === 'ACCEPTED' || status === 'COMPLETED';
  const isDeclined = status === 'DECLINED' || status === 'REJECTED';
  const isPending = status.startsWith('PENDING');

  const bg = isAccepted ? '#E8F5E9' : isDeclined ? '#FFEBEE' : '#FFF8E1';
  const fg = isAccepted ? palette.success : isDeclined ? palette.danger : palette.warning;

  return (
    <View style={[styles.badgeContainer, { backgroundColor: bg }]}>
      <Text style={[styles.badgeLabel, { color: fg }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    padding: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  segmentTabActive: {
    backgroundColor: '#EDF5F6',
  },
  segmentText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: palette.primary,
    fontWeight: '800',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  initiateButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  initiateButtonText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  requestCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  requestWorkerName: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  requestWorkerMeta: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  requestWorkerDemographics: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  requestDate: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  transferRouteBox: {
    backgroundColor: '#F6F8FA',
    padding: spacing.xs,
    borderRadius: 6,
    marginTop: spacing.xs,
  },
  transferRouteText: {
    fontSize: fontSize.xs,
    color: palette.text,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: palette.success,
  },
  declineBtn: {
    backgroundColor: palette.danger,
  },
  btnTextWhite: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLabel: {
    fontSize: 10,
    fontWeight: '800',
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
});
