import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WORKER_SCREENING_SECTIONS } from '@m3/shared';
import { Screen, Card, TextField, Button, Body } from '@/components/ui';
import { SyncStateChip } from '@/components/StatusChips';
import { recordsApi, ApiError, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, radius, fontSize } from '@/theme';

/** Symptom options are sourced from the approved questionnaire's clinical
 *  "Associated Symptoms" list, not invented. Final symptom set is configurable. */
function symptomOptions() {
  const clinical = WORKER_SCREENING_SECTIONS.find((s) => s.id === 'clinical');
  return clinical?.fields.find((f) => f.id === 'associated_symptoms')?.options ?? [];
}

export default function UnwellScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const options = useMemo(symptomOptions, []);
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [queuedState, setQueuedState] = useState<'none' | 'synced' | 'pending'>('none');

  function toggle(v: string) {
    setSelected((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function submit() {
    if (!token) return;
    const idempotencyKey = uuid();
    const payload = { symptoms: selected, note: note || undefined, idempotencyKey };
    try {
      setBusy(true);
      await recordsApi.submitSymptom(token, payload);
      setQueuedState('synced');
      Alert.alert(t('unwell.title'), t('unwell.submitted'));
      setSelected([]); setNote('');
    } catch (e) {
      if (isNetworkError(e)) {
        // Offline: queue to the outbox for later sync (idempotent).
        try {
          outboxRepo.enqueue({ entityType: 'symptom_report', localId: uuid(), payload: { symptoms: selected, note: note || undefined }, idempotencyKey });
          setQueuedState('pending');
          Alert.alert(t('unwell.title'), t('status.pendingSync'));
          setSelected([]); setNote('');
        } catch {
          Alert.alert(t('unwell.title'), 'Could not save');
        }
      } else {
        Alert.alert(t('unwell.title'), e instanceof ApiError ? e.message : 'Error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card accent={palette.warning}>
        <Body>{t('unwell.intro')}</Body>
      </Card>

      <Text style={{ fontSize: fontSize.md, fontWeight: '600', color: palette.text }}>{t('unwell.symptoms')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Pressable
              key={o.value}
              onPress={() => toggle(o.value)}
              style={{
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                borderWidth: 1.5,
                borderColor: on ? palette.accent : palette.border,
                backgroundColor: on ? palette.accentSoft : palette.surface,
              }}
            >
              <Text style={{ color: on ? palette.accent : palette.text, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField label={t('unwell.note')} value={note} onChangeText={setNote} multiline />

      {queuedState !== 'none' ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <SyncStateChip state={queuedState === 'synced' ? 'SYNCED' : 'PENDING'} />
        </View>
      ) : null}

      <Button label={t('unwell.submit')} onPress={submit} loading={busy} disabled={selected.length === 0 && !note} />
    </Screen>
  );
}
