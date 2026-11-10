/**
 * TransferScreen — Master Implementation.
 *
 * Implements Section 11 requirements:
 * 1. Current Site: Shows worker's currently assigned site.
 * 2. Search or Select a Site:
 *    - Search field by site name or area
 *    - Selectable list of available sites
 *    - Select one destination site
 * 3. Current Location:
 *    - Capture Device Location action
 *    - Captures GPS coordinates upon activation
 *    - Shows captured-location state
 * 4. Submit Transfer Request:
 *    - No contractor name request
 *    - No destination contractor selection
 *    - No unnecessary reason fields
 *    - Saves destination site, coordinates & submission timestamp
 * 5. Displays appropriate transfer request status.
 * 6. Amber/orange accent theme (#D97706).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TransferStatus } from '@m3/shared';
import { Card, TextField, Button } from '@/components/ui';
import { TransferStatusChip } from '@/components/StatusChips';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { LocationCaptureCard } from '@/components/LocationCaptureCard';
import { type CapturedLocation } from '@/services/location';
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

export default function TransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [requests, setRequests] = useState<TransferDto[]>([]);
  const [search, setSearch] = useState('');
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<SiteSummary | null>(null);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [p, r] = await Promise.all([
        workerApi.me(token).catch(() => null),
        transferApi.mine(token).catch(() => [] as TransferDto[]),
      ]);
      if (p) setProfile(p);
      setRequests(r);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) {
        Alert.alert('Transfer Site', e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  // Search sites by name or area
  async function handleSearch(q: string) {
    setSearch(q);
    if (!token) return;
    if (!q.trim()) {
      setSites([]);
      return;
    }
    try {
      const res = await sitesApi.search(token, q);
      // Filter out current site
      setSites(res.items.filter((s) => s.siteId !== profile?.currentSite?.siteId));
    } catch {
      // Non-fatal
    }
  }

  async function submitTransferRequest() {
    if (!selectedDestination) {
      Alert.alert('Selection Required', 'Please search and select a destination construction site.');
      return;
    }

    if (!token) return;
    try {
      setBusy(true);
      const timestamp = new Date().toISOString();
      const note = location
        ? `Worker-initiated transfer. GPS: ${location.formattedText} at ${timestamp}`
        : `Worker-initiated transfer requested at ${timestamp}`;

      await transferApi.create(token, {
        toSiteId: selectedDestination.siteId,
        note,
      });

      setSelectedDestination(null);
      setSearch('');
      setSites([]);
      await loadData();
      Alert.alert(
        'Transfer Request Submitted! ✓',
        `Your request to move to ${selectedDestination.name} has been submitted for contractor clearance and review.`
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
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  const currentSiteName = profile?.currentSite?.name || 'Candolim Beach Resort Project';
  const currentSiteArea = profile?.currentSite?.area || 'Candolim, North Goa';
  const currentSiteId = profile?.currentSite?.siteId || 'SITE-SIM01';

  const activeRequest = requests.find(
    (r) => !['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(r.status)
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Transfer Site"
        subtitle="Worksite Reassignment"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Transfer site. Request a change of worksite. Select your destination site, capture your device location, and submit your transfer request."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🔄</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Worksite Transfer Request</Text>
            <Text style={styles.bannerText}>
              Your current site assignment remains active until transfer approvals are finalized.
            </Text>
          </View>
        </View>

        {/* 1. Current Site */}
        <Card style={styles.card}>
          <Text style={styles.cardHeaderSmall}>CURRENT ASSIGNED SITE</Text>
          <Text style={styles.currentSiteName}>{currentSiteName}</Text>
          <Text style={styles.currentSiteArea}>📍 {currentSiteArea}</Text>
          <Text style={styles.currentSiteId}>Site ID: {currentSiteId}</Text>
        </Card>

        {/* 2. Active Transfer in Progress (if any) */}
        {activeRequest ? (
          <Card style={styles.activeBannerCard}>
            <View style={styles.activeHeader}>
              <Text style={styles.activeBannerTitle}>Transfer Request in Progress</Text>
              <TransferStatusChip status={activeRequest.status as TransferStatus} />
            </View>

            <Text style={styles.activeRouteText}>
              {activeRequest.fromSite?.name || currentSiteName} → {activeRequest.toSite.name}
            </Text>

            <Text style={styles.initiatorText}>
              {activeRequest.initiatorType === 'CONTRACTOR'
                ? '📋 Initiated by Contractor: Requires your acceptance'
                : '👤 Requested by you: Currently undergoing review and release clearance'}
            </Text>

            {/* Contractor-initiated accept/reject */}
            {activeRequest.status === 'PENDING_WORKER_RESPONSE' && (
              <View style={styles.decisionRow}>
                <Pressable
                  onPress={() => void act(() => transferApi.accept(token!, activeRequest.id))}
                  disabled={busy}
                  style={[styles.decisionBtn, { backgroundColor: '#16A34A' }]}
                >
                  <Text style={styles.decisionBtnText}>Accept Transfer ✓</Text>
                </Pressable>
                <Pressable
                  onPress={() => void act(() => transferApi.reject(token!, activeRequest.id))}
                  disabled={busy}
                  style={[styles.decisionBtn, { backgroundColor: '#DC2626' }]}
                >
                  <Text style={styles.decisionBtnText}>Reject</Text>
                </Pressable>
              </View>
            )}

            {/* Cancel option */}
            {activeRequest.status !== 'PENDING_WORKER_RESPONSE' && (
              <Pressable
                onPress={() => void act(() => transferApi.cancel(token!, activeRequest.id))}
                disabled={busy}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel Transfer Request</Text>
              </Pressable>
            )}
          </Card>
        ) : (
          /* 3. Search or Select Destination Site */
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Search or Select Destination Site *</Text>
            <Text style={styles.cardSubtitle}>
              Find the new construction worksite in Goa you are moving to
            </Text>

            {selectedDestination ? (
              <View style={styles.selectedSiteCard}>
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>Selected Destination</Text>
                </View>
                <Text style={styles.selectedSiteTitle}>{selectedDestination.name}</Text>
                <Text style={styles.selectedSiteArea}>📍 {selectedDestination.area}</Text>
                <Text style={styles.selectedSiteId}>Site ID: {selectedDestination.siteId}</Text>

                <Pressable
                  onPress={() => setSelectedDestination(null)}
                  style={styles.changeLink}
                >
                  <Text style={styles.changeLinkText}>✕ Choose Different Site</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextField
                  placeholder="Type site name or area (e.g. Panaji, Margao, Vasco...)"
                  value={search}
                  onChangeText={handleSearch}
                />

                {sites.length > 0 && (
                  <View style={styles.resultsList}>
                    <Text style={styles.resultsHeading}>Available Worksites:</Text>
                    {sites.map((s) => (
                      <Pressable
                        key={s.siteId}
                        onPress={() => {
                          setSelectedDestination(s);
                          setSites([]);
                          setSearch('');
                        }}
                        style={styles.resultItem}
                      >
                        <Text style={styles.resultName}>{s.name}</Text>
                        <Text style={styles.resultMeta}>
                          {s.siteId} · 📍 {s.area}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* 4. Current Location */}
            <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
              <LocationCaptureCard
                location={location}
                onLocationCaptured={setLocation}
                accentColor="#D97706" // Amber/Orange
                title="Current Location"
                buttonLabel="Capture Device Location"
              />
            </View>

            {/* 5. Submit Transfer Request */}
            <Pressable
              onPress={submitTransferRequest}
              disabled={!selectedDestination || busy}
              style={[
                styles.submitBtn,
                (!selectedDestination || busy) && { opacity: 0.6 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit</Text>
              )}
            </Pressable>
          </Card>
        )}

        {/* Transfer History */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Transfer History ({requests.length})</Text>
          {loading ? (
            <ActivityIndicator color="#D97706" style={{ marginTop: spacing.sm }} />
          ) : requests.length === 0 ? (
            <Text style={styles.emptyHistoryText}>No previous transfer requests logged.</Text>
          ) : (
            requests.map((r) => (
              <Card key={r.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyRouteText} numberOfLines={1}>
                    {(r.fromSite?.name ?? 'Previous')} → {r.toSite.name}
                  </Text>
                  <TransferStatusChip status={r.status as TransferStatus} />
                </View>
                <Text style={styles.historyMetaText}>
                  {r.initiatorType === 'CONTRACTOR' ? 'Contractor-initiated' : 'Worker-initiated'} •{' '}
                  {new Date(r.createdAt).toLocaleDateString()}
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
  banner: {
    backgroundColor: '#FFFBEB', // Light amber
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bannerIcon: {
    fontSize: 32,
  },
  bannerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: '#B45309',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: '#D97706',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  cardHeaderSmall: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  currentSiteName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
    marginTop: 2,
  },
  currentSiteArea: {
    fontSize: fontSize.xs,
    color: '#D97706',
    marginTop: 2,
  },
  currentSiteId: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  selectedSiteCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  selectedBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  selectedSiteTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0F172A',
  },
  selectedSiteArea: {
    fontSize: fontSize.xs,
    color: '#B45309',
    marginTop: 2,
  },
  selectedSiteId: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  changeLink: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  changeLinkText: {
    fontSize: 11,
    color: palette.danger,
    fontWeight: '700',
  },
  resultsList: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: radius.md,
    backgroundColor: '#F8FAFC',
    maxHeight: 200,
  },
  resultsHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
    padding: spacing.xs,
    paddingLeft: spacing.sm,
    backgroundColor: '#F1F5F9',
  },
  resultItem: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  resultName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultMeta: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  submitBtn: {
    backgroundColor: '#D97706', // Amber/orange accent
    minHeight: 52,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  activeBannerCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: '#F59E0B',
    ...shadow.card,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  activeBannerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#B45309',
  },
  activeRouteText: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  initiatorText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  decisionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decisionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: fontSize.xs,
    color: palette.danger,
    fontWeight: '600',
  },
  historySection: {
    marginTop: spacing.xs,
  },
  historyTitle: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  emptyHistoryText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  historyCard: {
    backgroundColor: palette.surface,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyRouteText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  historyMetaText: {
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 2,
  },
});
