import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import {
  healthWorkerApi,
  type HealthWorkerProfile,
  type HealthWorkerDashboardDto,
  type HealthWorkerFacility,
  isNetworkError,
} from '@/api';
import { useSession } from '@/store/session';
import { pendingCount, flushOutbox } from '@/services/sync';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function HealthWorkerDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut, language } = useSession();

  const [profile, setProfile] = useState<HealthWorkerProfile | null>(null);
  const [stats, setStats] = useState<HealthWorkerDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queued, setQueued] = useState(0);
  const [facilityModal, setFacilityModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      try {
        await flushOutbox(token);
      } catch {
        // Offline or non-fatal outbox sync
      }
      setQueued(pendingCount());

      const prof = await healthWorkerApi.me(token);
      setProfile(prof);

      const activeFacId = prof.activeFacility?.id;
      const data = await healthWorkerApi.dashboard(token, activeFacId);
      setStats(data);
    } catch (e) {
      if (!isNetworkError(e)) {
        Alert.alert(t('common.error', 'Error'), String(e));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleSwitchFacility = async (facility: HealthWorkerFacility) => {
    if (!token) return;
    try {
      setLoading(true);
      await healthWorkerApi.setActiveFacility(token, facility.id);
      setFacilityModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert(t('common.error', 'Error'), e?.message || 'Could not switch active facility');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={styles.loadingText}>{t('common.loading', 'Loading Health Worker portal...')}</Text>
      </SafeAreaView>
    );
  }

  const activeFac = profile?.activeFacility;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header Card */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={styles.greeting}>{t('healthWorker.title', 'Health Worker Portal')}</Text>
              <AudioGuidanceButton
                text={`Welcome ${profile?.displayName || 'Health Worker'}. Active facility is ${activeFac?.name || 'Primary Health Centre'}. Total assigned workers is ${stats?.totalAssignedWorkers ?? 0}.`}
                size="small"
              />
            </View>
            <Text style={styles.hwName}>{profile?.displayName || user?.displayName}</Text>
            <Text style={styles.staffCode}>
              {t('healthWorker.staffCode', 'Staff ID')}: {profile?.staffCode || 'HW-STAFF'}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/language')}
            style={styles.langBtn}
            accessibilityRole="button"
            accessibilityLabel={t('language.changeLanguage', 'Change Language')}
          >
            <Text style={{ fontSize: 16 }}>🌐</Text>
            <Text style={styles.langText}>{(language || 'en').toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Active Facility Card with Switcher */}
        <Card style={styles.facilityCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={styles.facBadge}>{activeFac?.type || 'PHC'}</Text>
                <Text style={styles.facName}>{activeFac?.name || 'General Health Facility'}</Text>
              </View>
              <Text style={styles.facSub}>
                {activeFac?.taluka ? `${activeFac.taluka}, ${activeFac.district}` : 'Goa Health Directorate'}
              </Text>
            </View>

            {profile && profile.assignedFacilities.length > 1 ? (
              <Pressable
                onPress={() => setFacilityModal(true)}
                style={styles.switchBtn}
                accessibilityRole="button"
                accessibilityLabel="Switch Facility"
              >
                <Text style={styles.switchBtnText}>{t('healthWorker.switch', 'Switch')}</Text>
              </Pressable>
            ) : null}
          </View>
        </Card>

        {/* Offline Outbox Banner */}
        {queued > 0 ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📦 {queued} {t('sync.pendingUploads', 'records stored offline. Will sync when online.')}
            </Text>
          </View>
        ) : null}

        {/* Surveillance Statistics Summary */}
        <Text style={styles.sectionTitle}>{t('healthWorker.surveillanceStats', 'Facility Surveillance Overview')}</Text>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { borderLeftColor: palette.primary }]}>
            <Text style={styles.statVal}>{stats?.totalAssignedWorkers ?? 0}</Text>
            <Text style={styles.statLabel}>{t('healthWorker.totalWorkers', 'Assigned Workers')}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: palette.warning }]}>
            <Text style={styles.statVal}>{stats?.awaitingScreening ?? 0}</Text>
            <Text style={styles.statLabel}>{t('healthWorker.awaitingScreening', 'Awaiting Screening')}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: palette.success }]}>
            <Text style={styles.statVal}>{stats?.screenedCount ?? 0}</Text>
            <Text style={styles.statLabel}>{t('healthWorker.screened', 'Screened')}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.statVal}>{stats?.suspectedCases ?? 0}</Text>
            <Text style={styles.statLabel}>{t('healthWorker.suspectedCases', 'Suspected Malaria')}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: palette.danger }]}>
            <Text style={[styles.statVal, { color: palette.danger }]}>{stats?.confirmedPositiveCases ?? 0}</Text>
            <Text style={styles.statLabel}>{t('healthWorker.confirmedPositive', 'Confirmed Positive')}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftColor: '#10B981' }]}>
            <Text style={[styles.statVal, { color: '#10B981' }]}>{stats?.confirmedNegativeCases ?? 0}</Text>
            <Text style={styles.statLabel}>{t('healthWorker.confirmedNegative', 'Confirmed Negative')}</Text>
          </View>
        </View>

        {/* Primary Action Modules (Large Touch Targets >= 48dp) */}
        <Text style={styles.sectionTitle}>{t('healthWorker.actionsTitle', 'Surveillance Actions')}</Text>

        <View style={styles.actionGrid}>
          {/* 1. Worker & Family Search */}
          <Pressable
            onPress={() => router.push('/(health-worker)/search')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#E0E7FF' }]}>
              <Text style={styles.actionIcon}>🔍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{t('healthWorker.searchWorkers', 'Worker & Household Search')}</Text>
              <Text style={styles.actionDesc}>
                {t('healthWorker.searchDesc', 'Search by Worker ID, Name, Phone, or QR Pass')}
              </Text>
            </View>
          </Pressable>

          {/* 2. Assisted Screening */}
          <Pressable
            onPress={() => router.push('/(health-worker)/screening')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#DCFCE7' }]}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{t('healthWorker.assistedScreening', 'Assisted Health Screening')}</Text>
              <Text style={styles.actionDesc}>
                {t('healthWorker.screeningDesc', 'Administer initial questionnaire & clinical observations')}
              </Text>
            </View>
          </Pressable>

          {/* 3. Record Suspected Case */}
          <Pressable
            onPress={() => router.push('/(health-worker)/case-form')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#FEF3C7' }]}>
              <Text style={styles.actionIcon}>🤒</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>{t('healthWorker.recordCase', 'Record Suspected Case & RDT')}</Text>
              <Text style={styles.actionDesc}>
                {t('healthWorker.recordCaseDesc', 'Open suspected episode and initiate diagnostic test')}
              </Text>
            </View>
          </Pressable>

          {/* 4. Follow-up Check-ins */}
          <Pressable
            onPress={() => router.push('/(health-worker)/followups')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#F3E8FF' }]}>
              <Text style={styles.actionIcon}>🩺</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.actionTitle}>{t('healthWorker.followups', 'Follow-up Management')}</Text>
                {stats && stats.pendingFollowUps > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{stats.pendingFollowUps}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionDesc}>
                {t('healthWorker.followupsDesc', 'Record adherence visits, recovery, and referral attendance')}
              </Text>
            </View>
          </Pressable>

          {/* 5. Travel & Arrival Screening */}
          <Pressable
            onPress={() => router.push('/(health-worker)/arrivals')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#E0F2FE' }]}>
              <Text style={styles.actionIcon}>✈️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.actionTitle}>{t('healthWorker.travelArrivals', 'Travel Arrivals Screening')}</Text>
                {stats && stats.newTravelArrivals > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{stats.newTravelArrivals}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionDesc}>
                {t('healthWorker.arrivalsDesc', 'Screen workers entering Goa on their existing travel journey')}
              </Text>
            </View>
          </Pressable>

          {/* 6. Feeling Unwell Reports */}
          <Pressable
            onPress={() => router.push('/(health-worker)/symptom-reports')}
            style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <View style={[styles.actionIconBg, { backgroundColor: '#FFE4E6' }]}>
              <Text style={styles.actionIcon}>🚨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.actionTitle}>{t('healthWorker.unwellReports', 'Feeling Unwell Reports')}</Text>
                {stats && stats.newFeelingUnwellReports > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{stats.newFeelingUnwellReports}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.actionDesc}>
                {t('healthWorker.unwellDesc', 'Review non-stigmatizing alerts and take clinical action')}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Sign Out Button */}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label={t('auth.signOut', 'Sign Out')}
            variant="ghost"
            onPress={() => signOut()}
          />
        </View>
      </ScrollView>

      {/* Facility Switcher Modal */}
      <Modal visible={facilityModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('healthWorker.selectFacility', 'Select Active Facility')}</Text>
            <Body style={{ marginBottom: spacing.md }}>
              {t('healthWorker.selectFacilityDesc', 'Switch surveillance context between your assigned PHCs and UHCs.')}
            </Body>

            {profile?.assignedFacilities.map((fac) => {
              const isSelected = fac.id === activeFac?.id;
              return (
                <Pressable
                  key={fac.id}
                  onPress={() => handleSwitchFacility(fac)}
                  style={[styles.facSelectItem, isSelected && styles.facSelectActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.facSelectName, isSelected && { color: palette.primary }]}>{fac.name}</Text>
                    <Text style={styles.facSelectSub}>{fac.type} · {fac.taluka}, {fac.district}</Text>
                  </View>
                  {isSelected ? <Text style={{ fontSize: 18, color: palette.primary }}>✓</Text> : null}
                </Pressable>
              );
            })}

            <View style={{ marginTop: spacing.lg }}>
              <Button label={t('common.cancel', 'Cancel')} variant="ghost" onPress={() => setFacilityModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.bg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.textMuted,
    fontSize: fontSize.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    color: palette.primary,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  hwName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginTop: 2,
  },
  staffCode: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    marginTop: 2,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.primary,
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
  },
  langText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: palette.primary,
  },
  facilityCard: {
    marginBottom: spacing.md,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
  },
  facBadge: {
    backgroundColor: '#EEF2FF',
    color: palette.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  facName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  facSub: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 3,
  },
  switchBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  switchBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  offlineText: {
    fontSize: fontSize.sm,
    color: '#92400E',
    fontWeight: fontWeight.medium,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    ...shadow.card,
  },
  statVal: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  actionGrid: {
    gap: spacing.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 72,
    ...shadow.card,
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  actionIcon: {
    fontSize: 22,
  },
  actionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  actionDesc: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  badge: {
    backgroundColor: palette.danger,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginBottom: 4,
  },
  facSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.xs,
    minHeight: 48,
  },
  facSelectActive: {
    borderColor: palette.primary,
    backgroundColor: '#F0F9FF',
  },
  facSelectName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  facSelectSub: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
});
