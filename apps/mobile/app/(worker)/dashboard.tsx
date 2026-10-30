import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { MalariaStatusChip, SyncStateChip } from '@/components/StatusChips';
import { workerApi, type WorkerProfile, ApiError, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { pendingCount } from '@/services/sync';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

const ACTIONS: { key: string; route: string; i18n: string; color: string }[] = [
  { key: 'screening', route: '/(worker)/screening', i18n: 'nav.screening', color: palette.primary },
  { key: 'site', route: '/(worker)/site', i18n: 'nav.site', color: palette.secondary },
  { key: 'transfer', route: '/(worker)/transfer', i18n: 'nav.transfer', color: palette.info },
  { key: 'malaria', route: '/(worker)/malaria', i18n: 'nav.malaria', color: palette.accent },
  { key: 'prescriptions', route: '/(worker)/prescriptions', i18n: 'nav.prescriptions', color: palette.success },
  { key: 'unwell', route: '/(worker)/unwell', i18n: 'nav.feelingUnwell', color: palette.warning },
  { key: 'followups', route: '/(worker)/followups', i18n: 'nav.followUps', color: palette.primaryLight },
  { key: 'profile', route: '/(worker)/profile', i18n: 'nav.profile', color: palette.textMuted },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setProfile(await workerApi.me(token));
      setOffline(false);
    } catch (e) {
      if (isNetworkError(e)) setOffline(true);
      else if (e instanceof ApiError && e.status === 401) void signOut();
    } finally {
      setLoading(false);
      try { setQueued(pendingCount()); } catch { /* db not ready in some envs */ }
    }
  }, [token, signOut]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      {/* Coloured header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: palette.primary }}>
        <View style={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
          <Text style={{ color: palette.primarySoft, fontSize: fontSize.sm }}>{t('app.name')}</Text>
          <Text style={{ color: palette.textOnColor, fontSize: fontSize.xxl, fontWeight: '800' }}>
            {t('dashboard.greeting', { name: user?.displayName ?? '' })}
          </Text>
          {user?.workerId ? (
            <Text style={{ color: palette.primarySoft, marginTop: 4 }}>
              {t('dashboard.workerId')}: {user.workerId}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {offline ? (
          <Card accent={palette.warning}>
            <Body>{t('status.offline')}</Body>
          </Card>
        ) : null}

        {loading && !profile ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <Card accent={palette.primary}>
              <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{t('dashboard.currentSite')}</Text>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '600', color: palette.text, marginVertical: 2 }}>
                {profile?.currentSite ? profile.currentSite.name : t('dashboard.noSite')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{t('dashboard.malariaStatus')}:</Text>
                {profile ? <MalariaStatusChip status={profile.malariaStatus} /> : null}
              </View>
              {queued > 0 ? (
                <View style={{ marginTop: spacing.sm }}>
                  <SyncStateChip state="PENDING" />
                </View>
              ) : null}
            </Card>

            <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold as '600', color: palette.text, marginTop: spacing.sm }}>
              {t('dashboard.quickActions')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {ACTIONS.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => router.push(a.route as never)}
                  style={({ pressed }) => ({
                    width: '47%',
                    backgroundColor: palette.surface,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    opacity: pressed ? 0.9 : 1,
                    ...shadow.card,
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: a.color, marginBottom: spacing.sm }} />
                  <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: palette.text }}>{t(a.i18n)}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <Button label={t('nav.signOut')} variant="ghost" onPress={() => void signOut().then(() => router.replace('/language'))} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
