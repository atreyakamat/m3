import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CONSENT_STEP, evaluateScreeningCompleteness } from '@m3/shared';
import { Screen, Card, Button, Body } from '@/components/ui';
import { Questionnaire, type Answers } from '@/components/Questionnaire';
import { screeningApi, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize } from '@/theme';

type ScreeningRecord = { status: string; answers: Answers; consentGiven: boolean } | null;

export default function ScreeningScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [record, setRecord] = useState<ScreeningRecord>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const r = (await screeningApi.get(token)) as ScreeningRecord;
        if (r) {
          setRecord(r);
          setAnswers(r.answers ?? {});
          setConsent(r.consentGiven ?? false);
        }
      } catch {
        /* offline/none — start fresh */
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const done = record?.status === 'COMPLETE';
  const update = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));

  async function saveDraft() {
    if (!token) return;
    try {
      setBusy(true);
      await screeningApi.saveDraft(token, answers, consent);
      Alert.alert(t('screening.title'), t('common.save'));
    } catch (e) {
      Alert.alert(t('screening.title'), e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    const check = evaluateScreeningCompleteness(answers, consent);
    if (!check.complete) {
      setMissing(check.missingFieldIds);
      Alert.alert(t('screening.title'), check.consentMissing ? t('screening.consent') : t('screening.missing'));
      return;
    }
    if (!token) return;
    try {
      setBusy(true);
      await screeningApi.complete(token, answers);
      setRecord({ status: 'COMPLETE', answers, consentGiven: true });
      Alert.alert(t('screening.title'), t('screening.completed'));
    } catch (e) {
      Alert.alert(t('screening.title'), e instanceof ApiError ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Screen><ActivityIndicator color={palette.primary} style={{ marginTop: spacing.xxl }} /></Screen>;

  if (done) {
    return (
      <Screen>
        <Card accent={palette.success}>
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>{t('screening.completed')}</Text>
          <Body muted>{t('screening.alreadyDone')}</Body>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      {record?.status === 'DRAFT' ? (
        <Card accent={palette.warning}><Body>{t('screening.resume')}</Body></Card>
      ) : null}

      <Questionnaire answers={answers} onChange={update} missingFieldIds={missing} />

      {/* Consent gate */}
      <Card accent={palette.primary}>
        <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginBottom: spacing.xs }}>
          {t('screening.consent')}
        </Text>
        <Body muted>{CONSENT_STEP.statement}</Body>
        <Pressable
          onPress={() => setConsent((c) => !c)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: radius.sm,
              borderWidth: 2,
              borderColor: palette.primary,
              backgroundColor: consent ? palette.primary : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {consent ? <Text style={{ color: palette.textOnColor, fontWeight: '800' }}>✓</Text> : null}
          </View>
          <Text style={{ flex: 1, color: palette.text }}>{t('screening.consentAck')}</Text>
        </Pressable>
      </Card>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Button label={t('screening.complete')} onPress={complete} loading={busy} />
        <Button label={t('screening.saveDraft')} variant="ghost" onPress={saveDraft} loading={busy} />
      </View>
    </Screen>
  );
}
