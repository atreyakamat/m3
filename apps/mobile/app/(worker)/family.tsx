/**
 * FamilyScreen — Master Implementation.
 *
 * Implements Section 8 requirements:
 * - Directly displays the Add Family Member form.
 * - No existing family-member list displayed on this screen.
 * - Required fields: Name, Relationship, Age.
 * - Action: Save Family Member.
 * - Saves record to worker's account via workerApi.addHousehold.
 * - Shows clear success state and allows adding another family member.
 * - Green accent theme (#16A34A).
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

const RELATIONSHIPS = [
  { value: 'SPOUSE', label: 'Spouse (Wife / Husband)' },
  { value: 'CHILD', label: 'Child (Son / Daughter)' },
  { value: 'PARENT', label: 'Parent (Father / Mother)' },
  { value: 'SIBLING', label: 'Sibling (Brother / Sister)' },
  { value: 'OTHER', label: 'Other Family Relative' },
];

export default function FamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user } = useSession();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<string>('SPOUSE');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [lastSavedName, setLastSavedName] = useState('');

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter the family member\'s full name.');
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
      relationship,
      ageOrDob: String(ageNum),
      isDependent: true,
      livesInSameRoom: true,
      phoneAvailable: false,
      gender: relationship === 'SPOUSE' ? 'female' : 'male',
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
      setRelationship('SPOUSE');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save family member. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddAnother() {
    setSavedSuccess(false);
    setName('');
    setAge('');
    setRelationship('SPOUSE');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <WorkerHeader
        title="Add Family Member"
        subtitle="Household Surveillance"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Add family member. Enter name, relationship, and age to register your family member for free malaria checkups and care."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>👨‍👩‍👧</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Register Family Members</Text>
            <Text style={styles.bannerText}>
              Family members living with you in Goa receive free periodic health visits, blood tests, and malaria medications.
            </Text>
          </View>
        </View>

        {/* Success Card */}
        {savedSuccess ? (
          <Card style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Text style={{ fontSize: 36 }}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Family Member Saved!</Text>
            <Text style={styles.successText}>
              <Text style={{ fontWeight: '700' }}>{lastSavedName}</Text> has been successfully added to your household profile and enrolled for malaria surveillance.
            </Text>

            <View style={styles.successActions}>
              <Button
                label="+ Add Another Family Member"
                onPress={handleAddAnother}
                variant="primary"
                style={{ backgroundColor: '#16A34A', minHeight: 48 }}
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
          /* Direct Add Family Member Form */
          <Card style={styles.card}>
            <Text style={styles.formTitle}>Family Member Details</Text>
            <Text style={styles.formSubtitle}>
              Please provide essential details below
            </Text>

            {/* 1. Name */}
            <TextField
              label="Full Name *"
              placeholder="e.g. Sunita Devi"
              value={name}
              onChangeText={setName}
            />

            {/* 2. Relationship */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Relationship to Worker *</Text>
              <View style={styles.relationList}>
                {RELATIONSHIPS.map((rel) => {
                  const isSelected = relationship === rel.value;
                  return (
                    <Pressable
                      key={rel.value}
                      onPress={() => setRelationship(rel.value)}
                      style={[
                        styles.relationRow,
                        isSelected && styles.relationRowActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleActive,
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text
                        style={[
                          styles.relationText,
                          isSelected && styles.relationTextActive,
                        ]}
                      >
                        {rel.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3. Age */}
            <TextField
              label="Age (in completed years) *"
              placeholder="e.g. 28"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            {/* Submit Button — Standardised Submit label */}
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
                <Text style={styles.saveButtonText}>Submit</Text>
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
    backgroundColor: '#F0FDF4', // Light green
    borderColor: '#86EFAC',
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
    color: '#15803D',
  },
  bannerText: {
    fontSize: fontSize.xs,
    color: '#16A34A',
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
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: spacing.xs,
  },
  relationList: {
    gap: 8,
  },
  relationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  relationRowActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
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
    borderColor: '#16A34A',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  relationText: {
    fontSize: fontSize.sm,
    color: palette.text,
  },
  relationTextActive: {
    color: '#15803D',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#16A34A', // Green accent
    minHeight: 52,
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
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
    borderColor: '#86EFAC',
    ...shadow.card,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#16A34A',
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
