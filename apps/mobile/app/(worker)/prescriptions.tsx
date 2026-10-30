import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Body } from '@/components/ui';
import { recordsApi } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize } from '@/theme';

interface Prescription { id: string; details: string; issuedAt: string; episodeId: string }

export default function PrescriptionsScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [tab, setTab] = useState<'current' | 'history'>('current'); // current opens by default
  const [current, setCurrent] = useState<Prescription | null>(null);
  const [history, setHistory] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const [c, h] = await Promise.all([
          recordsApi.currentPrescription(token) as Promise<Prescription | null>,
          recordsApi.prescriptionHistory(token) as Promise<Prescription[]>,
        ]);
        setCurrent(c);
        setHistory(h);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['current', 'history'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: 10,
              alignItems: 'center',
              backgroundColor: tab === key ? palette.success : palette.surfaceAlt,
            }}
          >
            <Text style={{ color: tab === key ? palette.textOnColor : palette.textMuted, fontWeight: '600' }}>
              {t(`prescriptions.${key}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.lg }} /> : null}

      {tab === 'current' ? (
        current ? <PrescriptionCard p={current} /> : <Body muted>{t('prescriptions.none')}</Body>
      ) : history.length === 0 ? (
        <Body muted>{t('prescriptions.none')}</Body>
      ) : (
        history.map((p) => <PrescriptionCard key={p.id} p={p} />)
      )}
    </Screen>
  );
}

function PrescriptionCard({ p }: { p: Prescription }) {
  return (
    <Card accent={palette.success}>
      <Text style={{ fontSize: fontSize.md, color: palette.text, fontWeight: '600' }}>{p.details}</Text>
      <Text style={{ color: palette.textMuted, fontSize: fontSize.sm, marginTop: 4 }}>
        {new Date(p.issuedAt).toLocaleDateString()}
      </Text>
    </Card>
  );
}
