import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LABELS, type Language } from '@m3/shared';
import { Screen, Card, Body, SelectRow } from '@/components/ui';
import { MalariaStatusChip } from '@/components/StatusChips';
import { workerApi, type WorkerProfile } from '@/api';
import { useSession } from '@/store/session';
import { LANGUAGES } from '@m3/shared';
import { palette, spacing, fontSize } from '@/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <Text style={{ color: palette.textMuted }}>{label}</Text>
      <Text style={{ color: palette.text, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { token, language, setLanguage } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try { setProfile(await workerApi.me(token)); } finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <Screen><ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  return (
    <Screen>
      <Card accent={palette.primary}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>{profile?.name}</Text>
        <Row label={t('dashboard.workerId')} value={profile?.workerId ?? '—'} />
        <Row label={t('auth.phone')} value={profile?.phone ?? '—'} />
        <Row label={t('dashboard.currentSite')} value={profile?.currentSite?.name ?? t('dashboard.noSite')} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs }}>
          <Text style={{ color: palette.textMuted }}>{t('dashboard.malariaStatus')}</Text>
          {profile ? <MalariaStatusChip status={profile.malariaStatus} /> : null}
        </View>
      </Card>

      <Card>
        <Text style={{ color: palette.textMuted, marginBottom: spacing.xs }}>{t('nav.screening')}</Text>
        <Body>{profile?.screening.status === 'COMPLETE' ? t('screening.completed') : profile?.screening.status ?? '—'}</Body>
      </Card>

      <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: palette.text }}>{t('language.title')}</Text>
      {LANGUAGES.map((lng) => (
        <SelectRow
          key={lng}
          label={LANGUAGE_LABELS[lng as Language]}
          selected={language === lng}
          onPress={() => void setLanguage(lng as Language)}
        />
      ))}
    </Screen>
  );
}
