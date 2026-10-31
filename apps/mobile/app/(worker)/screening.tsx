/**
 * ScreeningScreen — Worker Initial Screening Questionnaire.
 *
 * Implements:
 * - 4-Section navigation with progress indicator.
 * - Native Android date pickers for DOB and illness onset.
 * - Automatic age calculation from Date of Birth.
 * - Read-only registered phone number.
 * - Aadhaar / Voter ID / Other document handling.
 * - Present address (active construction site vs Goa location hierarchy).
 * - Permanent address PIN code postal lookup with district/state confirmation.
 * - Read-Only Initial Screening view once complete (Section 10).
 * - Full offline support via SQLite local draft and Outbox queueing.
 * - Multi-language support (English, Hindi, Bengali, Marathi).
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  evaluateScreeningCompleteness,
  QUESTIONNAIRE_VERSION,
  WORKER_SCREENING_SECTIONS,
} from '@m3/shared';
import { Card, Body, Button } from '@/components/ui';
import { SyncStateChip } from '@/components/StatusChips';
import { QuestionnaireNavigator, type Answers } from '@/components/QuestionnaireNavigator';
import { screeningApi, workerApi } from '@/api';
import { useSession } from '@/store/session';
import { screeningLocalRepo } from '@/services/screeningLocal';
import { flushOutbox } from '@/services/sync';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

type ScreeningRecord = {
  status: string;
  answers: Answers;
  consentGiven: boolean;
  completedAt?: string | null;
  version?: string;
  syncState?: 'LOCAL' | 'PENDING' | 'SYNCED' | 'FAILED';
} | null;

export default function ScreeningScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();
  const scrollRef = useRef<ScrollView>(null);

  const workerId = user?.workerId || user?.userId || 'current_worker';

  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [record, setRecord] = useState<ScreeningRecord>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [siteAddress, setSiteAddress] = useState<string>('');

  // Load existing draft/record on mount
  useEffect(() => {
    let active = true;

    async function load() {
      // 1. Try local SQLite draft first (offline-first)
      const local = screeningLocalRepo.getLocal(workerId);
      if (local && active) {
        setAnswers(local.answers || {});
        setConsent(local.consentGiven);
        setRecord({
          status: local.status,
          answers: local.answers,
          consentGiven: local.consentGiven,
          syncState: local.syncState,
        });

        if (local.status === 'COMPLETE' && local.syncState === 'PENDING' && token) {
          void (async () => {
            try {
              const flushed = await flushOutbox(token);
              if (flushed > 0 && active) {
                setRecord((r) => (r ? { ...r, syncState: 'SYNCED' } : r));
              }
            } catch { /* offline */ }
          })();
        }
      }

      // 2. Fetch server state & worker profile if online
      if (token) {
        try {
          const profile = await workerApi.me(token);
          if (profile && active) {
            if (profile.currentSite) {
              const addr = `${profile.currentSite.name} · ${profile.currentSite.area}`;
              setSiteAddress(addr);
              setAnswers((prev) => ({
                ...prev,
                present_address_site_name: addr,
                present_address_site_id: profile.currentSite?.siteId,
              }));
            }
          }

          if (!local || local.status !== 'COMPLETE' || local.syncState === 'SYNCED') {
            const remote = (await screeningApi.get(token)) as {
              status: string;
              answers?: Answers;
              consentGiven?: boolean;
              completedAt?: string;
              version?: string;
            } | null;

            if (remote && active) {
              if (remote.status === 'COMPLETE') {
                setRecord({
                  status: 'COMPLETE',
                  answers: remote.answers ?? {},
                  consentGiven: true,
                  completedAt: remote.completedAt,
                  version: remote.version,
                  syncState: 'SYNCED',
                });
                setAnswers(remote.answers ?? {});
                setConsent(true);
                screeningLocalRepo.saveDraft(workerId, remote.answers ?? {}, true, 'SYNCED');
              } else if (remote.status === 'DRAFT' && (!local || local.status === 'DRAFT')) {
                const remoteAnswers = remote.answers ?? {};
                const merged = { ...remoteAnswers, ...(local?.answers || {}) };
                setAnswers(merged);
                setConsent(remote.consentGiven ?? local?.consentGiven ?? false);
                setRecord({
                  status: 'DRAFT',
                  answers: merged,
                  consentGiven: remote.consentGiven ?? false,
                  syncState: 'SYNCED',
                });
              }
            }
          }
        } catch {
          // Offline: proceed with local data
        }
      }

      // 3. Pre-fill known worker registration info
      if (active) {
        setAnswers((prev) => {
          const next = { ...prev };
          let changed = false;
          if (!next.full_name && user?.displayName) {
            next.full_name = user.displayName;
            changed = true;
          }
          if (user?.phone && next.mobile_number !== user.phone) {
            next.mobile_number = user.phone;
            changed = true;
          }
          return changed ? next : prev;
        });
      }

      if (active) setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [token, workerId, user]);

  function update(id: string, value: unknown) {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      screeningLocalRepo.saveDraft(workerId, next, consent, 'LOCAL');
      return next;
    });
  }

  function handleSectionChange() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    screeningLocalRepo.saveDraft(workerId, answers, consent, 'LOCAL');
  }

  async function saveDraft() {
    setBusy(true);
    screeningLocalRepo.saveDraft(workerId, answers, consent, 'LOCAL');

    if (token) {
      try {
        await screeningApi.saveDraft(token, answers, consent);
        screeningLocalRepo.saveDraft(workerId, answers, consent, 'SYNCED');
        Alert.alert(t('screening.title'), `${t('common.save')} (${t('status.synced')})`);
      } catch {
        Alert.alert(t('screening.title'), t('status.savedLocally'));
      } finally {
        setBusy(false);
      }
    } else {
      Alert.alert(t('screening.title'), t('status.savedLocally'));
      setBusy(false);
    }
  }

  async function handleComplete() {
    const check = evaluateScreeningCompleteness(answers, consent);
    if (!check.complete) {
      if (check.consentMissing) {
        Alert.alert(t('screening.title'), t('screening.consentRequired'));
      } else {
        Alert.alert(t('screening.title'), t('screening.missing'));
      }
      return;
    }

    setBusy(true);

    if (token) {
      try {
        await screeningApi.complete(token, answers);
        screeningLocalRepo.saveDraft(workerId, answers, true, 'SYNCED');
        setRecord({
          status: 'COMPLETE',
          answers,
          consentGiven: true,
          completedAt: new Date().toISOString(),
          version: QUESTIONNAIRE_VERSION,
          syncState: 'SYNCED',
        });
        Alert.alert(t('screening.title'), t('screening.completed'));
      } catch {
        // Offline: save locally and queue outbox
        screeningLocalRepo.completeLocally(workerId, answers);
        setRecord({
          status: 'COMPLETE',
          answers,
          consentGiven: true,
          completedAt: new Date().toISOString(),
          version: QUESTIONNAIRE_VERSION,
          syncState: 'PENDING',
        });
        Alert.alert(t('screening.title'), `${t('status.savedLocally')}. ${t('status.offline')}`);
      } finally {
        setBusy(false);
      }
    } else {
      screeningLocalRepo.completeLocally(workerId, answers);
      setRecord({
        status: 'COMPLETE',
        answers,
        consentGiven: true,
        completedAt: new Date().toISOString(),
        version: QUESTIONNAIRE_VERSION,
        syncState: 'PENDING',
      });
      Alert.alert(t('screening.title'), t('status.savedLocally'));
      setBusy(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primary} size="large" />
          <Text style={{ color: palette.textMuted, marginTop: spacing.md, fontSize: fontSize.sm }}>
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Section 10: Read-Only Initial Screening Record ───────────────────────
  if (record?.status === 'COMPLETE') {
    const isPending = record.syncState === 'PENDING' || record.syncState === 'LOCAL';
    const submittedAnswers = record.answers || answers || {};

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
          <Card accent={isPending ? palette.warning : palette.success}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>
                {t('screening.completed')}
              </Text>
              <SyncStateChip state={record.syncState ?? 'SYNCED'} />
            </View>
            <Body muted>
              {isPending
                ? `${t('screening.alreadyDone')} (${t('status.pendingSync')})`
                : t('screening.alreadyDone')}
            </Body>
            <View style={readOnlyStyles.metaBox}>
              <Text style={readOnlyStyles.metaText}>👤 {t('dashboard.workerId')}: {user?.workerId || workerId}</Text>
              <Text style={readOnlyStyles.metaText}>
                📅 {t('travel.submitted')} {record.completedAt ? new Date(record.completedAt).toLocaleDateString() : 'Recorded'}
              </Text>
              <Text style={readOnlyStyles.metaText}>🔒 {t('screening.readonlyBanner')}</Text>
            </View>
          </Card>

          {isPending ? (
            <Button
              label={t('common.retry', 'Sync now')}
              onPress={async () => {
                if (!token) return;
                setBusy(true);
                try {
                  await flushOutbox(token);
                  setRecord((r) => (r ? { ...r, syncState: 'SYNCED' } : r));
                } catch {
                  Alert.alert(t('status.failed'), t('status.offline'));
                } finally {
                  setBusy(false);
                }
              }}
              loading={busy}
              variant="secondary"
            />
          ) : null}

          {/* Read-Only Answer View per Section */}
          <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginTop: spacing.sm }}>
            {t('screening.originalRecord')}
          </Text>

          {WORKER_SCREENING_SECTIONS.map((sec) => (
            <View key={sec.id} style={readOnlyStyles.sectionCard}>
              <Text style={readOnlyStyles.sectionHeader}>{t('q.' + sec.id, sec.title)}</Text>
              {sec.fields.map((f) => {
                const val = submittedAnswers[f.id];
                if (val === undefined || val === null || val === '') return null;
                let displayVal = String(val);
                if (Array.isArray(val)) displayVal = val.join(', ');
                if (val === 'yes') displayVal = t('common.yes');
                if (val === 'no') displayVal = t('common.no');

                return (
                  <View key={f.id} style={readOnlyStyles.row}>
                    <Text style={readOnlyStyles.label}>{t('q.' + f.id, f.label)}:</Text>
                    <Text style={readOnlyStyles.val}>{displayVal}</Text>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={readOnlyStyles.lockNotice}>
            <Text style={readOnlyStyles.lockNoticeText}>
              🔒 {t('screening.readonlyNotice')}
            </Text>
          </View>

          <Button
            label={t('dashboard.title')}
            onPress={() => router.replace('/(worker)/dashboard')}
            variant="primary"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Questionnaire Active ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['top', 'bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Resume draft banner */}
        {record?.status === 'DRAFT' ? (
          <Card accent={palette.warning}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body>{t('screening.resume')}</Body>
              {record.syncState ? <SyncStateChip state={record.syncState} /> : null}
            </View>
          </Card>
        ) : null}

        <QuestionnaireNavigator
          answers={answers}
          onChange={update}
          consent={consent}
          onConsentToggle={() => {
            const next = !consent;
            setConsent(next);
            screeningLocalRepo.saveDraft(workerId, answers, next, 'LOCAL');
          }}
          onSectionChange={handleSectionChange}
          onComplete={handleComplete}
          onSaveDraft={saveDraft}
          busy={busy}
          siteAddress={siteAddress}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const readOnlyStyles = StyleSheet.create({
  metaBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    gap: 3,
  },
  metaText: { fontSize: fontSize.xs, color: palette.textMuted },
  sectionCard: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xs,
  },
  sectionHeader: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.primaryDark,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  label: { fontSize: fontSize.xs, color: palette.textMuted, flex: 1, marginRight: spacing.sm },
  val: { fontSize: fontSize.xs, color: palette.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  lockNotice: {
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  lockNoticeText: { fontSize: fontSize.xs, color: palette.textMuted, textAlign: 'center', lineHeight: 18 },
});
