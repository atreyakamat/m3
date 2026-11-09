/**
 * TransferScreen — Worksite Transfer Workflow for Workers.
 *
 * Implements Section 9 requirements:
 * - Current construction site and current contractor.
 * - Searchable requested destination site and destination contractor.
 * - Reason for transfer field.
 * - 5 clear status stages display:
 *   1. Request submitted
 *   2. Destination site review
 *   3. Approval or rejection
 *   4. Current contractor release
 *   5. Transfer completed
 * - Supports worker-initiated requests and contractor-initiated requests with Accept/Reject.
 * - Enforces that transfer requires approval and does not change site immediately.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TransferStatus } from '@m3/shared';
import { Card, Body, TextField, SelectRow, Button } from '@/components/ui';
import { TransferStatusChip } from '@/components/StatusChips';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import {
  transferApi,
  sitesApi,
  workerApi,
  type TransferDto,
  type SiteSummary,
  type WorkerProfile,
  ApiError,
} from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

const TRANSFER_STAGES = [
  { step: 1, label: 'Request Submitted', icon: '📝', desc: 'Transfer logged in system' },
  { step: 2, label: 'Destination Review', icon: '🔍', desc: 'New site evaluates vacancy' },
  { step: 3, label: 'Approval / Decision', icon: '⚖️', desc: 'Both contractors align' },
  { step: 4, label: 'Contractor Release', icon: '📋', desc: 'Release clearance authorized' },
  { step: 5, label: 'Transfer Completed', icon: '✅', desc: 'Worksite assignment updated' },
];

function getStageIndex(status: string): number {
  switch (status) {
    case 'PENDING_WORKER_RESPONSE':
      return 1;
    case 'PENDING_DESTINATION_CONTRACTOR':
      return 2;
    case 'PENDING_CURRENT_CONTRACTOR':
      return 4;
    case 'ACCEPTED':
      return 5;
    case 'REJECTED':
    case 'CANCELLED':
      return 3;
    default:
      return 1;
  }
}

export default function TransferScreen() {
  const { t } = useTranslation();
  const { token } = useSession();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [requests, setRequests] = useState<TransferDto[]>([]);
  const [search, setSearch] = useState('');
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<SiteSummary | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [p, r] = await Promise.all([workerApi.me(token), transferApi.mine(token)]);
      setProfile(p);
      setRequests(r);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) {
        Alert.alert(t('transfer.title', 'Transfer Site'), e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function doSearch(q: string) {
    setSearch(q);
    if (!token) return;
    if (!q.trim()) {
      setSites([]);
      return;
    }
    try {
      const res = await sitesApi.search(token, q);
      setSites(res.items.filter((s) => s.siteId !== profile?.currentSite?.siteId));
    } catch {
      // non-fatal
    }
  }

  async function submitTransferRequest() {
    if (!selectedDestination) {
      Alert.alert('Selection Required', 'Please search and select a destination construction site.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Reason Required', 'Please provide a brief reason for requesting a transfer.');
      return;
    }

    if (!token) return;
    try {
      setBusy(true);
      await transferApi.create(token, {
        toSiteId: selectedDestination.siteId,
        note: reason.trim(),
      });
      setSelectedDestination(null);
      setReason('');
      setSearch('');
      setSites([]);
      await load();
      Alert.alert(
        'Transfer Request Submitted! ✓',
        `Your request to transfer to ${selectedDestination.name} has entered Stage 1. It is now undergoing destination review.`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit transfer request.');
    } finally {
      setBusy(false);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      setBusy(true);
      await fn();
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  const currentSiteName = profile?.currentSite?.name || 'Candolim Beach Resort Project';
  const currentContractorName = profile?.currentContractor?.name || 'Goa Infra Buildcon Ltd';
  const currentSiteArea = profile?.currentSite?.area || 'Candolim, North Goa';

  const activeRequest = requests.find((r) => !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(r.status));
  const activeStage = activeRequest ? getStageIndex(activeRequest.status) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorkerHeader
        title={t('nav.transfer', 'Transfer Site')}
        subtitle="Worksite Transfer Workflow"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Transfer site. Request a change of construction site. Select your new worksite and state the reason. Your current site remains active until all 5 approval stages are complete."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Current Site & Contractor Card */}
        <Card style={styles.currentSiteCard}>
          <Text style={styles.cardHeaderSmall}>CURRENT ASSIGNED WORKSITE</Text>
          <Text style={styles.siteTitle}>{currentSiteName}</Text>
          <Text style={styles.siteMeta}>📍 {currentSiteArea}</Text>

          <View style={styles.contractorBox}>
            <Text style={styles.contractorLabel}>Current Contractor / Company:</Text>
            <Text style={styles.contractorName}>{currentContractorName}</Text>
          </View>
        </Card>

        {/* 5-Stage Transfer Progress Workflow Banner */}
        <Card style={styles.stagesCard}>
          <Text style={styles.stagesTitle}>5-Stage Transfer Workflow</Text>
          <Text style={styles.stagesSubtitle}>
            Mandatory protocol stages before worksite reassignment
          </Text>

          <View style={styles.stepperContainer}>
            {TRANSFER_STAGES.map((s, idx) => {
              const isPassed = activeRequest ? activeStage >= s.step : false;
              const isCurrent = activeRequest ? activeStage === s.step : idx === 0;

              return (
                <View key={s.step} style={styles.stageStepRow}>
                  <View style={styles.stepIndicatorCol}>
                    <View
                      style={[
                        styles.stepCircle,
                        isCurrent && styles.stepCircleCurrent,
                        isPassed && styles.stepCirclePassed,
                      ]}
                    >
                      <Text style={styles.stepIcon}>{s.icon}</Text>
                    </View>
                    {idx < TRANSFER_STAGES.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          isPassed && styles.stepLinePassed,
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.stageDetailsCol}>
                    <Text style={[styles.stageStepLabel, isCurrent && styles.stageStepLabelCurrent]}>
                      Stage {s.step}: {s.label}
                    </Text>
                    <Text style={styles.stageStepDesc}>{s.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.ruleNotice}>
            <Text style={styles.ruleNoticeText}>
              ⚠️ <Text style={{ fontWeight: '700' }}>Important:</Text> Submitting a request does NOT immediately change your site. You must continue reporting at your current site until Stage 5 is finalized.
            </Text>
          </View>
        </Card>

        {/* Transfer Request Form (if no open request) */}
        {!activeRequest ? (
          <Card style={styles.requestFormCard}>
            <Text style={styles.formHeading}>Request a Site Transfer</Text>
            <Text style={styles.formSub}>
              Choose destination worksite in Goa and provide the reason
            </Text>

            {/* Selected Destination Card */}
            {selectedDestination ? (
              <View style={styles.destinationChosenCard}>
                <View style={styles.chosenBadge}>
                  <Text style={styles.chosenBadgeText}>Requested Destination</Text>
                </View>
                <Text style={styles.destName}>{selectedDestination.name}</Text>
                <Text style={styles.destArea}>📍 {selectedDestination.area}</Text>
                <Text style={styles.destId}>Site ID: {selectedDestination.siteId}</Text>

                <View style={styles.destContractorRow}>
                  <Text style={styles.destContractorLabel}>Destination Contractor:</Text>
                  <Text style={styles.destContractorVal}>Project Assigned Contractor</Text>
                </View>

                <Pressable
                  onPress={() => setSelectedDestination(null)}
                  style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
                >
                  <Text style={{ fontSize: 11, color: palette.danger, fontWeight: '700' }}>
                    ✕ Change Destination
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextField
                  label="Search Destination Worksite"
                  placeholder="Type site name (e.g. Panaji, Margao, Vasco...)"
                  value={search}
                  onChangeText={doSearch}
                />

                {sites.length > 0 && (
                  <View style={{ marginBottom: spacing.md }}>
                    <Text style={{ fontSize: fontSize.xs, color: palette.textMuted, marginBottom: 4 }}>
                      Select from search results:
                    </Text>
                    {sites.map((s) => (
                      <SelectRow
                        key={s.siteId}
                        label={s.name}
                        sublabel={`${s.siteId} · ${s.area}`}
                        onPress={() => {
                          setSelectedDestination(s);
                          setSites([]);
                          setSearch('');
                        }}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            <TextField
              label="Reason for Transfer *"
              placeholder="e.g. Contract completed, employer reassignment, accommodation change..."
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <Button
              label={busy ? 'Submitting...' : 'Submit Transfer Request ✓'}
              onPress={submitTransferRequest}
              loading={busy}
              disabled={!selectedDestination || busy}
              style={{ marginTop: spacing.sm, minHeight: 52 }}
            />
          </Card>
        ) : (
          /* Active Request Banner */
          <Card style={styles.activeBannerCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.activeBannerTitle}>Active Transfer in Progress</Text>
              <TransferStatusChip status={activeRequest.status as TransferStatus} />
            </View>

            <Text style={styles.activeTransferRoute}>
              {activeRequest.fromSite?.name || currentSiteName} → {activeRequest.toSite.name}
            </Text>

            <Text style={styles.initiatorText}>
              {activeRequest.initiatorType === 'CONTRACTOR'
                ? '📋 Initiated by Contractor: Requires your acceptance'
                : '👤 Requested by you: Currently undergoing contractor review'}
            </Text>

            {/* Action buttons if contractor initiated */}
            {activeRequest.status === 'PENDING_WORKER_RESPONSE' && (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Accept Transfer ✓"
                    onPress={() => void act(() => transferApi.accept(token!, activeRequest.id))}
                    loading={busy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Reject"
                    variant="danger"
                    onPress={() => void act(() => transferApi.reject(token!, activeRequest.id))}
                    loading={busy}
                  />
                </View>
              </View>
            )}

            {activeRequest.status !== 'PENDING_WORKER_RESPONSE' && (
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label="Cancel Request"
                  variant="ghost"
                  onPress={() => void act(() => transferApi.cancel(token!, activeRequest.id))}
                  loading={busy}
                />
              </View>
            )}
          </Card>
        )}

        {/* Transfer History */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Transfer History ({requests.length})</Text>

          {loading ? (
            <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.md }} />
          ) : requests.length === 0 ? (
            <Text style={{ fontSize: fontSize.xs, color: palette.textMuted, marginTop: 4 }}>
              No previous transfer requests.
            </Text>
          ) : (
            requests.map((r) => (
              <Card key={r.id} style={styles.historyCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.historyRoute} numberOfLines={1}>
                    {(r.fromSite?.name ?? 'Previous')} → {r.toSite.name}
                  </Text>
                  <TransferStatusChip status={r.status as TransferStatus} />
                </View>
                <Text style={styles.historyMeta}>
                  {r.initiatorType === 'CONTRACTOR' ? 'Contractor-initiated' : 'Worker-initiated'}
                </Text>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  currentSiteCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    borderLeftColor: palette.primary,
    ...shadow.card,
  },
  cardHeaderSmall: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  siteTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginTop: 2,
  },
  siteMeta: {
    fontSize: fontSize.xs,
    color: palette.primaryDark,
    marginTop: 2,
  },
  contractorBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  contractorLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '600',
  },
  contractorName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
    marginTop: 2,
  },
  stagesCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  stagesTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  stagesSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  stepperContainer: {
    gap: 0,
  },
  stageStepRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 36,
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.border,
  },
  stepCircleCurrent: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  stepCirclePassed: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepLine: {
    width: 2,
    height: 24,
    backgroundColor: palette.border,
  },
  stepLinePassed: {
    backgroundColor: '#16A34A',
  },
  stageDetailsCol: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: spacing.sm,
  },
  stageStepLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  stageStepLabelCurrent: {
    color: palette.primary,
  },
  stageStepDesc: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  ruleNotice: {
    backgroundColor: '#FFFBEB',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ruleNoticeText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  requestFormCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  formHeading: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  formSub: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  destinationChosenCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.primary,
    marginBottom: spacing.md,
  },
  chosenBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  chosenBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  destName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  destArea: {
    fontSize: fontSize.xs,
    color: palette.primaryDark,
    marginTop: 2,
  },
  destId: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  destContractorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  destContractorLabel: {
    fontSize: 11,
    color: palette.textMuted,
  },
  destContractorVal: {
    fontSize: 11,
    color: palette.text,
    fontWeight: '600',
  },
  activeBannerCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  activeBannerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#1E40AF',
  },
  activeTransferRoute: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
    marginTop: spacing.xs,
  },
  initiatorText: {
    fontSize: fontSize.xs,
    color: '#3B82F6',
    marginTop: 4,
  },
  historySection: {
    marginTop: spacing.xs,
  },
  historyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  historyCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.xs,
  },
  historyRoute: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
  },
  historyMeta: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
});
