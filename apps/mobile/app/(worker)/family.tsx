import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { workerApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';

const RELATIONSHIP_OPTIONS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'CHILD', label: 'Child' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'OTHER', label: 'Other Family Relative' },
];

export default function FamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('SPOUSE');
  const [age, setAge] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter the family member full name.');
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

      Alert.alert(
        'Family Member Added',
        `${name.trim()} has been registered with your household.`,
        [{ text: 'OK', onPress: () => router.replace('/(worker)/dashboard') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save family member.');
    } finally {
      setSaving(false);
    }
  }

  const selectedRelLabel = RELATIONSHIP_OPTIONS.find((r) => r.value === relationship)?.label || 'Select relationship';

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header Navigation */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Add Family Member. Enter your family member's full name, select your relationship, enter their age, and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title matching Slide 5 */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Family</Text>
        </View>

        {/* Subtitle Card Header matching Slide 5 */}
        <Text style={styles.cardSectionHeader}>ADD FAMILY MEMBER</Text>

        {/* Field 1: NAME */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>NAME</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter full name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              accessibilityLabel="Full name"
            />
          </View>
        </View>

        {/* Field 2: RELATIONSHIP */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>RELATIONSHIP</Text>
          <Pressable
            style={styles.inputBox}
            onPress={() => setPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Select relationship"
          >
            <View style={styles.pickerRow}>
              <Text style={styles.pickerText}>{selectedRelLabel}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </View>
          </Pressable>
        </View>

        {/* Field 3: AGE */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>AGE</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter age"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
              accessibilityLabel="Age"
            />
          </View>
        </View>

        {/* Submit Button matching Slide 5 (Green #2E8B57) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            saving && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="SUBMIT"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>SUBMIT</Text>
          )}
        </Pressable>

        {/* Relationship Picker Modal */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select Relationship</Text>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.modalOption,
                    relationship === opt.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setRelationship(opt.value);
                    setPickerVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      relationship === opt.value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>
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
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: -0.5,
  },
  cardSectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  fieldSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#707E88',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    fontSize: 16,
    color: '#23303A',
    paddingVertical: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
    color: '#23303A',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#707E88',
  },
  submitButton: {
    backgroundColor: '#2E8B57',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#2E8B57',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#19364F',
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionSelected: {
    backgroundColor: '#E7F5EB',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#23303A',
  },
  modalOptionTextSelected: {
    color: '#2E8B57',
    fontWeight: '700',
  },
});
