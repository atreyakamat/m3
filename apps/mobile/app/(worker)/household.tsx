/**
 * HouseholdScreen — Family & Household Member Management for Workers.
 *
 * Implements:
 * - Adding family members (Spouse, Child, Parent, Sibling, Roommate, Other)
 * - Tracking dependents vs roommates
 * - Soft duplicate warnings with mandatory unique memberCode
 * - Low literacy design with icons, large touch targets, and audio guidance
 * - Privacy protection notice (Contractors see counts only)
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { HOUSEHOLD_RELATIONSHIP, type HouseholdRelationship } from '@m3/shared';
import { Card, Body, TextField, Button } from '@/components/ui';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { workerApi, isNetworkError, type HouseholdMemberDto, type HouseholdResponse } from '@/api';
import { outboxRepo, uuid } from '@/db/outbox';
import { useSession } from '@/store/session';
import {
  WorkerGuideCard,
  WorkerActionGuide,
  WorkerEmptyStateIllustration,
} from '@/components/worker-guide';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

const RELATIONSHIP_LABELS: Record<HouseholdRelationship, { label: string; icon: string }> = {
  SPOUSE: { label: 'Spouse (पति / पत्नी)', icon: '💍' },
  CHILD: { label: 'Child (बच्चा)', icon: '👶' },
  PARENT: { label: 'Parent (माता / पिता)', icon: '👴' },
  SIBLING: { label: 'Sibling (भाई / बहन)', icon: '🧑‍🤝‍🧑' },
  OTHER_FAMILY: { label: 'Other Family Member (परिवार का अन्य सदस्य)', icon: '👥' },
  ROOMMATE: { label: 'Roommate (कमरे का साथी)', icon: '🏠' },
  OTHER: { label: 'Other Relative / Member (अन्य)', icon: '👤' },
};

export default function HouseholdScreen() {
  const { t } = useTranslation();
  const { token } = useSession();

  const [members, setMembers] = useState<HouseholdMemberDto[]>([]);
  const [stats, setStats] = useState<{
    totalCount: number;
    dependentCount: number;
    roommateCount: number;
    screenedCount?: number;
    awaitingScreening?: number;
    confirmedPositiveCount?: number;
    confirmedNegativeCount?: number;
  }>({
    totalCount: 0,
    dependentCount: 0,
    roommateCount: 0,
    screenedCount: 0,
    awaitingScreening: 0,
    confirmedPositiveCount: 0,
    confirmedNegativeCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [helpGuideVisible, setHelpGuideVisible] = useState(false);

  // Form states
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<HouseholdRelationship>('SPOUSE');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [ageYears, setAgeYears] = useState('');
  const [phone, setPhone] = useState('');
  const [isDependent, setIsDependent] = useState(true);
  const [isRoommate, setIsRoommate] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await workerApi.getHousehold(token);
      setMembers(res.members || []);
      setStats(res.stats || { totalCount: 0, dependentCount: 0, roommateCount: 0 });
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpenAdd = () => {
    setEditingMemberId(null);
    setFullName('');
    setRelationship('SPOUSE');
    setGender('male');
    setAgeYears('');
    setPhone('');
    setIsDependent(true);
    setIsRoommate(false);
    setShowAddModal(true);
  };

  const handleOpenEdit = (m: HouseholdMemberDto) => {
    setEditingMemberId(m.id);
    setFullName(m.fullName || '');
    setRelationship((m.relationship as HouseholdRelationship) || 'OTHER');
    setGender((m.gender as any) || 'male');
    setAgeYears(m.ageOrDob || '');
    setPhone(m.phone || '');
    setIsDependent(m.isDependent);
    setIsRoommate(m.relationship === 'ROOMMATE' || !m.livesInSameRoom);
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    if (!token) return;
    setSubmitting(true);

    const payload = {
      fullName: fullName.trim() || null,
      relationship,
      gender,
      ageYears: ageYears.trim() ? parseInt(ageYears.trim(), 10) : null,
      phone: phone.trim() || null,
      isDependent,
      isRoommate: isRoommate || relationship === 'ROOMMATE',
    };

    try {
      if (editingMemberId) {
        await workerApi.updateHousehold(token, editingMemberId, payload);
        Alert.alert(t('common.success', 'Success'), t('household.memberUpdated', 'Household member updated successfully.'));
      } else {
        const res = await workerApi.addHousehold(token, payload);
        if (res.duplicateWarning) {
          Alert.alert(
            t('common.notice', 'Notice'),
            t('household.duplicateWarningNotice', 'A household member with a similar name already exists. Member record created with unique code: ') + res.memberCode,
          );
        } else {
          Alert.alert(t('common.success', 'Success'), t('household.memberAdded', 'Household member added with code: ') + res.memberCode);
        }
      }
      setShowAddModal(false);
      await load();
    } catch (err: any) {
      if (isNetworkError(err)) {
        outboxRepo.enqueue({
          entityType: 'household_member',
          localId: uuid(),
          payload,
        });
        setShowAddModal(false);
        Alert.alert(
          t('common.offline', 'Offline'),
          t('household.offlineSaved', 'Saved offline. Household member will sync when connection returns.')
        );
      } else {
        Alert.alert(t('common.error', 'Error'), err?.message || 'Could not save household member');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <WorkerHeader
        title={t('household.title', 'Family & Household')}
        subtitle={t('nav.household', 'Household Members')}
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
        {/* Low-Literacy Audio Guidance */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>
            👨‍👩‍👧‍👦 {t('household.sectionHeader', 'Your Household & Family')}
          </Text>
          <AudioGuidanceButton
            text="Here you can add your family members, children, spouse, or roommates living with you. Tap the green button to add a new member."
            size="small"
          />
        </View>

        {/* Picture-Based Visual Guidance Card */}
        <WorkerGuideCard
          illustration="worker_adding_family_member"
          title="Family & Roommates"
          audioText="To register your family or roommates, tap add member. Select relation like spouse, child, or roommate. Free health screening is provided."
          step1="Tap 'Add Family / Roommate' below"
          step2="Select relation: Spouse, Child, Parent, or Roommate"
          step3="Health team provides free malaria checks & medicines"
          actionLabel="Need Help? View Picture Guide"
          onAction={() => setHelpGuideVisible(true)}
        />

        {/* Aggregate Headcount Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalCount}</Text>
            <Text style={styles.statLabel}>{t('household.totalMembers', 'Total Members')}</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#818CF8', backgroundColor: '#EEF2FF' }]}>
            <Text style={[styles.statNumber, { color: '#4F46E5' }]}>{stats.dependentCount}</Text>
            <Text style={styles.statLabel}>{t('household.dependents', 'Dependents')}</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#FBBF24', backgroundColor: '#FFFBEB' }]}>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{stats.roommateCount}</Text>
            <Text style={styles.statLabel}>{t('household.roommates', 'Roommates')}</Text>
          </View>
        </View>

        {/* Clinical Screening Status Row (Phase 3.2) */}
        <View style={[styles.statsRow, { marginTop: 6 }]}>
          <View style={[styles.statBox, { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }]}>
            <Text style={[styles.statNumber, { color: '#6B7280', fontSize: 16 }]}>{stats.awaitingScreening ?? 0}</Text>
            <Text style={styles.statLabel}>{t('household.awaiting', 'Awaiting')}</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statNumber, { color: '#2563EB', fontSize: 16 }]}>{stats.screenedCount ?? 0}</Text>
            <Text style={styles.statLabel}>{t('household.screened', 'Screened')}</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
            <Text style={[styles.statNumber, { color: '#DC2626', fontSize: 16 }]}>{stats.confirmedPositiveCount ?? 0}</Text>
            <Text style={styles.statLabel}>{t('household.positive', 'Positive')}</Text>
          </View>
          <View style={[styles.statBox, { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
            <Text style={[styles.statNumber, { color: '#16A34A', fontSize: 16 }]}>{stats.confirmedNegativeCount ?? 0}</Text>
            <Text style={styles.statLabel}>{t('household.negative', 'Negative')}</Text>
          </View>
        </View>

        {/* Privacy Barrier Notice */}
        <Card style={styles.privacyCard}>
          <Text style={styles.privacyCardTitle}>🔒 {t('household.privacyTitle', 'Privacy Protection')}</Text>
          <Text style={styles.privacyCardText}>
            {t(
              'household.privacyNotice',
              'Contractors and site managers only see total headcounts for accommodation planning. Personal names and health screenings are strictly confidential.',
            )}
          </Text>
        </Card>

        {/* Add Member Button */}
        <Button
          label={'+ ' + t('household.addMemberBtn', 'Add Family / Roommate')}
          onPress={handleOpenAdd}
          style={{ backgroundColor: palette.primary }}
        />

        {/* Members List */}
        {loading ? (
          <ActivityIndicator style={{ padding: spacing.xl }} color={palette.primary} />
        ) : members.length === 0 ? (
          <WorkerEmptyStateIllustration
            illustration="worker_adding_family_member"
            title={t('household.noMembers', 'No household members added yet')}
            message={t('household.noMembersHint', 'Add your family members or roommates staying with you in Goa for free medical screening and malaria protection.')}
            actionLabel={'+ ' + t('household.addMemberBtn', 'Add Family / Roommate')}
            onAction={handleOpenAdd}
          />
        ) : (
          members.map((m) => {
            const relInfo = RELATIONSHIP_LABELS[m.relationship as HouseholdRelationship] || {
              label: m.relationship,
              icon: '👤',
            };

            return (
              <Card key={m.id} style={styles.memberCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.memberIconCircle}>
                      <Text style={{ fontSize: 24 }}>{relInfo.icon}</Text>
                    </View>
                    <View>
                      <Text style={styles.memberName}>
                        {m.fullName || t('household.unnamedMember', 'Family Member')}
                      </Text>
                      <Text style={styles.memberCodeBadge}>
                        ID: {m.memberCode}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleOpenEdit(m)}
                    style={styles.editButton}
                    accessibilityRole="button"
                    accessibilityLabel="Edit member"
                  >
                    <Text style={{ color: palette.primary, fontWeight: '700', fontSize: fontSize.sm }}>
                      ✏️ {t('common.edit', 'Edit')}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.memberDetailsRow}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{relInfo.label.split(' ')[0]}</Text>
                  </View>
                  {m.isDependent ? (
                    <View style={[styles.tag, { backgroundColor: '#EEF2FF' }]}>
                      <Text style={[styles.tagText, { color: '#4F46E5' }]}>👶 Dependent</Text>
                    </View>
                  ) : null}
                  {m.livesInSameRoom ? (
                    <View style={[styles.tag, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[styles.tagText, { color: '#059669' }]}>🏠 Same Room</Text>
                    </View>
                  ) : null}
                  {m.ageOrDob ? (
                    <Text style={styles.metaText}>Age: {m.ageOrDob} yrs</Text>
                  ) : null}
                </View>

                {m.phone ? (
                  <Text style={[styles.metaText, { marginTop: 4 }]}>📞 {m.phone}</Text>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* ─── ADD / EDIT MEMBER MODAL ────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '800', color: palette.text }}>
                {editingMemberId ? t('household.editMember', 'Edit Household Member') : t('household.addMember', 'Add Household Member')}
              </Text>
              <Pressable onPress={() => setShowAddModal(false)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 18, color: palette.textMuted }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: spacing.sm }}>
              <TextField
                label={t('household.fullName', 'Full Name (Optional at initial entry)')}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Name as per ID (or leave blank if unknown)"
              />

              {/* Relationship Picker */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>{t('household.relationship', 'Relationship')}</Text>
                <View style={styles.radioGrid}>
                  {HOUSEHOLD_RELATIONSHIP.map((rel) => {
                    const info = RELATIONSHIP_LABELS[rel];
                    const active = relationship === rel;
                    return (
                      <Pressable
                        key={rel}
                        onPress={() => setRelationship(rel)}
                        style={[styles.relOption, active && styles.relOptionActive]}
                      >
                        <Text style={{ fontSize: 18, marginRight: 4 }}>{info.icon}</Text>
                        <Text style={[styles.relOptionText, active && styles.relOptionTextActive]}>
                          {rel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Gender */}
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>{t('household.gender', 'Gender')}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <Pressable
                      key={g}
                      onPress={() => setGender(g)}
                      style={[styles.smallRadio, gender === g && styles.smallRadioActive]}
                    >
                      <Text style={[styles.smallRadioText, gender === g && styles.smallRadioTextActive]}>
                        {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : 'Other'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Age / DOB */}
              <TextField
                label={t('household.ageYears', 'Age (in completed years)')}
                value={ageYears}
                onChangeText={setAgeYears}
                keyboardType="number-pad"
                placeholder="e.g. 28"
              />

              {/* Phone */}
              <TextField
                label={t('household.phoneOptional', 'Phone Number (Optional)')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="10-digit mobile number"
              />

              {/* Dependent and Roommate Toggles */}
              <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                <Pressable
                  onPress={() => setIsDependent(!isDependent)}
                  style={[styles.toggleCard, isDependent && styles.toggleCardActive]}
                >
                  <Text style={{ fontSize: 20 }}>{isDependent ? '☑️' : '◻️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>{t('household.isDependentTitle', 'Is this member dependent on you?')}</Text>
                    <Text style={styles.toggleSub}>{t('household.isDependentHint', 'Spouse, children, elderly parents')}</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setIsRoommate(!isRoommate)}
                  style={[styles.toggleCard, isRoommate && styles.toggleCardActive]}
                >
                  <Text style={{ fontSize: 20 }}>{isRoommate ? '☑️' : '◻️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleTitle}>{t('household.isRoommateTitle', 'Is this a fellow worker / roommate?')}</Text>
                    <Text style={styles.toggleSub}>{t('household.isRoommateHint', 'Co-worker sharing living accommodation')}</Text>
                  </View>
                </Pressable>
              </View>

              <Button
                label={submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save Member')}
                onPress={handleSubmit}
                disabled={submitting}
                style={{ marginTop: spacing.sm, backgroundColor: palette.primary }}
              />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Visual Workflow Action Guide Modal */}
      <WorkerActionGuide
        visible={helpGuideVisible}
        workflow="add_household"
        onClose={() => setHelpGuideVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.text,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  privacyCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    padding: spacing.md,
  },
  privacyCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 4,
  },
  privacyCardText: {
    fontSize: fontSize.xs,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  memberCard: {
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  memberIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  memberCodeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  editButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F0F4F8',
  },
  memberDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  tag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.text,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  fieldWrapper: {
    marginBottom: spacing.xs,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 6,
  },
  radioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  relOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 44,
  },
  relOptionActive: {
    borderColor: palette.primary,
    backgroundColor: '#EBF4FF',
  },
  relOptionText: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '600',
  },
  relOptionTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  smallRadio: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  smallRadioActive: {
    borderColor: palette.primary,
    backgroundColor: '#EBF4FF',
  },
  smallRadioText: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '600',
  },
  smallRadioTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minHeight: 52,
  },
  toggleCardActive: {
    borderColor: palette.primary,
    backgroundColor: '#F8FAFC',
  },
  toggleTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  toggleSub: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
});
