/**
 * UnwellScreen — Not Feeling Well: Dual Symptom & Voice Reporting for Malaria Surveillance.
 *
 * Implements:
 * - Method A: Send Symptoms (Fever, Chills/shivering, Headache, Sweating, Body pain, Nausea/vomiting, Weakness/fatigue)
 *   with multiple selection, onset date, and optional notes.
 * - Method B: Record Voice (Mic icon, Start, live Timer, Stop, Playback, Re-record, Attach/Submit).
 * - Voice is optional; can submit symptoms alone, voice alone, or both.
 * - Strict non-diagnostic disclaimer: never automatically marks worker positive.
 * - Submission confirmation screen with reporting status.
 * - Offline SQLite outbox queueing.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import { Screen, Card, TextField, Button } from '@/components/ui';
import { DatePickerField } from '@/components/DatePickerField';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { recordsApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

const APPROVED_SYMPTOMS = [
  { id: 'fever', label: 'Fever', hindi: 'बुखार', icon: '🌡️' },
  { id: 'chills', label: 'Chills / Shivering', hindi: 'ठंड लगना / कंपकंपी', icon: '🥶' },
  { id: 'headache', label: 'Headache', hindi: 'सिरदर्द', icon: '🤕' },
  { id: 'sweating', label: 'Sweating', hindi: 'पसीना आना', icon: '💦' },
  { id: 'body_pain', label: 'Body Pain', hindi: 'शरीर / बदन दर्द', icon: '💥' },
  { id: 'nausea_vomiting', label: 'Nausea / Vomiting', hindi: 'उल्टी / जी मिचलाना', icon: '🤢' },
  { id: 'weakness_fatigue', label: 'Weakness / Fatigue', hindi: 'कमजोरी / थकान', icon: '🥱' },
];

export default function UnwellScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  // Method A: Symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Method B: Voice Recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submittedConfirmed, setSubmittedConfirmed] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<any>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sound) void sound.unloadAsync();
      if (recording) void recording.stopAndUnloadAsync();
    };
  }, [sound, recording]);

  function toggleSymptom(id: string) {
    setSelectedSymptoms((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  // ── Voice Recording Controls ──

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone Permission',
          'Permission to access the microphone is required to record a voice message.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(rec);
      setIsRecording(true);
      setRecordDuration(0);
      setRecordedUri(null);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert('Recording Error', 'Could not access audio device. Please check permissions.');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
    } catch {
      Alert.alert('Error', 'Failed to save voice recording.');
    }
  }

  async function togglePlayback() {
    if (!recordedUri) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((st) => {
          if (st.isLoaded && st.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch {
      setIsPlaying(false);
    }
  }

  function reRecord() {
    if (sound) {
      void sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
    setRecordedUri(null);
    setRecordDuration(0);
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ── Submission Handler ──

  async function handleSubmit(type: 'symptoms_only' | 'voice_only' | 'both') {
    if (type === 'symptoms_only' && selectedSymptoms.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one symptom from the list below.');
      return;
    }
    if (type === 'voice_only' && !recordedUri) {
      Alert.alert('Voice Note Required', 'Please record your voice message first before submitting.');
      return;
    }
    if (type === 'both' && selectedSymptoms.length === 0 && !recordedUri) {
      Alert.alert('Details Required', 'Please select your symptoms or record a voice message.');
      return;
    }

    const payload = {
      symptoms: selectedSymptoms,
      note: notes.trim()
        ? `Onset date: ${onsetDate}. ${notes.trim()}`
        : `Onset date: ${onsetDate}`,
      voiceData: recordedUri || undefined,
      idempotencyKey: uuid(),
    };

    setSubmitting(true);
    try {
      if (token) {
        try {
          await recordsApi.submitSymptom(token, payload);
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'symptom_report',
              localId: payload.idempotencyKey,
              payload,
            });
          } else {
            throw err;
          }
        }
      }

      setSubmittedSummary({
        symptoms: selectedSymptoms,
        hasVoice: !!recordedUri,
        duration: recordDuration,
        onsetDate,
      });
      setSubmittedConfirmed(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not send symptom report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorkerHeader
        title={t('nav.feelingUnwell', 'Not Feeling Well')}
        subtitle="Health & Symptom Reporting"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Feeling unwell. Tell us how you feel. You can select symptoms like fever, headache or shivering, or record a voice message. An authorized health worker will assist you. This is not an automatic malaria diagnosis."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Statutory Non-Diagnostic Disclaimer */}
        <View style={styles.disclaimerBox}>
          <View style={styles.disclaimerIcon}>
            <Text style={{ fontSize: 24 }}>🛡️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.disclaimerTitle}>Non-Diagnostic Health Reporting</Text>
            <Text style={styles.disclaimerText}>
              Reporting symptoms alerts the ICMR–NIMR field health team to visit your site for free testing and treatment.
              <Text style={{ fontWeight: '700' }}> Symptom reporting is NOT an official diagnosis</Text> and will never mark you as malaria-positive without an authorized lab test.
            </Text>
          </View>
        </View>

        {/* ── METHOD A: SEND SYMPTOMS ── */}
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.methodBadge, { backgroundColor: '#E0F2FE' }]}>
              <Text style={[styles.methodBadgeText, { color: '#0369A1' }]}>Method A</Text>
            </View>
            <Text style={styles.sectionTitle}>Select Your Symptoms</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Tap on all symptoms you are currently feeling (लक्षण चुनें)
          </Text>

          {/* Symptom Chips / Cards */}
          <View style={styles.symptomsList}>
            {APPROVED_SYMPTOMS.map((s) => {
              const isSelected = selectedSymptoms.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggleSymptom(s.id)}
                  style={[
                    styles.symptomCard,
                    isSelected && styles.symptomCardSelected,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View style={styles.symptomIconCircle}>
                    <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.symptomLabel, isSelected && styles.symptomLabelSelected]}>
                      {s.label}
                    </Text>
                    <Text style={[styles.symptomHindi, isSelected && styles.symptomHindiSelected]}>
                      {s.hindi}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Date of Symptom Onset */}
          <View style={{ marginTop: spacing.md }}>
            <DatePickerField
              label="Date of Symptom Onset (लक्षण कब शुरू हुए) *"
              value={onsetDate}
              onChange={setOnsetDate}
              maximumDate={new Date()}
            />
          </View>

          <TextField
            label="Additional Information (Optional)"
            placeholder="e.g. Taking paracetamol, high fever in evenings..."
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Button
            label={submitting ? 'Sending...' : 'Send Symptoms Now ✓'}
            onPress={() => handleSubmit('symptoms_only')}
            disabled={selectedSymptoms.length === 0 || submitting}
            style={styles.sendSymptomsBtn}
          />
        </Card>

        {/* ── METHOD B: RECORD VOICE MESSAGE ── */}
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.methodBadge, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.methodBadgeText, { color: '#6B21A8' }]}>Method B</Text>
            </View>
            <Text style={styles.sectionTitle}>Record Voice Note</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Can't write? Speak in your own language (आवाज़ रिकॉर्ड करें)
          </Text>

          <View style={styles.voiceContainer}>
            {/* Mic / Live Recording View */}
            {!recordedUri ? (
              <View style={styles.recordingArea}>
                <View
                  style={[
                    styles.micCircle,
                    isRecording && styles.micCircleRecording,
                  ]}
                >
                  <Text style={{ fontSize: 32 }}>🎙️</Text>
                </View>

                {isRecording ? (
                  <View style={{ alignItems: 'center', marginVertical: spacing.sm }}>
                    <View style={styles.liveTimerRow}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.recordingTimerText}>
                        Recording: {formatTime(recordDuration)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={stopRecording}
                      style={styles.stopBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.stopBtnText}>⏹️ Stop Recording</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
                    <Pressable
                      onPress={startRecording}
                      style={styles.startRecordBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.startRecordBtnText}>Start Recording Voice</Text>
                    </Pressable>
                    <Text style={styles.voiceHint}>
                      Tap button and explain how you are feeling
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              /* Playback & Re-record View */
              <View style={styles.playbackCard}>
                <View style={styles.playbackInfoRow}>
                  <View style={styles.audioBadge}>
                    <Text style={{ fontSize: 20 }}>🎵</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playbackTitle}>Voice Message Ready</Text>
                    <Text style={styles.playbackDuration}>Duration: {formatTime(recordDuration)}</Text>
                  </View>
                </View>

                <View style={styles.playbackControlsRow}>
                  <Pressable
                    onPress={togglePlayback}
                    style={styles.playBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.playBtnText}>
                      {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={reRecord}
                    style={styles.reRecordBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reRecordBtnText}>🗑️ Re-record</Text>
                  </Pressable>
                </View>

                <Button
                  label={submitting ? 'Sending...' : 'Attach / Submit Voice Recording'}
                  onPress={() => handleSubmit(selectedSymptoms.length > 0 ? 'both' : 'voice_only')}
                  loading={submitting}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            )}
          </View>
        </Card>
      </ScrollView>

      {/* Confirmation Screen / Modal */}
      <Modal
        visible={submittedConfirmed}
        transparent
        animationType="fade"
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Text style={{ fontSize: 36 }}>📋</Text>
            </View>
            <Text style={styles.confirmTitle}>Symptom Report Submitted!</Text>
            <Text style={styles.confirmSubtitle}>
              Your health status has been forwarded to the ICMR–NIMR field surveillance team.
            </Text>

            <View style={styles.statusBox}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>Status: Pending Health Worker Follow-up</Text>
              </View>

              <Text style={styles.summaryLine}>
                <Text style={{ fontWeight: '700' }}>Symptoms: </Text>
                {submittedSummary?.symptoms?.length > 0
                  ? submittedSummary.symptoms.join(', ')
                  : 'Voice Note Filed'}
              </Text>
              {submittedSummary?.hasVoice && (
                <Text style={styles.summaryLine}>
                  <Text style={{ fontWeight: '700' }}>Voice Note: </Text>
                  Attached ({formatTime(submittedSummary.duration)})
                </Text>
              )}
              <Text style={styles.summaryLine}>
                <Text style={{ fontWeight: '700' }}>Onset Date: </Text>
                {submittedSummary?.onsetDate}
              </Text>
            </View>

            <View style={styles.guidanceBox}>
              <Text style={styles.guidanceTitle}>Next Steps for Your Health:</Text>
              <Text style={styles.guidanceItem}>• Drink plenty of clean, safe water and rest.</Text>
              <Text style={styles.guidanceItem}>• Keep your registered mobile phone reachable.</Text>
              <Text style={styles.guidanceItem}>• A health worker will visit your site for a free blood test.</Text>
            </View>

            <Button
              label="Return to Dashboard"
              onPress={() => {
                setSubmittedConfirmed(false);
                router.replace('/(worker)/dashboard');
              }}
              style={{ width: '100%', marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  disclaimerBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  disclaimerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#92400E',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  methodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  methodBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  sectionSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  symptomsList: {
    gap: spacing.xs,
  },
  symptomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: '#F8FAFC',
    gap: spacing.sm,
    minHeight: 56,
  },
  symptomCardSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: palette.primary,
  },
  symptomIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  symptomLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  symptomLabelSelected: {
    color: palette.primaryDark,
  },
  symptomHindi: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  symptomHindiSelected: {
    color: palette.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  sendSymptomsBtn: {
    marginTop: spacing.md,
    minHeight: 50,
  },
  voiceContainer: {
    marginTop: spacing.xs,
  },
  recordingArea: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  micCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.border,
  },
  micCircleRecording: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  liveTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingTimerText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#B91C1C',
  },
  stopBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  startRecordBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  startRecordBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  voiceHint: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 6,
  },
  playbackCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  playbackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  audioBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  playbackDuration: {
    fontSize: 11,
    color: palette.textMuted,
  },
  playbackControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playBtn: {
    flex: 1,
    backgroundColor: palette.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  playBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  reRecordBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  reRecordBtnText: {
    color: palette.textMuted,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...shadow.card,
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  statusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    gap: 4,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  summaryLine: {
    fontSize: fontSize.xs,
    color: palette.text,
    lineHeight: 18,
  },
  guidanceBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  guidanceTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.primaryDark,
    marginBottom: 4,
  },
  guidanceItem: {
    fontSize: 11,
    color: '#0F766E',
    lineHeight: 16,
  },
});
