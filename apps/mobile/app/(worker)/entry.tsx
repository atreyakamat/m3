/**
 * EntryInGoaScreen — Master Implementation.
 *
 * Implements Section 7 requirements:
 * 1. Where are you coming from? (Select or enter origin place)
 * 2. Why are you coming to Goa? (Selection: Work, Family Visit, Health / Treatment, or Other)
 * 3. Current Location:
 *    - Capture Device Location action
 *    - Captures GPS coordinates upon activation
 *    - Shows location-captured state
 * 4. Submit Entry button:
 *    - Automatic background timestamp
 *    - No manual date entry
 *    - No manual location/village/district fields
 *    - Teal accent theme (#0D9488)
 */

import React, { useState } from 'react';
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
import { Card, TextField, Button } from '@/components/ui';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { LocationCaptureCard } from '@/components/LocationCaptureCard';
import { type CapturedLocation } from '@/services/location';
import { travelApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

const REASON_OPTIONS = [
  'Work / Employment',
  'Family Visit',
  'Returning to Site',
  'Health / Medical Checkup',
  'Other',
];

const POPULAR_ORIGINS = [
  'Howrah, West Bengal',
  'Patna, Bihar',
  'Gorakhpur, Uttar Pradesh',
  'Ganjam, Odisha',
  'Ranchi, Jharkhand',
];

export default function EntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [origin, setOrigin] = useState('');
  const [selectedReason, setSelectedReason] = useState('Work / Employment');
  const [otherReason, setOtherReason] = useState('');
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const finalReason = selectedReason === 'Other' ? otherReason.trim() || 'Other' : selectedReason;

  async function handleSubmit() {
    if (!origin.trim()) {
      Alert.alert('Origin Required', 'Please enter or select the place you are travelling from.');
      return;
    }
    if (selectedReason === 'Other' && !otherReason.trim()) {
      Alert.alert('Reason Required', 'Please specify your reason for coming to Goa.');
      return;
    }

    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const payload = {
      origin: origin.trim(),
      originState: origin.trim(),
      reason: finalReason,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,
      locationText: location?.formattedText ?? null,
      arrivalDate: timestamp,
      idempotencyKey: uuid(),
    };

    try {
      if (token) {
        try {
          await travelApi.enter(token, {
            originState: payload.originState,
            hadFeverOrMalaria: false,
          });
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'travel_entering',
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
      Alert.alert('Submission Error', e?.message || 'Could not record entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <WorkerHeader
          title="Entry in Goa"
          subtitle="Arrival Recorded"
          showBack={true}
          fallbackRoute="/(worker)/dashboard"
        />
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={[styles.successIconCircle, { backgroundColor: '#F0FDFA', borderColor: '#0D9488' }]}>
              <Text style={{ fontSize: 40 }}>🛬</Text>
            </View>
            <Text style={styles.successTitle}>Entry in Goa Recorded ✓</Text>
            <Text style={styles.successSubtitle}>
              Your arrival has been registered with the ICMR–NIMR Malaria Surveillance System.
            </Text>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Travelling From: </Text>
                <Text style={styles.summaryVal}>{origin.trim()}</Text>
              </Text>
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Reason: </Text>
                <Text style={styles.summaryVal}>{finalReason}</Text>
              </Text>
              {location && (
                <Text style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Device GPS: </Text>
                  <Text style={styles.summaryVal}>{location.formattedText}</Text>
                </Text>
              )}
              <Text style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Recorded: </Text>
                <Text style={styles.summaryVal}>{new Date().toLocaleDateString()}</Text>
              </Text>
            </View>

            <Button
              label="Back to Dashboard"
              onPress={() => router.replace('/(worker)/dashboard')}
              variant="primary"
              style={{ minHeight: 50, width: '100%' }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Entry in Goa"
        subtitle="Travel Surveillance"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Entry in Goa. Enter where you are coming from, why you are coming to Goa, and capture your device location."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>🛬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Reporting Arrival in Goa</Text>
            <Text style={styles.bannerText}>
              Keep our surveillance team informed upon arriving in Goa for prompt health checks.
            </Text>
          </View>
        </View>

        {/* 1. Where are you coming from? */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Where are you coming from? *</Text>
          <Text style={styles.cardSubtitle}>
            Enter the town, district, or state you travelled from
          </Text>

          <TextField
            placeholder="e.g. Howrah, West Bengal or Patna, Bihar..."
            value={origin}
            onChangeText={setOrigin}
          />

          {/* Quick chips */}
          <Text style={styles.chipsLabel}>Quick select common origins:</Text>
          <View style={styles.chipsRow}>
            {POPULAR_ORIGINS.map((orig) => (
              <Pressable
                key={orig}
                onPress={() => setOrigin(orig)}
                style={[
                  styles.chip,
                  origin === orig && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    origin === orig && styles.chipTextActive,
                  ]}
                >
                  {orig}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* 2. Why are you coming to Goa? */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Why are you coming to Goa? *</Text>
          <Text style={styles.cardSubtitle}>
            Select the primary reason for entering Goa
          </Text>

          <View style={styles.optionsList}>
            {REASON_OPTIONS.map((opt) => {
              const isSelected = selectedReason === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setSelectedReason(opt)}
                  style={[styles.radioRow, isSelected && styles.radioRowActive]}
                >
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.radioLabel, isSelected && styles.radioLabelActive]}>
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedReason === 'Other' && (
            <TextField
              placeholder="Specify reason..."
              value={otherReason}
              onChangeText={setOtherReason}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>

        {/* 3. Current Location */}
        <Card style={styles.card}>
          <LocationCaptureCard
            location={location}
            onLocationCaptured={setLocation}
            accentColor="#0D9488" // Teal
            title="Current Location"
            buttonLabel="Capture Device Location"
          />
        </Card>

        {/* 4. Submit Entry */}
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
              <Text style={styles.submitButtonText}>Submit Entry ✓</Text>
            )}
          </Pressable>
          <Text style={styles.autoTimestampText}>
            ⏱️ Submission timestamp is captured automatically in the background
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
    backgroundColor: '#F0FDFA', // Light teal
    borderColor: '#99F6E4',
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
    color: '#0F766E',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: '#0D9488',
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
  chipsLabel: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  chipText: {
    fontSize: 11,
    color: palette.text,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#0F766E',
    fontWeight: '700',
  },
  optionsList: {
    gap: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radioRowActive: {
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  radioCircleActive: {
    borderColor: '#0D9488',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0D9488',
  },
  radioLabel: {
    fontSize: fontSize.sm,
    color: palette.text,
  },
  radioLabelActive: {
    color: '#0F766E',
    fontWeight: '700',
  },
  submitSection: {
    marginTop: spacing.sm,
  },
  submitButton: {
    backgroundColor: '#0D9488', // Teal
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
  autoTimestampText: {
    fontSize: 11,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
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
    borderWidth: 2,
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
    marginBottom: spacing.lg,
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
});
