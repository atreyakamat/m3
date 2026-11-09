/**
 * HouseholdScreen — Redesigned Family & Household Member Management for Workers.
 *
 * Implements:
 * - Household overview: total members, active in Goa, inactive retained.
 * - Two dedicated actions: "Add Roommate" & "Add Family Member".
 * - Dedicated Add Roommate form: Full name, mobile, age/DOB, gender, accommodation details.
 * - Dedicated Add Family Member form: Full name, relationship, age/DOB, gender, mobile.
 * - Continuous malaria surveillance: inactive members retained, never permanently deleted.
 * - Duplicate member prevention.
 * - Offline SQLite queueing and sync.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HOUSEHOLD_RELATIONSHIP, type HouseholdRelationship } from '@m3/shared';
import { Card, Body, TextField, Button } from '@/components/ui';
import { DatePickerField } from '@/components/DatePickerField';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { workerApi, isNetworkError, type HouseholdMemberDto } from '@/api';
import { outboxRepo, uuid } from '@/db/outbox';
import { useSession } from '@/store/session';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

const FAMILY_RELATIONSHIPS: { id: HouseholdRelationship; label: string; icon: string }[] = [
  { id: 'SPOUSE', label: 'Spouse (पति / पत्नी)', icon: '💍' },
  { id: 'CHILD', label: 'Child (बच्चा)', icon: '👶' },
  { id: 'PARENT', label: 'Parent (माता / पिता)', icon: '👴' },
  { id: 'SIBLING', label: 'Sibling (भाई / बहन)', icon: '🧑‍🤝‍🧑' },
  { id: 'OTHER_FAMILY', label: 'Other Family (अन्य परिजन)', icon: '👥' },
];

export default function HouseholdScreen() {
  const { t } = useTranslation();
  const { token } = useSession();

  const [members, setMembers] = useState<HouseholdMemberDto[]>([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    activeCount: 0,
    inactiveCount: 0,
    roommateCount: 0,
    dependentCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal form mode: 'none' | 'roommate' | 'family'
  const [formMode, setFormMode] = useState<'none' | 'roommate' | 'family'>('none');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [ageYears, setAgeYears] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [relationship, setRelationship] = useState<HouseholdRelationship>('SPOUSE');
  const [roomDetails, setRoomDetails] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await workerApi.getHousehold(token);
      setMembers(res.members || []);
      const active = res.members.filter((m) => m.active).length;
      const inactive = res.members.filter((m) => !m.active).length;
      const roommates = res.members.filter((m) => m.relationship === 'ROOMMATE' || m.livesInSameRoom).length;
      const dependents = res.members.filter((m) => m.isDependent).length;

      setStats({
        totalCount: res.members.length,
        activeCount: active,
        inactiveCount: inactive,
        roommateCount: roommates,
        dependentCount: dependents,
      });
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function openRoommateForm() {
    setFullName('');
    setPhone('');
    setAgeYears('');
    setDob('');
    setGender('male');
    setRelationship('ROOMMATE');
    setRoomDetails('');
    setFormMode('roommate');
  }

  function openFamilyForm() {
    setFullName('');
    setPhone('');
    setAgeYears('');
    setDob('');
    setGender('male');
    setRelationship('SPOUSE');
    setRoomDetails('');
    setFormMode('family');
  }

  // Toggle active / inactive status
  async function toggleMemberActive(member: HouseholdMemberDto) {
    if (!token) return;
    const newActive = !member.active;
    const title = newActive ? 'Reactivate Member?' : 'Mark as Inactive?';
    const message = newActive
      ? `Reactivate ${member.fullName || 'this member'} as currently residing in Goa for active surveillance?`
      : `Mark ${member.fullName || 'this member'} as inactive? The record will remain permanently retained under continuous malaria surveillance.`;

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: newActive ? 'Reactivate' : 'Deactivate',
        onPress: async () => {
          try {
            await workerApi.updateHousehold(token, member.id, { active: newActive });
            await load();
          } catch (err: any) {
            if (isNetworkError(err)) {
              outboxRepo.enqueue({
                entityType: 'household_update',
                localId: uuid(),
                payload: { id: member.id, data: { active: newActive } },
              });
              setMembers((prev) =>
                prev.map((m) => (m.id === member.id ? { ...m, active: newActive } : m))
              );
              Alert.alert('Saved Offline', 'Status update queued for sync.');
            } else {
              Alert.alert('Error', err?.message || 'Could not update status');
            }
          }
        },
      },
    ]);
  }

  // Save Roommate or Family Member
  async function handleSave() {
    if (!fullName.trim() || fullName.trim().length < 2) {
      Alert.alert('Required Field', 'Please enter the member’s full name (at least 2 letters).');
      return;
    }

    const ageNum = ageYears.trim() ? parseInt(ageYears.trim(), 10) : undefined;
    if (ageNum !== undefined && (isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
      Alert.alert('Invalid Age', 'Please enter a valid age between 0 and 120.');
      return;
    }

    // Duplicate check prevention: check if same name already in household
    const duplicate = members.find(
      (m) =>
        m.fullName?.toLowerCase().trim() === fullName.toLowerCase().trim() &&
        m.active
    );
    if (duplicate) {
      Alert.alert(
        'Duplicate Member Warning',
        `A household member named "${fullName.trim()}" is already active in your household.\n\nTo prevent duplicate records, please verify before adding.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save Anyway',
            onPress: () => proceedSave(ageNum),
          },
        ]
      );
      return;
    }

    await proceedSave(ageNum);
  }

  async function proceedSave(ageNum?: number) {
    if (!token) return;
    setSubmitting(true);

    const isRoommateMode = formMode === 'roommate';
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const payload = {
      fullName: fullName.trim(),
      relationship: isRoommateMode ? 'ROOMMATE' : relationship,
      gender,
      ageYears: ageNum,
      dateOfBirth: dob || undefined,
      phone: cleanPhone || undefined,
      isDependent: !isRoommateMode,
      isRoommate: isRoommateMode,
      active: true,
      notes: isRoommateMode && roomDetails.trim() ? `Accommodation: ${roomDetails.trim()}` : undefined,
    };

    try {
      const res = await workerApi.addHousehold(token, payload);
      setFormMode('none');
      await load();

      Alert.alert(
        'Saved Successfully! ✓',
        `${fullName.trim()} registered with Code: ${res.memberCode}.\nContinuous health surveillance is now active.`
      );
    } catch (err: any) {
      if (isNetworkError(err)) {
        outboxRepo.enqueue({
          entityType: 'household_member',
          localId: uuid(),
          payload,
        });
        setFormMode('none');
        Alert.alert('Saved Offline', 'Record saved to device. Will sync when online.');
      } else {
        Alert.alert('Error', err?.message || 'Could not save member.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <WorkerHeader
        title={t('household.title', 'Household')}
        subtitle="Roommates & Family Surveillance"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Household management. You can add roommates or family members living with you in Goa for free malaria surveillance and health checkups."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* 1. Household Overview Card */}
        <Card style={styles.overviewCard}>
          <Text style={styles.overviewTitle}>Household Surveillance Overview</Text>
          <Text style={styles.overviewSubtitle}>
            Continuous community monitoring for migrant workers and dependents in Goa
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.totalCount}</Text>
              <Text style={styles.statLabel}>Total Members</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#16A34A' }]}>{stats.activeCount}</Text>
              <Text style={styles.statLabel}>Active in Goa</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: '#9333EA' }]}>{stats.inactiveCount}</Text>
              <Text style={styles.statLabel}>Retained Inactive</Text>
            </View>
          </View>

          <View style={styles.surveillanceBanner}>
            <Text style={styles.surveillanceText}>
              🛡️ All members remain retained under continuous malaria surveillance for outbreak tracing.
            </Text>
          </View>
        </Card>

        {/* 2. The Two Dedicated Action Buttons */}
        <View style={styles.actionsRow}>
          {/* Add Roommate */}
          <Pressable
            onPress={openRoommateForm}
            style={({ pressed }) => [styles.actionButton, styles.roommateBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Add Roommate"
          >
            <View style={styles.actionIconCircle}>
              <Text style={{ fontSize: 24 }}>🏠</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnTitle}>+ Add Roommate</Text>
              <Text style={styles.actionBtnSubtitle}>Camp / room co-worker</Text>
            </View>
          </Pressable>

          {/* Add Family Member */}
          <Pressable
            onPress={openFamilyForm}
            style={({ pressed }) => [styles.actionButton, styles.familyBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Add Family Member"
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#F3E8FF' }]}>
              <Text style={{ fontSize: 24 }}>👨‍👩‍👧</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionBtnTitle, { color: '#581C87' }]}>+ Add Family Member</Text>
              <Text style={[styles.actionBtnSubtitle, { color: '#7E22CE' }]}>Spouse, child, parent</Text>
            </View>
          </Pressable>
        </View>

        {/* 3. Existing Household Member List */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Registered Members ({members.length})</Text>
          <Text style={styles.listHeaderSub}>Active & Retained</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.lg }} />
        ) : members.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>👨‍👩‍👧‍👦</Text>
            <Text style={styles.emptyTitle}>No Household Members Added Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Add Roommate" or "Add Family Member" above to register individuals living with you for free malaria screening.
            </Text>
          </Card>
        ) : (
          members.map((member) => {
            const isRoommate = member.relationship === 'ROOMMATE' || member.livesInSameRoom;
            const relationshipLabel =
              FAMILY_RELATIONSHIPS.find((r) => r.id === member.relationship)?.label ||
              (isRoommate ? 'Roommate (कमरे का साथी)' : member.relationship);

            return (
              <Card
                key={member.id}
                style={[
                  styles.memberCard,
                  !member.active && styles.memberCardInactive,
                ]}
              >
                <View style={styles.memberHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.memberName}>{member.fullName || 'Unnamed Member'}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          member.active ? styles.statusBadgeActive : styles.statusBadgeInactive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            member.active ? styles.statusTextActive : styles.statusTextInactive,
                          ]}
                        >
                          {member.active ? '● Active in Goa' : '⏸ Retained'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.memberRel}>{relationshipLabel}</Text>
                    <Text style={styles.memberMeta}>
                      {member.gender ? `${member.gender.toUpperCase()} · ` : ''}
                      {member.ageOrDob ? `${member.ageOrDob}y · ` : ''}
                      Code: {member.memberCode}
                    </Text>
                    {member.phone && (
                      <Text style={styles.memberPhone}>📞 {member.phone}</Text>
                    )}
                  </View>

                  {/* Toggle Active / Inactive Button */}
                  <Pressable
                    onPress={() => toggleMemberActive(member)}
                    style={[
                      styles.toggleStatusBtn,
                      member.active ? styles.toggleDeactivate : styles.toggleReactivate,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.toggleBtnLabel,
                        member.active ? styles.toggleDeactivateLabel : styles.toggleReactivateLabel,
                      ]}
                    >
                      {member.active ? 'Deactivate' : 'Reactivate'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ── MODAL: Dedicated Add Roommate Form ── */}
      <Modal
        visible={formMode === 'roommate'}
        animationType="slide"
        onRequestClose={() => setFormMode('none')}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>🏠 Add Roommate</Text>
              <Text style={styles.modalSubtitle}>कमरे का साथी जोड़ें • Co-worker sharing room</Text>
            </View>
            <Pressable onPress={() => setFormMode('none')} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Card style={styles.modalFormCard}>
              <TextField
                label="Full Name *"
                placeholder="e.g. Sunil Mahato"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />

              <TextField
                label="Mobile Number (where applicable)"
                placeholder="10-digit mobile number"
                value={phone}
                onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ''))}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <TextField
                label="Age (Years)"
                placeholder="e.g. 26"
                value={ageYears}
                onChangeText={setAgeYears}
                keyboardType="number-pad"
                maxLength={3}
              />

              <DatePickerField
                label="Date of Birth (Optional)"
                value={dob}
                onChange={setDob}
                maximumDate={new Date()}
              />

              {/* Gender */}
              <Text style={styles.fieldLabel}>Gender *</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[styles.genderChip, gender === g && styles.genderChipSelected]}
                  >
                    <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                      {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : '🧑 Other'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextField
                label="Room / Accommodation Details *"
                placeholder="e.g. Labor Camp Block B, Room 14 / Site Barrack 2"
                value={roomDetails}
                onChangeText={setRoomDetails}
              />

              <Button
                label={submitting ? 'Saving...' : 'Save Roommate ✓'}
                onPress={handleSave}
                loading={submitting}
                style={{ marginTop: spacing.md, minHeight: 52 }}
              />
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── MODAL: Dedicated Add Family Member Form ── */}
      <Modal
        visible={formMode === 'family'}
        animationType="slide"
        onRequestClose={() => setFormMode('none')}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>👨‍👩‍👧 Add Family Member</Text>
              <Text style={styles.modalSubtitle}>परिवार का सदस्य जोड़ें • Dependents & relatives in Goa</Text>
            </View>
            <Pressable onPress={() => setFormMode('none')} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Card style={styles.modalFormCard}>
              <TextField
                label="Full Name *"
                placeholder="e.g. Sunita Devi"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />

              {/* Relationship with Worker */}
              <Text style={styles.fieldLabel}>Relationship with Worker *</Text>
              <View style={styles.relGrid}>
                {FAMILY_RELATIONSHIPS.map((r) => {
                  const isChosen = relationship === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => setRelationship(r.id)}
                      style={[styles.relChip, isChosen && styles.relChipSelected]}
                    >
                      <Text style={[styles.relText, isChosen && styles.relTextSelected]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextField
                label="Age (Years)"
                placeholder="e.g. 28"
                value={ageYears}
                onChangeText={setAgeYears}
                keyboardType="number-pad"
                maxLength={3}
              />

              <DatePickerField
                label="Date of Birth (Optional)"
                value={dob}
                onChange={setDob}
                maximumDate={new Date()}
              />

              {/* Gender */}
              <Text style={styles.fieldLabel}>Gender *</Text>
              <View style={styles.genderRow}>
                {(['female', 'male', 'other'] as const).map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[styles.genderChip, gender === g && styles.genderChipSelected]}
                  >
                    <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                      {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : '🧑 Other'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextField
                label="Mobile Number (where applicable)"
                placeholder="10-digit mobile number (optional)"
                value={phone}
                onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ''))}
                keyboardType="phone-pad"
                maxLength={10}
              />

              <Button
                label={submitting ? 'Saving...' : 'Save Family Member ✓'}
                onPress={handleSave}
                loading={submitting}
                style={{ marginTop: spacing.md, minHeight: 52 }}
              />
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  overviewCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  overviewTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  overviewSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },
  statLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  surveillanceBanner: {
    backgroundColor: '#FAF5FF',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  surveillanceText: {
    fontSize: 11,
    color: '#6B21A8',
    fontWeight: '600',
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    minHeight: 68,
    ...shadow.card,
  },
  roommateBtn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#5EEAD4',
  },
  familyBtn: {
    backgroundColor: '#FAF5FF',
    borderColor: '#D8B4FE',
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0F766E',
  },
  actionBtnSubtitle: {
    fontSize: 11,
    color: '#115E59',
    marginTop: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },
  listHeaderTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  listHeaderSub: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  emptyCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  memberCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    marginBottom: spacing.xs,
    ...shadow.card,
  },
  memberCardInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.8,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  memberRel: {
    fontSize: fontSize.xs,
    color: palette.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  memberMeta: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  memberPhone: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#15803D',
  },
  statusTextInactive: {
    color: '#64748B',
  },
  toggleStatusBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  toggleDeactivate: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  toggleReactivate: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  toggleBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  toggleDeactivateLabel: {
    color: '#C2410C',
  },
  toggleReactivateLabel: {
    color: '#0F766E',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    backgroundColor: palette.surface,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: palette.text,
  },
  modalSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: fontSize.sm,
    color: palette.danger,
    fontWeight: '700',
  },
  modalScroll: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  modalFormCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  genderChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  genderChipSelected: {
    borderColor: palette.primary,
    backgroundColor: '#F0FDFA',
  },
  genderText: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '600',
  },
  genderTextSelected: {
    color: palette.primaryDark,
    fontWeight: '700',
  },
  relGrid: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  relChip: {
    backgroundColor: '#F8FAFC',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  relChipSelected: {
    backgroundColor: '#F3E8FF',
    borderColor: '#A855F7',
  },
  relText: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '600',
  },
  relTextSelected: {
    color: '#6B21A8',
    fontWeight: '700',
  },
});
