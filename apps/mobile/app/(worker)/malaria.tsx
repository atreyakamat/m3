import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Body } from '@/components/ui';
import { MalariaStatusChip } from '@/components/StatusChips';
import { recordsApi, workerApi, type WorkerProfile } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize } from '@/theme';

interface Diagnostic { id: string; testType: string; result: string; species: string | null; testDate: string }

export default function MalariaScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const [p, d] = await Promise.all([workerApi.me(token), recordsApi.diagnostics(token) as Promise<Diagnostic[]>]);
        setProfile(p);
        setDiagnostics(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <Screen><ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  return (
    <Screen>
      <Card accent={palette.accent}>
        <Text style={{ color: palette.textMuted, fontSize: fontSize.sm, marginBottom: spacing.xs }}>{t('dashboard.malariaStatus')}</Text>
        {profile ? <MalariaStatusChip status={profile.malariaStatus} /> : null}
        <Body muted>Status comes only from authorized clinical/lab results.</Body>
      </Card>

      <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text }}>{t('nav.diagnostics')}</Text>
      {diagnostics.length === 0 ? <Body muted>—</Body> : null}
      {diagnostics.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '600', color: palette.text }}>{d.testType}</Text>
            <Text style={{ fontWeight: '700', color: d.result === 'POSITIVE' ? palette.danger : d.result === 'NEGATIVE' ? palette.success : palette.textMuted }}>
              {d.result}
            </Text>
          </View>
          {d.species ? <Body muted>{d.species.replace('_', '. ')}</Body> : null}
          <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>{new Date(d.testDate).toLocaleDateString()}</Text>
        </Card>
      ))}
    </Screen>
  );
}
