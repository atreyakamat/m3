/**
 * UnwellScreen — Feeling Unwell: Symptom Selection & Voice Message Reporting.
 *
 * Implements Section 12 requirements:
 * - Option A: Select symptoms from approved clinical questionnaire list.
 * - Option B: Record voice message with timer, playback, delete & re-record.
 * - Supports Option A, Option B, or both.
 * - Confirmation alert before submission.
 * - Saves securely and links report to Worker ID and submission date.
 * - Offline outbox queueing with idempotency keys.
 * - Strict non-diagnostic disclaimer: reports never alter malaria status.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import { WORKER_SCREENING_SECTIONS } from '@m3/shared';
import { Screen, Card, TextField, Button, Body } from '@/components/ui';
import { SyncStateChip } from '@/components/StatusChips';
import { recordsApi, ApiError, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

function symptomOptions() {
  const clinical = WORKER_SCREENING_SECTIONS.find((s) => s.id === 'clinical');
  return clinical?.fields.find((f) => f.id === 'associated_symptoms')?.options ?? [];
}

export default function UnwellScreen() {
  const { t } = useTranslation();
  const { token, user } = useSession();
  const options = useMemo(symptomOptions, []);

  // Option A: Symptoms & note
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Option B: Voice recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [queuedState, setQueuedState] = useState<'none' | 'synced' | 'pending'>('none');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sound) void sound.unloadAsync();
      if (recording) void recording.stopAndUnloadAsync();
    };
  }, [sound, recording]);

  function toggleSymptom(v: string) {
    if (v === 'none') {
      setSelected(['none']);
      return;
    }
    setSelected((cur) => {
      const withoutNone = cur.filter((x) => x !== 'none');
      return withoutNone.includes(v)
        ? withoutNone.filter((x) => x !== v)
        : [...withoutNone, v];
    });
  }

  // ── Voice Recording Controls ──────────────────────────────────────────────

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone Permission', 'Permission to access the microphone is required to record a voice message.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      setRecording(rec);
      setIsRecording(true);
      setRecordDuration(0);

      timerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
    } catch {
      Alert.alert('Audio Error', 'Could not start audio recording.');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
      setIsRecording(false);
    } catch {
      Alert.alert('Audio Error', 'Could not save audio recording.');
    }
  }

  async function playRecordedAudio() {
    if (!recordedUri) return;
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          return;
        } else {
          await sound.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        },
      );
      setSound(newSound);
      setIsPlaying(true);
    } catch {
      Alert.alert('Audio Playback', 'Could not play voice recording.');
    }
  }

  async function deleteRecording() {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setRecordedUri(null);
    setIsPlaying(false);
    setRecordDuration(0);
  }

  function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ── Submit Handling ───────────────────────────────────────────────────────

  function confirmAndSubmit() {
    Alert.alert(
      t('unwell.dialogTitle'),
      t('unwell.dialogMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.submit'), onPress: () => void executeSubmit() },
      ],
    );
  }

  async function executeSubmit() {
    if (!token) return;
    const idempotencyKey = uuid();
    const payload = {
      symptoms: selected,
      note: note.trim() || undefined,
      voiceData: recordedUri || undefined,
      idempotencyKey,
    };

    try {
      setBusy(true);
      await recordsApi.submitSymptom(token, payload);
      setQueuedState('synced');
      Alert.alert(t('unwell.title'), t('unwell.submitted'));
      resetForm();
    } catch (e) {
      if (isNetworkError(e)) {
        // Offline queueing
        try {
          outboxRepo.enqueue({
            entityType: 'symptom_report',
            localId: uuid(),
            payload: { symptoms: selected, note: note.trim() || undefined, voiceData: recordedUri || undefined },
            idempotencyKey,
          });
          setQueuedState('pending');
          Alert.alert(t('unwell.title'), t('unwell.savedLocally'));
          resetForm();
        } catch {
          Alert.alert(t('unwell.title'), t('status.failed'));
        }
      } else {
        Alert.alert(t('unwell.title'), e instanceof ApiError ? e.message : t('status.failed'));
      }
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setSelected([]);
    setNote('');
    void deleteRecording();
  }

  const hasData = selected.length > 0 || note.trim().length > 0 || recordedUri !== null;

  return (
    <Screen>
      <Card accent={palette.warning}>
        <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginBottom: 2 }}>
          {t('unwell.title')}
        </Text>
        <Body>
          {t('unwell.intro')}
        </Body>
        <Text style={styles.disclaimerText}>
          {t('unwell.disclaimer')}
        </Text>
      </Card>

      {/* Option A — Select Symptoms */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionHeading}>{t('unwell.optionA')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <Pressable
                key={o.value}
                onPress={() => toggleSymptom(o.value)}
                style={[styles.symptomPill, on && styles.symptomPillActive]}
              >
                <Text style={[styles.symptomText, on && styles.symptomTextActive]}>
                  {t('unwell.symptoms.' + o.value, o.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Option B — Record Voice Message */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionHeading}>{t('unwell.optionB')}</Text>
        <Text style={styles.subHeading}>
          {t('unwell.voiceHelp')}
        </Text>

        {!recordedUri ? (
          <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
            {isRecording ? (
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <View style={styles.recordingPulse}>
                  <Text style={styles.recordingTime}>
                    {t('unwell.recording', { time: formatDuration(recordDuration) })}
                  </Text>
                </View>
                <Pressable onPress={stopRecording} style={styles.stopButton}>
                  <Text style={styles.buttonLabelLight}>{t('unwell.stopRecording')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startRecording} style={styles.recordButton}>
                <Text style={styles.buttonLabelLight}>{t('unwell.tapToRecord')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.playbackCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: '700', color: palette.text }}>
                {t('unwell.voiceRecorded', { time: formatDuration(recordDuration || 1) })}
              </Text>
              <Pressable onPress={deleteRecording}>
                <Text style={{ color: palette.danger, fontWeight: '600', fontSize: fontSize.xs }}>
                  {t('unwell.deleteReRecord')}
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Pressable onPress={playRecordedAudio} style={styles.playButton}>
                <Text style={styles.playButtonText}>
                  {isPlaying ? t('unwell.pauseRecording') : t('unwell.playRecording')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Optional Note */}
      <TextField
        label={t('unwell.note')}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder={t('unwell.notePlaceholder')}
      />

      {queuedState !== 'none' ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <SyncStateChip state={queuedState === 'synced' ? 'SYNCED' : 'PENDING'} />
        </View>
      ) : null}

      <Button
        label={t('unwell.submit')}
        onPress={confirmAndSubmit}
        loading={busy}
        disabled={!hasData}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  disclaimerText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  sectionBox: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    gap: spacing.xs,
  },
  sectionHeading: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  subHeading: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  symptomPill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  symptomPillActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  symptomText: {
    color: palette.text,
    fontSize: fontSize.sm,
  },
  symptomTextActive: {
    color: palette.accentDark,
    fontWeight: '700',
  },
  recordButton: {
    backgroundColor: palette.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    backgroundColor: palette.danger,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabelLight: {
    color: palette.textOnColor,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  recordingPulse: {
    backgroundColor: '#FEE2E2',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  recordingTime: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  playbackCard: {
    backgroundColor: '#F3F4F6',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  playButton: {
    backgroundColor: palette.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  playButtonText: {
    color: palette.textOnColor,
    fontWeight: '600',
    fontSize: fontSize.xs,
  },
});
