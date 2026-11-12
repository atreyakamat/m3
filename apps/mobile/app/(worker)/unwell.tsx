import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import { workerApi, recordsApi, isNetworkError, type HouseholdMemberDto } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';

type TargetType = 'SELF' | 'FAMILY' | 'ROOMMATE';

const SLIDE7_SYMPTOMS = [
  { id: 'fever', label: 'Fever' },
  { id: 'sweating', label: 'Sweating' },
  { id: 'chills', label: 'Chills' },
  { id: 'nausea', label: 'Nausea / vomiting' },
  { id: 'headache', label: 'Headache' },
  { id: 'fatigue', label: 'Weakness / fatigue' },
  { id: 'body_ache', label: 'Body ache' },
];

export default function UnwellScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  // 1. Who is feeling unwell?
  const [targetType, setTargetType] = useState<TargetType>('SELF');

  // 2. Selected symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // 3. Voice Recording
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // 4. Current Location
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [capturingLoc, setCapturingLoc] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  function toggleSymptom(id: string) {
    if (selectedSymptoms.includes(id)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== id));
    } else {
      setSelectedSymptoms([...selectedSymptoms, id]);
    }
  }

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Denied', 'Microphone access is required to record a voice message.');
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
    } catch {
      Alert.alert('Audio Error', 'Failed to start voice recording.');
    }
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
    } catch {
      Alert.alert('Audio Error', 'Failed to stop recording.');
    }
  }

  async function playRecording() {
    if (!recordingUri) return;
    try {
      if (sound) {
        await sound.unloadAsync();
      }
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true }
      );
      setSound(s);
      setIsPlaying(true);
      s.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch {
      Alert.alert('Audio Error', 'Could not play recording.');
    }
  }

  function deleteRecording() {
    if (sound) {
      void sound.unloadAsync();
      setSound(null);
    }
    setRecordingUri(null);
    setIsPlaying(false);
  }

  async function handleCaptureLocation() {
    setCapturingLoc(true);
    try {
      const loc = await captureDeviceLocation();
      setLocation(loc);
    } catch (err: any) {
      Alert.alert('Location Error', err?.message || 'Could not acquire GPS coordinates.');
    } finally {
      setCapturingLoc(false);
    }
  }

  async function submitReport() {
    if (selectedSymptoms.length === 0 && !recordingUri) {
      Alert.alert('Information Needed', 'Please select at least one symptom or record a voice message.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const payload = {
      targetType,
      symptoms: selectedSymptoms,
      hasVoiceRecording: Boolean(recordingUri),
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      locationText: location?.formattedText ?? null,
      timestamp,
      idempotencyKey: uuid(),
    };

    try {
      if (token) {
        try {
          await recordsApi.submitSymptom(token, {
            symptoms: payload.symptoms,
            note: `Target: ${targetType}${payload.hasVoiceRecording ? ' [Voice Recorded]' : ''}`,
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

      Alert.alert(
        'Report Submitted',
        'Your health report has been received. A health surveillance team will follow up if necessary.',
        [{ text: 'OK', onPress: () => router.replace('/(worker)/dashboard') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header Navigation */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Not Feeling Well. Select who is unwell, choose your symptoms, optionally record a voice message, capture your location, and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title matching Slide 7 */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Not Feeling Well</Text>
        </View>

        {/* Section 1: WHO IS FEELING UNWELL? */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>WHO IS FEELING UNWELL?</Text>
          <View style={styles.targetRow}>
            {(['SELF', 'FAMILY', 'ROOMMATE'] as const).map((tType) => {
              const label = tType === 'SELF' ? 'Self' : tType === 'FAMILY' ? 'Family' : 'Roommate';
              const isSelected = targetType === tType;
              return (
                <Pressable
                  key={tType}
                  style={[
                    styles.targetCard,
                    isSelected && styles.targetCardSelected,
                  ]}
                  onPress={() => setTargetType(tType)}
                >
                  <Text style={[styles.targetBox, isSelected && styles.targetBoxSelected]}>
                    {isSelected ? '■' : '□'}
                  </Text>
                  <Text style={[styles.targetLabel, isSelected && styles.targetLabelSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 2: SELECT SYMPTOMS */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>SELECT SYMPTOMS</Text>
          <View style={styles.symptomsGrid}>
            {SLIDE7_SYMPTOMS.map((sym) => {
              const isSelected = selectedSymptoms.includes(sym.id);
              return (
                <Pressable
                  key={sym.id}
                  style={[
                    styles.symptomCard,
                    isSelected && styles.symptomCardSelected,
                  ]}
                  onPress={() => toggleSymptom(sym.id)}
                >
                  <Text style={[styles.symptomBox, isSelected && styles.symptomBoxSelected]}>
                    {isSelected ? '■' : '□'}
                  </Text>
                  <Text style={[styles.symptomLabel, isSelected && styles.symptomLabelSelected]}>
                    {sym.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 3: OPTIONAL VOICE MESSAGE */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>OPTIONAL VOICE MESSAGE</Text>
          <View style={styles.voiceCard}>
            {isRecording ? (
              <Pressable style={styles.voiceActionRow} onPress={stopRecording}>
                <Text style={styles.voiceIconActive}>⏹️</Text>
                <Text style={styles.voiceTextActive}>Stop Recording</Text>
              </Pressable>
            ) : recordingUri ? (
              <View style={styles.playbackRow}>
                <Pressable style={styles.voiceActionRow} onPress={isPlaying ? undefined : playRecording}>
                  <Text style={styles.voiceIcon}>▶️</Text>
                  <Text style={styles.voiceText}>{isPlaying ? 'Playing...' : 'Play Recording'}</Text>
                </Pressable>
                <Pressable onPress={deleteRecording} style={styles.deleteVoiceBtn}>
                  <Text style={styles.deleteVoiceText}>🗑️ Re-record</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.voiceActionRow} onPress={startRecording}>
                <Text style={styles.voiceIcon}>●</Text>
                <Text style={styles.voiceText}>Record voice message</Text>
              </Pressable>
            )}

            <Text style={styles.voiceSubtext}>
              Stop • Play back • Re-record
            </Text>
          </View>
        </View>

        {/* Section 4: CURRENT LOCATION */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>CURRENT LOCATION</Text>
          <Pressable
            style={({ pressed }) => [
              styles.locationCard,
              location && styles.locationCardSuccess,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleCaptureLocation}
            disabled={capturingLoc}
            accessibilityRole="button"
            accessibilityLabel="Capture device location"
          >
            <View style={styles.locRow}>
              <Text style={styles.locIcon}>◎</Text>
              <Text style={styles.locText}>
                {location ? location.formattedText || 'Location Captured' : 'Capture device location'}
              </Text>
              {capturingLoc && <ActivityIndicator color="#CD3640" style={{ marginLeft: 8 }} />}
            </View>
          </Pressable>
        </View>

        {/* Submit Button matching Slide 7 (Red/Pink #CD3640) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            submitting && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={submitReport}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="SUBMIT"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>SUBMIT</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3873B0',
  },
  titleBlock: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: -0.5,
  },
  fieldSection: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#707E88',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  targetCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  targetCardSelected: {
    borderColor: '#CD3640',
    backgroundColor: '#FFF1F2',
  },
  targetBox: {
    fontSize: 16,
    color: '#707E88',
    marginRight: 8,
  },
  targetBoxSelected: {
    color: '#CD3640',
  },
  targetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#23303A',
  },
  targetLabelSelected: {
    color: '#CD3640',
    fontWeight: '700',
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  symptomCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  symptomCardSelected: {
    borderColor: '#CD3640',
    backgroundColor: '#FFF1F2',
  },
  symptomBox: {
    fontSize: 15,
    color: '#707E88',
    marginRight: 8,
  },
  symptomBoxSelected: {
    color: '#CD3640',
  },
  symptomLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#23303A',
    flex: 1,
  },
  symptomLabelSelected: {
    color: '#CD3640',
    fontWeight: '700',
  },
  voiceCard: {
    backgroundColor: '#FFEBEC',
    borderWidth: 1.5,
    borderColor: '#FFD2D6',
    borderRadius: 14,
    padding: 16,
  },
  voiceActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceIcon: {
    fontSize: 16,
    color: '#CD3640',
    marginRight: 8,
  },
  voiceIconActive: {
    fontSize: 16,
    color: '#DC2626',
    marginRight: 8,
  },
  voiceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CD3640',
  },
  voiceTextActive: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  voiceSubtext: {
    fontSize: 12,
    color: '#707E88',
    marginTop: 6,
  },
  playbackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteVoiceBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteVoiceText: {
    fontSize: 13,
    color: '#707E88',
    fontWeight: '600',
  },
  locationCard: {
    backgroundColor: '#FFEBEC',
    borderWidth: 1.5,
    borderColor: '#FFD2D6',
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  locationCardSuccess: {
    borderColor: '#CD3640',
    backgroundColor: '#FFF1F2',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locIcon: {
    fontSize: 18,
    color: '#CD3640',
    fontWeight: '700',
    marginRight: 10,
  },
  locText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#CD3640',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#CD3640',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: '#CD3640',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
