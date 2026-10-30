import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Body, TextField, Button } from '@/components/ui';
import { recordsApi, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize } from '@/theme';

interface FollowUp { id: string; question: string; response: string | null; respondedAt: string | null }
const OPTIONS = ['Much better', 'About the same', 'Worse'];

export default function FollowUpsScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [items, setItems] = useState<FollowUp[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { response?: string; note?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try { setItems((await recordsApi.followUps(token)) as FollowUp[]); }
    finally { setLoading(false); }
  }, [token]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function respond(id: string) {
    if (!token) return;
    const d = drafts[id];
    if (!d?.response) return Alert.alert(t('nav.followUps'), 'Choose a response');
    try {
      setBusy(true);
      await recordsApi.respondFollowUp(token, { followUpId: id, response: d.response, note: d.note });
      await load();
    } catch (e) {
      Alert.alert(t('nav.followUps'), e instanceof ApiError ? e.message : 'Error');
    } finally { setBusy(false); }
  }

  if (loading) return <Screen><ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  return (
    <Screen>
      {items.length === 0 ? <Body muted>—</Body> : null}
      {items.map((f) => {
        const answered = Boolean(f.respondedAt);
        const draft = drafts[f.id] ?? {};
        return (
          <Card key={f.id} accent={answered ? palette.success : palette.primaryLight}>
            <Text style={{ fontWeight: '600', color: palette.text, marginBottom: spacing.sm }}>{f.question}</Text>
            {answered ? (
              <Body muted>{t('common.submit')}: {f.response}</Body>
            ) : (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {OPTIONS.map((o) => {
                    const on = draft.response === o;
                    return (
                      <Pressable
                        key={o}
                        onPress={() => setDrafts((s) => ({ ...s, [f.id]: { ...s[f.id], response: o } }))}
                        style={{
                          paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill,
                          borderWidth: 1.5, borderColor: on ? palette.primary : palette.border,
                          backgroundColor: on ? palette.primarySoft : palette.surface,
                        }}
                      >
                        <Text style={{ color: on ? palette.primaryDark : palette.text }}>{o}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextField
                  label={t('unwell.note')}
                  value={draft.note ?? ''}
                  onChangeText={(v) => setDrafts((s) => ({ ...s, [f.id]: { ...s[f.id], note: v } }))}
                />
                <Button label={t('common.submit')} onPress={() => respond(f.id)} loading={busy} />
              </>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
