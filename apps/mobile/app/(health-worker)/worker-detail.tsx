import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { healthWorkerApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function WorkerDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();
  const { workerId } = useLocalSearchParams<{ workerId: string }>();

  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!token || !workerId) return;
    try {
      const data = await healthWorkerApi.worker(token, workerId);
      setWorker(data);
    } catch (e: any) {
      if (!isNetworkError(e)) {
        Alert.alert(t('common.error', 'Error'), e?.message || 'Could not load worker details');
      }
    } finally {
      setLoading(false);
    }
  }, [token, workerId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading && !worker) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  const screening = worker?.screening;
  const site = worker?.assignments?.[0]?.site;
  const episodes = worker?.episodes || [];
  const household = worker?.householdMembers || [];
  const travels = worker?.travelRecords || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}>
        {/* Worker Demographics Card */}
        <Card style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{worker?.name}</Text>
              <Text style={styles.code}>ID: {worker?.workerCode}</Text>
              <Text style={styles.detail}>📱 {worker?.phone} · 🌐 {(worker?.preferredLanguage || 'en').toUpperCase()}</Text>
              <Text style={styles.detail}>🏗️ Site: {site?.name || t('healthWorker.notAssigned', 'Unassigned')}</Text>
            </View>
            <AudioGuidanceButton
              text={`Worker surveillance record for ${worker?.name}. Screening status is ${screening?.status || 'not completed'}. Total recorded episodes is ${episodes.length}.`}
              size="small"
            />
          </View>
        </Card>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push(`/(health-worker)/screening?workerId=${worker?.id}&workerName=${encodeURIComponent(worker?.name)}`)}
            style={styles.actionBtn}
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnIcon}>📋</Text>
            <Text style={styles.actionBtnText}>{t('healthWorker.screen', 'Screen Worker')}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/(health-worker)/case-form?workerId=${worker?.id}&workerName=${encodeURIComponent(worker?.name)}`)}
            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnIcon}>🤒</Text>
            <Text style={styles.actionBtnText}>{t('healthWorker.suspectedCase', 'Record Case')}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push(`/(health-worker)/followups?workerId=${worker?.id}`)}
            style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
            accessibilityRole="button"
          >
            <Text style={styles.actionBtnIcon}>🩺</Text>
            <Text style={styles.actionBtnText}>{t('healthWorker.followup', 'Follow-up')}</Text>
          </Pressable>
        </View>

        {/* Initial Screening Status */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>{t('healthWorker.initialScreening', 'Initial Screening')}</Text>
          {screening ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
                <Text style={styles.badge}>{screening.status}</Text>
                <Text style={styles.detail}>
                  Completed: {screening.completedAt ? new Date(screening.completedAt).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              <Text style={styles.detail}>
                Facility: {screening.facility?.name || 'General Health Centre'}
              </Text>
              <Text style={styles.detail}>
                Screened By: {screening.screenedBy?.displayName || 'Health Worker'}
              </Text>
            </View>
          ) : (
            <Body style={{ color: palette.textMuted }}>
              {t('healthWorker.noScreeningCompleted', 'Worker has not completed initial baseline health screening.')}
            </Body>
          )}
        </Card>

        {/* Clinical History & Episodes */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>
            {t('healthWorker.clinicalEpisodes', 'Clinical History & Tests')} ({episodes.length})
          </Text>
          {episodes.length === 0 ? (
            <Body style={{ color: palette.textMuted }}>{t('healthWorker.noEpisodes', 'No malaria episodes on record.')}</Body>
          ) : (
            episodes.map((ep: any) => (
              <View key={ep.id} style={styles.historyRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.historyTitle}>Episode: {ep.status}</Text>
                  <Text style={styles.historyDate}>{new Date(ep.createdAt).toLocaleDateString()}</Text>
                </View>
                {ep.diagnostics?.map((diag: any) => (
                  <Text key={diag.id} style={styles.historyDiag}>
                    🔬 {diag.testType}: <Text style={{ fontWeight: fontWeight.bold }}>{diag.result}</Text> ({diag.species || 'Species N/A'})
                  </Text>
                ))}
              </View>
            ))
          )}
        </Card>

        {/* Registered Household Members */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>
            {t('healthWorker.familyMembers', 'Family & Roommates')} ({household.length})
          </Text>
          {household.length === 0 ? (
            <Body style={{ color: palette.textMuted }}>{t('healthWorker.noFamily', 'No family members or roommates registered.')}</Body>
          ) : (
            household.map((hh: any) => (
              <View key={hh.id} style={styles.historyRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>{hh.fullName || 'Member'}</Text>
                    <Text style={styles.detail}>{hh.memberCode} · {hh.relationship}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push(`/(health-worker)/screening?memberId=${hh.id}&memberName=${encodeURIComponent(hh.fullName || '')}`)}
                    style={styles.smallScreenBtn}
                  >
                    <Text style={styles.smallScreenBtnText}>{t('healthWorker.screen', 'Screen')}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Travel History */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeader}>
            {t('healthWorker.travelHistory', 'Recent Travel Records')} ({travels.length})
          </Text>
          {travels.length === 0 ? (
            <Body style={{ color: palette.textMuted }}>{t('healthWorker.noTravel', 'No travel records recorded.')}</Body>
          ) : (
            travels.slice(0, 3).map((tr: any) => (
              <View key={tr.id} style={styles.historyRow}>
                <Text style={styles.historyTitle}>
                  {tr.direction === 'ENTERING_GOA' ? '📥 Entering Goa' : '📤 Leaving Goa'}
                </Text>
                <Text style={styles.detail}>
                  {tr.originState ? `From: ${tr.originState}` : tr.state ? `To: ${tr.state}` : 'State N/A'}
                </Text>
                <Text style={styles.detail}>
                  Fever/Malaria: {tr.hadFeverOrMalaria ? '⚠️ Reported Fever' : 'None reported'}
                </Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.md,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  code: {
    fontSize: fontSize.sm,
    color: palette.primary,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },
  detail: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...shadow.card,
  },
  actionBtnIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  sectionHeader: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  historyTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  historyDate: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  historyDiag: {
    fontSize: fontSize.xs,
    color: palette.text,
    marginTop: 2,
  },
  smallScreenBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  smallScreenBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});
