/**
 * RoommateScreen — Master Implementation.
 *
 * Implements Section 9 requirements:
 * - Directly displays the Add Roommate form.
 * - No existing roommate list displayed on this screen.
 * - Required fields: Name, Age only.
 * - No mobile number, no Aadhaar number, no gender, no room number.
 * - Action: Save Roommate.
 * - Saves record against worker via workerApi.addHousehold.
 * - Shows clear success state and allows adding another roommate.
 * - Purple accent theme (#9333EA).
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
import { workerApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

export default function RoommateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [lastSavedName, setLastSavedName] = useState('');

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter the roommate\'s full name.');
      return;
    }
    const ageNum = parseInt(age.trim(), 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      Alert.alert('Age Required', 'Please enter a valid age in years.');
      return;
    }

    setSaving(true);
    const payload = {
      fullName: name.trim(),
      relationship: 'OTHER' as const, // Roommate/peer classification
      ageOrDob: String(ageNum),
      isDependent: false,
      livesInSameRoom: true,
      phoneAvailable: false,
      idempotencyKey: uuid(),
    };

    try {
      if (token) {
        try {
          await workerApi.addHousehold(token, payload);
        } catch (err) {
          if (isNetworkError(err)) {
            outboxRepo.enqueue({
              entityType: 'household_member',
              localId: payload.idempotencyKey,
              payload,
            });
          } else {
            throw err;
          }
        }
      }
      setLastSavedName(name.trim());
      setSavedSuccess(true);
      setName('');
      setAge('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save roommate. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddAnother() {
    setSavedSuccess(false);
    setName('');
    setAge('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Add Roommate"
        subtitle="Household Surveillance"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Add roommate. Enter the name and age of workers sharing your room or accommodation. Roommates receive proactive malaria screening."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>👥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Register Roommates & Camp Peers</Text>
            <Text style={styles.bannerText}>
              Roommates sharing your room or camp shelter are covered under ICMR–NIMR active malaria surveillance.
            </Text>
          </View>
        </View>

        {/* Success Card */}
        {savedSuccess ? (
          <Card style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Text style={{ fontSize: 36 }}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Roommate Saved!</Text>
            <Text style={styles.successText}>
              <Text style={{ fontWeight: '700' }}>{lastSavedName}</Text> has been successfully registered to your accommodation unit for health team follow-ups.
            </Text>

            <View style={styles.successActions}>
              <Button
                label="+ Add Another Roommate"
                onPress={handleAddAnother}
                variant="primary"
                style={{ backgroundColor: '#9333EA', minHeight: 48 }}
              />
              <Button
                label="Back to Dashboard"
                onPress={() => router.replace('/(worker)/dashboard')}
                variant="ghost"
                style={{ marginTop: spacing.xs }}
              />
            </View>
          </Card>
        ) : (
          /* Direct Add Roommate Form */
          <Card style={styles.card}>
            <Text style={styles.formTitle}>Roommate Details</Text>
            <Text style={styles.formSubtitle}>
              Please provide essential details below (no phone or ID required)
            </Text>

            {/* 1. Name */}
            <TextField
              label="Full Name *"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={setName}
            />

            {/* 2. Age */}
            <TextField
              label="Age (in completed years) *"
              placeholder="e.g. 26"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            {/* Save Roommate Button */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.saveButton,
                saving && { opacity: 0.7 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Roommate ✓</Text>
              )}
            </Pressable>
          </Card>
        )}
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
    backgroundColor: '#FAF5FF', // Light purple
    borderColor: '#D8B4FE',
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
    color: '#7E22CE',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: '#9333EA',
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
  formTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A', // Dark navy
  },
  formSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: '#9333EA', // Purple accent
    minHeight: 52,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  successCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D8B4FE',
    ...shadow.card,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FAF5FF',
    borderWidth: 2,
    borderColor: '#9333EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: spacing.xs,
  },
  successText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  successActions: {
    width: '100%',
  },
});
