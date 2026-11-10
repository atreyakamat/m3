/**
 * UnwellScreen — Single-Screen Symptom & Voice Reporting with Location Capture.
 *
 * Implements Section 10 requirements:
 * 1. Single combined screen:
 *    - A: Select who is feeling unwell (Self, Family [conditional], Roommate [conditional])
 *    - B: Select symptoms (Fever, Chills, Headache, Sweating, Body ache, Nausea, Weakness)
 *    - C: Optional voice recording (Start, Stop, Play, Re-record)
 *    - D: Capture device location (GPS coordinates + automatic timestamp)
 *    - E: Submit via one clear Send Symptoms button
 * 2. Red accent theme (#DC2626).
 * 3. Strict non-diagnostic disclaimer (never classifies worker as positive).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import { Card, Button } from '@/components/ui';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { LocationCaptureCard } from '@/components/LocationCaptureCard';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import { workerApi, recordsApi, isNetworkError, type HouseholdMemberDto } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

type TargetType = 'SELF' | 'FAMILY' | 'ROOMMATE';

const APPROVED_SYMPTOMS = [
  { id: 'fever', label: 'Fever', hindi: 'बुखार', icon: '🌡️' },
  { id: 'chills', label: 'Chills / Shivering', hindi: 'ठंड लगना', icon: '🥶' },
  { id: 'headache', label: 'Headache', hindi: 'सिरदर्द', icon: '🤕' },
  { id: 'sweating', label: 'Sweating', hindi: 'पसीना आना', icon: '💦' },
  { id: 'body_ache', label: 'Body ache', hindi: 'बदन दर्द', icon: '⚡' },
  { id: 'nausea', label: 'Nausea / Vomiting', hindi: 'उल्टी / जी मिचलाना', icon: '🤢' },
  { id: 'fatigue', label: 'Weakness / Fatigue', hindi: 'कमजोरी / थकान', icon: '🥱' },
];

export default function UnwellScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  // A. Person Selection state
  const [targetType, setTargetType] = useState<TargetType>('SELF');
  const [familyMembers, setFamilyMembers] = useState<HouseholdMemberDto[]>([]);
  const [roommateMembers, setRoommateMembers] = useState<HouseholdMemberDto[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // B. Symptoms state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // C. Voice Recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // D. Location state
  const [location, setLocation] = useState<CapturedLocation | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Load saved household members to conditionally show Family and Roommate options
  useEffect(() => {
    async function loadMembers() {
      if (!token) return;
      try {
        const hh = await workerApi.getHousehold(token);
        if (hh && hh.members) {
          const fam = hh.members.filter(
            (m) => m.isDependent || ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING'].includes(m.relationship)
          );
          const room = hh.members.filter(
            (m) => !m.isDependent && !['SPOUSE', 'CHILD', 'PARENT', 'SIBLING'].includes(m.relationship)
          );
          setFamilyMembers(fam);
          setRoommateMembers(room);
        }
      } catch {
        // Non-fatal
      }
    }
    void loadMembers();
  }, [token]);

  // Voice timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording]);

  // Cleanup audio playback on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        void sound.unloadAsync();
      }
    };
  }, [sound]);

  function toggleSymptom(id: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  // Audio recording handlers
  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Microphone access is required to record voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingSeconds(0);
      setRecordingUri(null);
    } catch {
      Alert.alert('Recording Error', 'Unable to start audio recording.');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingUri(uri);
    } catch {
      setIsRecording(false);
    }
  }

  async function playRecording() {
    if (!recordingUri) return;
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: recordingUri });
      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      await newSound.playAsync();
    } catch {
      setIsPlaying(false);
    }
  }

  function deleteRecording() {
    if (sound) {
      void sound.unloadAsync();
    }
    setRecordingUri(null);
    setRecordingSeconds(0);
    setIsPlaying(false);
  }

  // Submit Handler
  async function handleSubmit() {
    if (selectedSymptoms.length === 0 && !recordingUri) {
      Alert.alert('Symptoms Required', 'Please select at least one symptom or record a voice note.');
      return;
    }

    if (targetType === 'FAMILY' && !selectedMemberId && familyMembers.length > 0) {
      Alert.alert('Select Family Member', 'Please tap which family member is feeling unwell.');
      return;
    }

    if (targetType === 'ROOMMATE' && !selectedMemberId && roommateMembers.length > 0) {
      Alert.alert('Select Roommate', 'Please tap which roommate is feeling unwell.');
      return;
    }

    setSubmitting(true);
    let capturedLoc = location;

    // Auto-capture location if not yet triggered
    if (!capturedLoc) {
      try {
        capturedLoc = await captureDeviceLocation();
        setLocation(capturedLoc);
      } catch {
        // Non-fatal if location fails
      }
    }

    const targetPersonName =
      targetType === 'SELF'
        ? user?.displayName || 'Self'
        : [...familyMembers, ...roommateMembers].find((m) => m.id === selectedMemberId)?.fullName ||
          (targetType === 'FAMILY' ? 'Family Member' : 'Roommate');

    const timestamp = new Date().toISOString();
    const payload = {
      targetType,
      targetPersonName,
      targetMemberId: selectedMemberId,
      symptoms: selectedSymptoms,
      voiceData: recordingUri || undefined,
      latitude: capturedLoc?.latitude ?? null,
      longitude: capturedLoc?.longitude ?? null,
      locationText: capturedLoc?.formattedText ?? null,
      submissionTimestamp: timestamp,
      note: `Reported for ${targetPersonName}. Symptoms: ${selectedSymptoms.join(', ')}`,
      idempotencyKey: uuid(),
    };

    try {
      if (token) {
        try {
          await recordsApi.submitSymptom(token, {
            symptoms: selectedSymptoms,
            note: payload.note,
            voiceData: payload.voiceData,
            idempotencyKey: payload.idempotencyKey,
          });
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
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not send symptom report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <WorkerHeader
          title="Not Feeling Well"
          subtitle="Symptoms Reported"
          showBack={true}
          fallbackRoute="/(worker)/dashboard"
        />
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Text style={{ fontSize: 40 }}>🩺</Text>
            </View>
            <Text style={styles.successTitle}>Symptoms Sent Successfully ✓</Text>
            <Text style={styles.successSubtitle}>
              Your symptom report has been logged. An ICMR–NIMR health surveillance officer will visit your worksite for rapid blood screening.
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reported For: </Text>
                <Text style={styles.summaryVal}>
                  {targetType === 'SELF'
                    ? 'Self (Worker)'
                    : [...familyMembers, ...roommateMembers].find((m) => m.id === selectedMemberId)?.fullName || targetType}
                </Text>
              </Text>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Symptoms: </Text>
                <Text style={styles.summaryVal}>
                  {selectedSymptoms.length > 0 ? selectedSymptoms.join(', ') : 'Voice Note Attached'}
                </Text>
              </Text>
              {recordingUri && (
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Voice Note: </Text>
                  <Text style={styles.summaryVal}>Attached (Audio)</Text>
                </Text>
              )}
              {location && (
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Device GPS: </Text>
                  <Text style={styles.summaryVal}>{location.formattedText}</Text>
                </Text>
              )}
            </View>

            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                ⚠️ Non-Diagnostic Advisory: Self-reported symptoms do not constitute a medical diagnosis. Malaria is diagnosed solely via approved RDT or microscopy blood testing.
              </Text>
            </View>

            <Button
              label="Back to Dashboard"
              onPress={() => router.replace('/(worker)/dashboard')}
              variant="primary"
              style={{ minHeight: 50, width: '100%', backgroundColor: '#DC2626' }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Not Feeling Well"
        subtitle="Symptom Reporting"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Not feeling well. Select who is feeling unwell, check your symptoms, optionally record a voice message, and capture device location to request a health visit."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🤒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Report Symptoms for Health Check</Text>
            <Text style={styles.bannerText}>
              Fast, free malaria screening and medications are provided to all workers in Goa.
            </Text>
          </View>
        </View>

        {/* Section A: Select Who is Feeling Unwell */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>1. Who is feeling unwell? *</Text>
          <Text style={styles.cardSubtitle}>
            Select whether you or someone in your household has symptoms
          </Text>

          <View style={styles.targetRow}>
            {/* Always show Self */}
            <Pressable
              onPress={() => {
                setTargetType('SELF');
                setSelectedMemberId(null);
              }}
              style={[
                styles.targetBtn,
                targetType === 'SELF' && styles.targetBtnActive,
              ]}
            >
              <Text style={styles.targetIcon}>👤</Text>
              <Text
                style={[
                  styles.targetText,
                  targetType === 'SELF' && styles.targetTextActive,
                ]}
              >
                Self
              </Text>
            </Pressable>

            {/* Show Family only when family records exist */}
            {familyMembers.length > 0 && (
              <Pressable
                onPress={() => {
                  setTargetType('FAMILY');
                  setSelectedMemberId(familyMembers[0].id);
                }}
                style={[
                  styles.targetBtn,
                  targetType === 'FAMILY' && styles.targetBtnActive,
                ]}
              >
                <Text style={styles.targetIcon}>👨‍👩‍👧</Text>
                <Text
                  style={[
                    styles.targetText,
                    targetType === 'FAMILY' && styles.targetTextActive,
                  ]}
                >
                  Family
                </Text>
              </Pressable>
            )}

            {/* Show Roommate only when roommate records exist */}
            {roommateMembers.length > 0 && (
              <Pressable
                onPress={() => {
                  setTargetType('ROOMMATE');
                  setSelectedMemberId(roommateMembers[0].id);
                }}
                style={[
                  styles.targetBtn,
                  targetType === 'ROOMMATE' && styles.targetBtnActive,
                ]}
              >
                <Text style={styles.targetIcon}>👥</Text>
                <Text
                  style={[
                    styles.targetText,
                    targetType === 'ROOMMATE' && styles.targetTextActive,
                  ]}
                >
                  Roommate
                </Text>
              </Pressable>
            )}
          </View>

          {/* If Family selected, list saved family members */}
          {targetType === 'FAMILY' && familyMembers.length > 0 && (
            <View style={styles.memberPickerBox}>
              <Text style={styles.pickerLabel}>Select Family Member:</Text>
              <View style={styles.memberChipsRow}>
                {familyMembers.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedMemberId(m.id)}
                    style={[
                      styles.memberChip,
                      selectedMemberId === m.id && styles.memberChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        selectedMemberId === m.id && styles.memberChipTextActive,
                      ]}
                    >
                      {m.fullName} ({m.relationship.toLowerCase()})
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* If Roommate selected, list saved roommates */}
          {targetType === 'ROOMMATE' && roommateMembers.length > 0 && (
            <View style={styles.memberPickerBox}>
              <Text style={styles.pickerLabel}>Select Roommate:</Text>
              <View style={styles.memberChipsRow}>
                {roommateMembers.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => setSelectedMemberId(m.id)}
                    style={[
                      styles.memberChip,
                      selectedMemberId === m.id && styles.memberChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberChipText,
                        selectedMemberId === m.id && styles.memberChipTextActive,
                      ]}
                    >
                      {m.fullName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* Section B: Select Symptoms */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>2. Select Symptoms *</Text>
          <Text style={styles.cardSubtitle}>
            Tap all symptoms currently experienced (multiple allowed)
          </Text>

          <View style={styles.symptomsGrid}>
            {APPROVED_SYMPTOMS.map((sym) => {
              const isChecked = selectedSymptoms.includes(sym.id);
              return (
                <Pressable
                  key={sym.id}
                  onPress={() => toggleSymptom(sym.id)}
                  style={[
                    styles.symptomCard,
                    isChecked && styles.symptomCardActive,
                  ]}
                >
                  <View style={styles.symptomTop}>
                    <Text style={styles.symptomIcon}>{sym.icon}</Text>
                    <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                      {isChecked && <Text style={styles.checkTick}>✓</Text>}
                    </View>
                  </View>
                  <Text style={[styles.symptomLabel, isChecked && styles.symptomLabelActive]}>
                    {sym.label}
                  </Text>
                  <Text style={styles.symptomHindi}>{sym.hindi}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Section C: Optional Voice Recording */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>3. Record Voice (Optional)</Text>
          <Text style={styles.cardSubtitle}>
            Describe how you are feeling in your own native language
          </Text>

          <View style={styles.voiceContainer}>
            {recordingUri ? (
              <View style={styles.audioPlaybackBox}>
                <View style={styles.audioWaveform}>
                  <Text style={{ fontSize: 28 }}>🎙️</Text>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                      Voice Note Recorded ({recordingSeconds}s)
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.textMuted }}>
                      Ready to send with symptom report
                    </Text>
                  </View>
                </View>

                <View style={styles.audioControlsRow}>
                  <Pressable
                    onPress={playRecording}
                    style={[styles.audioBtn, { backgroundColor: '#DC2626' }]}
                  >
                    <Text style={styles.audioBtnText}>
                      {isPlaying ? '⏸️ Playing...' : '▶️ Play Audio'}
                    </Text>
                  </Pressable>

                  <Pressable onPress={deleteRecording} style={styles.deleteAudioBtn}>
                    <Text style={styles.deleteAudioText}>🗑️ Delete & Re-record</Text>
                  </Pressable>
                </View>
              </View>
            ) : isRecording ? (
              <View style={styles.recordingActiveBox}>
                <View style={styles.recordingPulse}>
                  <Text style={{ fontSize: 32 }}>🔴</Text>
                </View>
                <Text style={styles.timerText}>
                  Recording: {Math.floor(recordingSeconds / 60)}:
                  {recordingSeconds % 60 < 10 ? '0' : ''}
                  {recordingSeconds % 60}
                </Text>
                <Pressable onPress={stopRecording} style={styles.stopBtn}>
                  <Text style={styles.stopBtnText}>⏹️ Stop Recording</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startRecording} style={styles.startRecordBtn}>
                <Text style={styles.startRecordIcon}>🎙️</Text>
                <Text style={styles.startRecordText}>Tap to Start Voice Recording</Text>
                <Text style={styles.startRecordSub}>Optional • Explain in your language</Text>
              </Pressable>
            )}
          </View>
        </Card>

        {/* Section D: Capture Device Location */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>4. Device Location</Text>
          <Text style={styles.cardSubtitle}>
            Attach current GPS coordinates to help the health officer locate you
          </Text>
          <LocationCaptureCard
            location={location}
            onLocationCaptured={setLocation}
            accentColor="#DC2626" // Red
            title="Current Location"
            buttonLabel="Capture Device Location"
          />
        </Card>

        {/* Section E: Submit Button */}
        <View style={styles.submitSection}>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[
              styles.submitButton,
              submitting && { opacity: 0.7 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </Pressable>

          <Text style={styles.disclaimerFooter}>
            🔒 Strict Non-Diagnostic Policy: This form logs symptoms for clinical follow-up only. It does not automatically diagnose malaria or alter your official medical status.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  banner: {
    backgroundColor: '#FEF2F2', // Light red
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bannerIcon: {
    fontSize: 32,
  },
  bannerTitle: {
    fontSize: fontSize.sm,
    fontWeight: '800',
    color: '#991B1B',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: '#DC2626',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A', // Dark navy
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  targetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  targetBtn: {
    flex: 1,
    minHeight: 68,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  targetBtnActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  targetIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  targetText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  targetTextActive: {
    color: '#DC2626',
  },
  memberPickerBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pickerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.textMuted,
    marginBottom: 6,
  },
  memberChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  memberChipActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  memberChipText: {
    fontSize: 12,
    color: palette.text,
    fontWeight: '600',
  },
  memberChipTextActive: {
    color: '#DC2626',
    fontWeight: '700',
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  symptomCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: spacing.sm,
  },
  symptomCardActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  symptomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  symptomIcon: {
    fontSize: 22,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkTick: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  symptomLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  symptomLabelActive: {
    color: '#DC2626',
  },
  symptomHindi: {
    fontSize: 10,
    color: palette.textMuted,
    marginTop: 1,
  },
  voiceContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
  },
  startRecordBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  startRecordIcon: {
    fontSize: 36,
    marginBottom: 4,
  },
  startRecordText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#DC2626',
  },
  startRecordSub: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  recordingActiveBox: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  recordingPulse: {
    marginBottom: spacing.xs,
  },
  timerText: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: spacing.sm,
  },
  stopBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  audioPlaybackBox: {
    width: '100%',
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  audioControlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  audioBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteAudioBtn: {
    padding: 8,
  },
  deleteAudioText: {
    color: palette.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  submitSection: {
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: '#DC2626', // Red accent
    minHeight: 52,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  disclaimerFooter: {
    fontSize: 10,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 14,
    paddingHorizontal: spacing.sm,
  },
  successContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  successCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  successIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  summaryBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  summaryRow: {
    fontSize: fontSize.xs,
  },
  summaryLabel: {
    color: palette.textMuted,
    fontWeight: '600',
  },
  summaryVal: {
    color: '#0F172A',
    fontWeight: '700',
  },
  disclaimerBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  disclaimerText: {
    fontSize: 10,
    color: '#B45309',
    lineHeight: 14,
    textAlign: 'center',
  },
});
