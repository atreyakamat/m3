/**
 * Consolidated ProfileScreen — Worker Profile, Initial Screening, and Past Check-ins / Test Results.
 *
 * Implements:
 * 1. Three distinct sections/tabs:
 *    - Personal Details
 *    - Initial Screening (Read-Only Sections I–IV baseline)
 *    - Past Check-ins / Test Results (Chronological diagnostic and check-in history)
 * 2. Privacy-preserving Government ID display (masked Aadhaar with toggle).
 * 3. Read-only registration construction site with transfer request CTA.
 * 4. Language switcher across all 18 supported languages.
 * 5. Full offline viewing support with cached records.
 * 6. Strict result rules: Positive, Negative, Awaiting result, No result recorded.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  WORKER_SCREENING_SECTIONS,
  ALLOWED_CORRECTION_FIELDS,
  type Language,
  type QuestionField,
} from '@m3/shared';
import { Card, Body, Button, SelectRow, TextField } from '@/components/ui';
import { MalariaStatusChip } from '@/components/StatusChips';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import {
  workerApi,
  screeningApi,
  recordsApi,
  type WorkerProfile,
  type ScreeningRecordDto,
  type EpisodeDto,
  type FollowUpDto,
  type HouseholdResponse,
  isNetworkError,
} from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { screeningLocalRepo } from '@/services/screeningLocal';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

type TabKey = 'personal' | 'screening' | 'records';

interface HistoricalRecord {
  id: string;
  date: string;
  episodeStatus?: string;
  hasDiagnostic: boolean;
  diagnosticDate?: string | null;
  testType?: string | null;
  result: 'POSITIVE' | 'NEGATIVE' | 'AWAITING' | 'NO_RESULT';
  species?: string | null;
  facility?: string | null;
  prescriptions: Array<{
    id: string;
    details: string;
    issuedAt: string;
  }>;
  followUps: Array<{
    id: string;
    question: string;
    response: string | null;
    note?: string | null;
    date: string;
  }>;
}

function isFieldVisible(field: QuestionField, answers: Record<string, unknown>): boolean {
  if (!field.showIf) return true;
  const actual = answers[field.showIf.field];
  const expected = field.showIf.equals;
  if (typeof expected === 'boolean') {
    return actual === expected || actual === (expected ? 'yes' : 'no');
  }
  return actual === expected;
}

function formatMaskedAadhaar(idNum: string, show: boolean): string {
  const digits = idNum.replace(/\s+/g, '');
  if (digits.length !== 12) return show ? idNum : '••••••••';
  if (show) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }
  return `•••• •••• ${digits.slice(8)}`;
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const { token, user, language, setLanguage } = useSession();

  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [screening, setScreening] = useState<ScreeningRecordDto | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [records, setRecords] = useState<HistoricalRecord[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const [showId, setShowId] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);

  // Household & Profile Correction state
  const [householdStats, setHouseholdStats] = useState<{ totalCount: number; dependentCount: number; roommateCount: number } | null>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [selectedField, setSelectedField] = useState<string>('fullName');
  const [proposedValue, setProposedValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Sync tab from navigation query param if provided
  useEffect(() => {
    if (initialTab === 'screening') setActiveTab('screening');
    else if (initialTab === 'records' || initialTab === 'checkins') setActiveTab('records');
  }, [initialTab]);

  const loadData = useCallback(async () => {
    if (!token) return;
    const workerId = user?.workerId || user?.userId || 'current_worker';
    const profileCacheKey = `m3_profile_cache_${workerId}`;
    const clinicalCacheKey = `m3_clinical_cache_${workerId}`;

    try {
      // 1. Fetch live worker profile, household, and corrections
      const [p, s, epList, fList, hhRes, corrRes] = await Promise.all([
        workerApi.me(token).catch((err) => {
          if (isNetworkError(err)) return null;
          throw err;
        }),
        screeningApi.get(token).catch(() => null),
        recordsApi.episodes(token).catch(() => [] as EpisodeDto[]),
        recordsApi.followUps(token).catch(() => [] as FollowUpDto[]),
        workerApi.getHousehold(token).catch(() => null),
        workerApi.getCorrections(token).catch(() => [] as any[]),
      ]);

      if (hhRes && hhRes.stats) {
        setHouseholdStats(hhRes.stats);
      }
      if (corrRes) {
        setCorrections(corrRes);
      }

      if (p) {
        setProfile(p);
        setOffline(false);
        // Cache profile
        void AsyncStorage.setItem(profileCacheKey, JSON.stringify(p)).catch(() => {});
      } else {
        // Read cached profile
        setOffline(true);
        const cached = await AsyncStorage.getItem(profileCacheKey);
        if (cached) setProfile(JSON.parse(cached) as WorkerProfile);
      }

      // Screening answers: Server record or local SQLite record
      const localScreening = screeningLocalRepo.getLocal(workerId);
      if (s) {
        setScreening(s);
        setAnswers(s.answers || {});
      } else if (localScreening) {
        setScreening({
          id: localScreening.id,
          workerId,
          status: localScreening.status,
          version: 'worker-screening-local',
          consentGiven: localScreening.consentGiven,
          answers: localScreening.answers,
          completedAt: localScreening.updatedAt,
          createdAt: localScreening.updatedAt,
          updatedAt: localScreening.updatedAt,
        });
        setAnswers(localScreening.answers || {});
      }

      // Process clinical records & episodes
      let unified: HistoricalRecord[] = [];
      if (epList && epList.length > 0) {
        unified = epList.map((ep) => {
          const diag = ep.diagnostics && ep.diagnostics.length > 0 ? ep.diagnostics[0] : null;
          let res: 'POSITIVE' | 'NEGATIVE' | 'AWAITING' | 'NO_RESULT' = 'NO_RESULT';

          if (diag) {
            if (diag.result === 'POSITIVE') res = 'POSITIVE';
            else if (diag.result === 'NEGATIVE') res = 'NEGATIVE';
            else res = 'NO_RESULT';
          } else if (ep.status !== 'RESOLVED') {
            res = 'AWAITING';
          } else {
            res = 'NO_RESULT';
          }

          const matchedFollowUps = (fList || []).filter((f) => f.episodeId === ep.id);

          return {
            id: ep.id,
            date: diag?.testDate || ep.onsetDate || ep.createdAt,
            episodeStatus: ep.status,
            hasDiagnostic: Boolean(diag),
            diagnosticDate: diag?.testDate ?? null,
            testType: diag?.testType ?? null,
            result: res,
            species: diag?.species ?? null,
            facility: null,
            prescriptions: (ep.prescriptions || []).map((rx) => ({
              id: rx.id,
              details: rx.details,
              issuedAt: rx.issuedAt,
            })),
            followUps: matchedFollowUps.map((fu) => ({
              id: fu.id,
              question: fu.question,
              response: fu.response,
              note: fu.note,
              date: fu.respondedAt || fu.createdAt,
            })),
          };
        });
      }

      // Also capture any standalone follow-ups not matched to episodes
      const matchedFuIds = new Set(unified.flatMap((u) => u.followUps.map((f) => f.id)));
      const standalone = (fList || []).filter((f) => !matchedFuIds.has(f.id));
      for (const sFu of standalone) {
        unified.push({
          id: sFu.id,
          date: sFu.respondedAt || sFu.createdAt,
          hasDiagnostic: false,
          result: 'NO_RESULT',
          prescriptions: [],
          followUps: [
            {
              id: sFu.id,
              question: sFu.question,
              response: sFu.response,
              note: sFu.note,
              date: sFu.respondedAt || sFu.createdAt,
            },
          ],
        });
      }

      // Sort chronological, newest record first
      unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (epList.length > 0 || fList.length > 0) {
        setRecords(unified);
        void AsyncStorage.setItem(clinicalCacheKey, JSON.stringify(unified)).catch(() => {});
      } else {
        // Read cached clinical records if offline
        const cachedClinical = await AsyncStorage.getItem(clinicalCacheKey);
        if (cachedClinical) {
          setRecords(JSON.parse(cachedClinical) as HistoricalRecord[]);
        } else {
          setRecords([]);
        }
      }
    } catch {
      setOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const FIELD_LABELS: Record<string, string> = {
    fullName: 'Full Name',
    phone: 'Mobile Phone Number',
    dateOfBirth: 'Date of Birth (YYYY-MM-DD)',
    gender: 'Gender',
    permanentAddressPincode: 'Permanent Address PIN Code',
    permanentAddressDistrict: 'Permanent Address District',
    permanentAddressState: 'Permanent Address State',
    permanentAddressDetails: 'Permanent Address Details',
  };

  const handleCorrectionSubmit = async () => {
    if (!token) return;
    if (!proposedValue.trim()) {
      Alert.alert('Required Field', 'Please enter the proposed new value.');
      return;
    }
    if (!correctionReason.trim()) {
      Alert.alert('Required Field', 'Please explain the reason for this correction.');
      return;
    }

    setSubmittingCorrection(true);
    const payload = {
      field: selectedField,
      proposedValue: proposedValue.trim(),
      reason: correctionReason.trim(),
    };
    try {
      await workerApi.requestCorrection(token, payload);
      Alert.alert('Success', 'Profile correction request submitted for administrative review.');
      setProposedValue('');
      setCorrectionReason('');
      setShowCorrectionForm(false);
      const updated = await workerApi.getCorrections(token);
      setCorrections(updated);
    } catch (err: any) {
      if (isNetworkError(err)) {
        outboxRepo.enqueue({
          entityType: 'profile_correction',
          localId: uuid(),
          payload,
        });
        setProposedValue('');
        setCorrectionReason('');
        setShowCorrectionForm(false);
        Alert.alert('Saved Offline', 'Profile correction saved offline. It will be submitted for review when connectivity returns.');
      } else {
        Alert.alert('Submission Error', err?.message || 'Could not submit correction request.');
      }
    } finally {
      setSubmittingCorrection(false);
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'bottom']}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  // ── Address computation from answers ──
  const presentAddressMode = answers['present_address_type'];
  let presentAddressText = t('profile.notProvided');
  if (presentAddressMode === 'site_premises') {
    presentAddressText = profile?.currentSite
      ? `${profile.currentSite.name} · ${profile.currentSite.area}`
      : String(answers['present_address_site_name'] || 'Construction site premises');
  } else if (presentAddressMode === 'other_location') {
    const parts = [
      answers['present_address_area'],
      answers['present_address_taluka'],
      answers['present_address_district'] || 'Goa',
    ].filter(Boolean);
    presentAddressText = parts.join(', ');
    if (answers['present_address_extra']) {
      presentAddressText += ` (${answers['present_address_extra']})`;
    }
  } else if (answers['present_address']) {
    presentAddressText = String(answers['present_address']);
  }

  const permanentAddressParts = [
    answers['permanent_address_pincode'] ? `PIN: ${answers['permanent_address_pincode']}` : null,
    answers['permanent_address_district'],
    answers['permanent_address_state'],
  ].filter(Boolean);
  let permanentAddressText = permanentAddressParts.join(', ') || t('profile.notProvided');
  if (answers['permanent_address_details']) {
    permanentAddressText += `\n${answers['permanent_address_details']}`;
  } else if (answers['permanent_address'] && !permanentAddressParts.length) {
    permanentAddressText = String(answers['permanent_address']);
  }

  const govIdType = (answers['gov_id_type'] as string) || '';
  const govIdNum = (answers['gov_id_number'] as string) || '';
  const isAadhaar = govIdType === 'aadhaar';
  const displayGovId = isAadhaar ? formatMaskedAadhaar(govIdNum, showId) : (govIdNum || t('profile.notProvided'));

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      {/* Coloured Header with Back & Language Selector */}
      <WorkerHeader
        title={profile?.name || user?.displayName || t('nav.profile')}
        subtitle={user?.workerId ? `${t('dashboard.workerId')}: ${user.workerId}` : undefined}
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
      />

      <View style={styles.header}>
        {/* Three Consolidated Tabs */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'personal' }}
            onPress={() => setActiveTab('personal')}
            style={[styles.tabItem, activeTab === 'personal' && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, activeTab === 'personal' && styles.tabLabelActive]}>
              {t('profile.tabPersonal')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'screening' }}
            onPress={() => setActiveTab('screening')}
            style={[styles.tabItem, activeTab === 'screening' && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, activeTab === 'screening' && styles.tabLabelActive]}>
              {t('profile.tabScreening')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'records' }}
            onPress={() => setActiveTab('records')}
            style={[styles.tabItem, activeTab === 'records' && styles.tabItemActive]}
          >
            <Text style={[styles.tabLabel, activeTab === 'records' && styles.tabLabelActive]}>
              {t('profile.tabRecords')}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {offline ? (
          <Card accent={palette.warning}>
            <Body>{t('status.offline')}</Body>
          </Card>
        ) : null}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION A: PERSONAL DETAILS
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'personal' && (
          <View style={styles.sectionContainer}>
            {/* Identity Card */}
            <Card accent={palette.primary}>
              <Text style={styles.cardHeaderTitle}>{t('profile.tabPersonal')}</Text>

              <DetailRow label={t('profile.fullName')} value={String(answers['full_name'] || profile?.name || '—')} />
              <DetailRow label={t('profile.dob')} value={String(answers['date_of_birth'] || '—')} />
              <DetailRow
                label={t('profile.age')}
                value={answers['age_years'] != null ? `${answers['age_years']} years` : '—'}
              />
              <DetailRow
                label={t('profile.gender')}
                value={
                  answers['gender'] === 'male'
                    ? t('q.opt_male', 'Male')
                    : answers['gender'] === 'female'
                    ? t('q.opt_female', 'Female')
                    : String(answers['gender'] || '—')
                }
              />
              <DetailRow
                label={t('profile.phone')}
                value={profile?.phone || String(answers['mobile_number'] || '—')}
                badge="🔒 Read-only"
              />
              <DetailRow
                label={t('profile.altPhone')}
                value={String(answers['alternate_contact'] || t('profile.notProvided'))}
              />

              {/* Government ID with Masking & Toggle */}
              <View style={styles.idRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t('profile.govId')}</Text>
                  <Text style={styles.idSubLabel}>
                    {govIdType === 'aadhaar' ? 'Aadhaar' : govIdType === 'voter_id' ? 'Voter ID' : 'Other ID'}:
                  </Text>
                  <Text style={styles.rowValue}>{displayGovId}</Text>
                </View>
                {isAadhaar && govIdNum.length === 12 ? (
                  <Pressable onPress={() => setShowId(!showId)} style={styles.toggleIdButton}>
                    <Text style={styles.toggleIdText}>{showId ? t('profile.hideId') : t('profile.showId')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>

            {/* Addresses Card */}
            <Card accent={palette.info}>
              <Text style={styles.cardHeaderTitle}>{t('profile.presentAddress')}</Text>
              <Text style={styles.addressBody}>{presentAddressText}</Text>

              <View style={styles.divider} />

              <Text style={styles.cardHeaderTitle}>{t('profile.permanentAddress')}</Text>
              <Text style={styles.addressBody}>{permanentAddressText}</Text>
            </Card>

            {/* Registered Construction Site Card */}
            <Card accent={palette.secondary}>
              <Text style={styles.cardHeaderTitle}>{t('profile.registeredSite')}</Text>
              <Text style={styles.siteName}>{profile?.currentSite?.name ?? t('dashboard.noSite')}</Text>
              <Text style={styles.siteArea}>📍 {profile?.currentSite?.area ?? '—'}</Text>
              {profile?.currentSite?.since ? (
                <Text style={styles.siteSince}>
                  Assigned: {new Date(profile.currentSite.since).toLocaleDateString()}
                </Text>
              ) : null}

              <View style={styles.siteNoticeBox}>
                <Text style={styles.siteNoticeText}>{t('profile.siteChangeNotice')}</Text>
              </View>

              <Button
                label={t('profile.requestTransfer')}
                onPress={() => router.push('/(worker)/transfer')}
                variant="secondary"
              />
            </Card>

            {/* Preferred Language Card */}
            <Card accent={palette.accent}>
              <View style={styles.langHeader}>
                <View>
                  <Text style={styles.cardHeaderTitle}>{t('profile.preferredLanguage')}</Text>
                  <Text style={styles.langCurrent}>
                    {LANGUAGE_LABELS[language as Language] || 'English'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowLangPicker(!showLangPicker)}
                  style={styles.langChangeBtn}
                >
                  <Text style={styles.langChangeText}>
                    {showLangPicker ? t('common.cancel') : t('common.retry', 'Change')}
                  </Text>
                </Pressable>
              </View>

              {showLangPicker ? (
                <View style={{ marginTop: spacing.md }}>
                  {LANGUAGES.map((lng) => (
                    <SelectRow
                      key={lng}
                      label={LANGUAGE_LABELS[lng as Language]}
                      selected={language === lng}
                      onPress={() => {
                        void setLanguage(lng as Language);
                        setShowLangPicker(false);
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </Card>

            {/* ══════════════════════════════════════════════════════════════
                FAMILY & HOUSEHOLD MEMBERS SUMMARY CARD
               ══════════════════════════════════════════════════════════════ */}
            <Card accent="#8B5CF6">
              <View style={styles.cardTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardHeaderTitle}>👨‍👩‍👧 Family & Household</Text>
                  <Text style={styles.cardHeaderSubtitle}>Co-located dependents and room members</Text>
                </View>
                <AudioGuidanceButton
                  text="Your registered family and room members. You can view, add, or update family members and room members."
                  label="Listen"
                  size="small"
                />
              </View>

              <View style={styles.householdStatsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{householdStats?.totalCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{householdStats?.dependentCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Dependents</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{householdStats?.roommateCount ?? 0}</Text>
                  <Text style={styles.statLabel}>Roommates</Text>
                </View>
              </View>

              <View style={styles.privacyNoticeBox}>
                <Text style={styles.privacyNoticeText}>
                  🛡️ Strict Privacy Barrier: Contractors and site supervisors can only see aggregate headcounts. Names and medical records remain private.
                </Text>
              </View>

              <Button
                label="Manage Family & Household Members"
                onPress={() => router.push('/(worker)/household')}
                variant="primary"
              />
            </Card>

            {/* ══════════════════════════════════════════════════════════════
                DEMOGRAPHIC PROFILE CORRECTIONS (ALLOWLIST ENFORCED)
               ══════════════════════════════════════════════════════════════ */}
            <Card accent="#F59E0B">
              <View style={styles.cardTitleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardHeaderTitle}>✏️ Profile Corrections</Text>
                  <Text style={styles.cardHeaderSubtitle}>Demographic details only</Text>
                </View>
                <AudioGuidanceButton
                  text="You can request corrections to your name, phone number, date of birth, gender, or permanent address. Medical records and Worker ID cannot be edited."
                  label="Listen"
                  size="small"
                />
              </View>

              <View style={styles.correctionNoticeBox}>
                <Text style={styles.correctionNoticeText}>
                  ⚠️ Strict Administrative Policy: You can request corrections to demographic fields only. Medical test results, diagnoses, prescriptions, and Worker IDs cannot be changed.
                </Text>
              </View>

              {!showCorrectionForm ? (
                <Button
                  label="Request Demographic Correction"
                  onPress={() => setShowCorrectionForm(true)}
                  variant="secondary"
                />
              ) : (
                <View style={styles.correctionFormBox}>
                  <Text style={styles.formFieldLabel}>Select Field to Correct:</Text>
                  <View style={styles.fieldPickerContainer}>
                    {ALLOWED_CORRECTION_FIELDS.map((fld) => (
                      <Pressable
                        key={fld}
                        onPress={() => setSelectedField(fld)}
                        style={[
                          styles.fieldChip,
                          selectedField === fld && styles.fieldChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.fieldChipText,
                            selectedField === fld && styles.fieldChipTextSelected,
                          ]}
                        >
                          {FIELD_LABELS[fld] || fld}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.formFieldLabel}>Proposed New Value:</Text>
                  <TextField
                    value={proposedValue}
                    onChangeText={setProposedValue}
                    placeholder={`Enter correct ${FIELD_LABELS[selectedField] || selectedField}`}
                  />

                  <Text style={styles.formFieldLabel}>Reason for Correction:</Text>
                  <TextField
                    value={correctionReason}
                    onChangeText={setCorrectionReason}
                    placeholder="e.g. Typo in spelling, official government ID update"
                  />

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Submit Request"
                        onPress={handleCorrectionSubmit}
                        loading={submittingCorrection}
                        variant="primary"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Cancel"
                        onPress={() => setShowCorrectionForm(false)}
                        variant="ghost"
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Correction History */}
              {corrections.length > 0 ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <Text style={styles.subHeading}>Past Correction Requests ({corrections.length}):</Text>
                  {corrections.map((c) => (
                    <View key={c.id} style={styles.correctionHistoryCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.correctionHistoryField}>{FIELD_LABELS[c.field] || c.field}</Text>
                        <View
                          style={[
                            styles.statusBadgeSmall,
                            c.status === 'APPROVED' && styles.statusBadgeApproved,
                            c.status === 'REJECTED' && styles.statusBadgeRejected,
                            c.status === 'SUBMITTED' && styles.statusBadgeSubmitted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeSmallText,
                              c.status === 'APPROVED' && styles.statusTextApproved,
                              c.status === 'REJECTED' && styles.statusTextRejected,
                              c.status === 'SUBMITTED' && styles.statusTextSubmitted,
                            ]}
                          >
                            {c.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.correctionHistoryValue}>
                        Proposed: "{c.proposedValue}"
                      </Text>
                      <Text style={styles.correctionHistoryMeta}>
                        📅 {new Date(c.createdAt).toLocaleDateString()} · Reason: {c.reason}
                      </Text>
                      {c.adminNote ? (
                        <Text style={styles.adminNoteText}>
                          Admin Note: {c.adminNote}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION B: INITIAL SCREENING (READ-ONLY BASELINE)
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'screening' && (
          <View style={styles.sectionContainer}>
            {profile?.screening?.status === 'COMPLETE' || screening?.status === 'COMPLETE' ? (
              <>
                <Card accent={palette.success}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.screeningSuccessTitle}>{t('profile.screeningCompleted')}</Text>
                    <Text style={styles.statusBadge}>✓ Verified Baseline</Text>
                  </View>
                  <Text style={styles.screeningMetaText}>
                    📅 Submitted: {screening?.completedAt ? new Date(screening.completedAt).toLocaleDateString() : 'Recorded'}
                  </Text>
                  <Text style={styles.screeningMetaText}>
                    👤 Worker ID: {profile?.workerId || user?.workerId || '—'}
                  </Text>
                </Card>

                {/* Sections I–IV Structured Answers */}
                {WORKER_SCREENING_SECTIONS.map((sec) => (
                  <View key={sec.id} style={styles.screeningSectionCard}>
                    <Text style={styles.screeningSectionHeader}>{t('q.' + sec.id, sec.title)}</Text>
                    {sec.fields.map((f) => {
                      if (!isFieldVisible(f, answers)) return null;
                      const val = answers[f.id];
                      if (val === undefined || val === null || val === '') return null;

                      let displayVal = String(val);
                      if (Array.isArray(val)) displayVal = val.join(', ');
                      if (val === 'yes' || val === true) displayVal = t('common.yes');
                      if (val === 'no' || val === false) displayVal = t('common.no');

                      return (
                        <View key={f.id} style={styles.screeningRow}>
                          <Text style={styles.screeningLabel}>{t('q.' + f.id, f.label)}:</Text>
                          <Text style={styles.screeningVal}>{displayVal}</Text>
                        </View>
                      );
                    })}
                  </View>
                ))}

                <View style={styles.lockNotice}>
                  <Text style={styles.lockNoticeText}>🔒 {t('profile.lockedNotice')}</Text>
                </View>
              </>
            ) : (
              <Card accent={palette.warning}>
                <Text style={styles.screeningIncompleteTitle}>{t('profile.screeningIncomplete')}</Text>
                <Body muted style={{ marginVertical: spacing.sm }}>
                  {t('profile.screeningIncompleteDesc')}
                </Body>
                <Button
                  label={t('profile.resumeScreening')}
                  onPress={() => router.push('/(worker)/screening')}
                  variant="primary"
                />
              </Card>
            )}
          </View>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION C: PAST CHECK-INS / TEST RESULTS
           ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'records' && (
          <View style={styles.sectionContainer}>
            <View style={styles.recordsHeaderRow}>
              <Text style={styles.recordsTitle}>{t('profile.tabRecords')}</Text>
              <Text style={styles.recordsCountBadge}>{records.length} records</Text>
            </View>

            {records.length === 0 ? (
              <Card>
                <Body muted style={styles.emptyStateText}>{t('profile.emptyRecords')}</Body>
              </Card>
            ) : (
              records.map((rec) => {
                const isExpanded = Boolean(expandedIds[rec.id]);
                const isPositive = rec.result === 'POSITIVE';
                const isNegative = rec.result === 'NEGATIVE';
                const isAwaiting = rec.result === 'AWAITING';

                const resultColor = isPositive
                  ? palette.danger
                  : isNegative
                  ? palette.success
                  : isAwaiting
                  ? palette.warning
                  : palette.textMuted;

                const resultBg = isPositive
                  ? '#FEF2F2'
                  : isNegative
                  ? '#ECFDF5'
                  : isAwaiting
                  ? '#FFFBEB'
                  : palette.surfaceAlt;

                const resultLabel =
                  rec.result === 'POSITIVE'
                    ? t('profile.resultPositive')
                    : rec.result === 'NEGATIVE'
                    ? t('profile.resultNegative')
                    : rec.result === 'AWAITING'
                    ? t('profile.resultAwaiting')
                    : t('profile.resultNoResult');

                return (
                  <View key={rec.id} style={[styles.recordCard, { borderLeftColor: resultColor }]}>
                    <Pressable
                      onPress={() => toggleExpand(rec.id)}
                      style={styles.recordCardHeader}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.recordDate}>
                          📅 {new Date(rec.date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.recordMethod}>
                          {rec.testType ? `Test: ${rec.testType}` : 'Clinical Assessment / Check-in'}
                          {rec.species ? ` · ${rec.species.replace('_', '. ')}` : ''}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={[styles.resultChip, { backgroundColor: resultBg }]}>
                          <Text style={[styles.resultChipText, { color: resultColor }]}>
                            {resultLabel}
                          </Text>
                        </View>
                        <Text style={styles.expandActionText}>
                          {isExpanded ? '▲ Hide' : '▼ Details'}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Expandable Clinical Record Details */}
                    {isExpanded && (
                      <View style={styles.expandedContent}>
                        <View style={styles.divider} />

                        <DetailRow
                          label={t('profile.assessmentDate')}
                          value={new Date(rec.date).toLocaleDateString()}
                        />
                        {rec.diagnosticDate && rec.diagnosticDate !== rec.date ? (
                          <DetailRow
                            label={t('profile.testDate')}
                            value={new Date(rec.diagnosticDate).toLocaleDateString()}
                          />
                        ) : null}

                        <DetailRow
                          label={t('profile.testType')}
                          value={rec.testType || 'Clinical evaluation'}
                        />
                        <DetailRow label={t('profile.diagnosticResult')} value={resultLabel} />
                        {rec.species ? (
                          <DetailRow
                            label={t('profile.species')}
                            value={rec.species.replace('_', '. ')}
                          />
                        ) : null}
                        <DetailRow
                          label={t('profile.facility')}
                          value={profile?.currentSite?.name ? `${profile.currentSite.name} (${profile.currentSite.area})` : 'Authorized Surveillance Unit'}
                        />

                        {/* Prescriptions Block */}
                        <View style={{ marginTop: spacing.sm }}>
                          <Text style={styles.subSectionTitle}>{t('profile.prescriptions')}</Text>
                          {rec.prescriptions.length > 0 ? (
                            rec.prescriptions.map((rx) => (
                              <View key={rx.id} style={styles.rxCard}>
                                <Text style={styles.rxDetails}>💊 {rx.details}</Text>
                                <Text style={styles.rxDate}>
                                  Issued: {new Date(rx.issuedAt).toLocaleDateString()}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.emptySubText}>
                              {isPositive
                                ? 'Prescription will appear here once issued by clinician.'
                                : t('profile.noPrescription')}
                            </Text>
                          )}
                        </View>

                        {/* Follow-up Information Block */}
                        <View style={{ marginTop: spacing.sm }}>
                          <Text style={styles.subSectionTitle}>{t('profile.followUps')}</Text>
                          {rec.followUps.length > 0 ? (
                            rec.followUps.map((fu) => (
                              <View key={fu.id} style={styles.fuCard}>
                                <Text style={styles.fuQuestion}>Q: {fu.question}</Text>
                                <Text style={styles.fuResponse}>
                                  Response: {fu.response || 'Pending response'}
                                </Text>
                                {fu.note ? <Text style={styles.fuNote}>Note: {fu.note}</Text> : null}
                                <Text style={styles.fuDate}>
                                  Date: {new Date(fu.date).toLocaleDateString()}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.emptySubText}>{t('profile.noFollowUps')}</Text>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={t('common.dashboard')}
            onPress={() => router.replace('/(worker)/dashboard')}
            variant="ghost"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={styles.rowValue}>{value}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, color: palette.textMuted, fontSize: fontSize.sm },
  header: { backgroundColor: palette.primary },
  headerContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerSubtitle: { color: palette.primarySoft, fontSize: fontSize.xs, textTransform: 'uppercase' },
  headerTitle: { color: palette.textOnColor, fontSize: fontSize.xl, fontWeight: '800', marginVertical: 2 },
  headerMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  headerWorkerId: { color: palette.primarySoft, fontSize: fontSize.sm },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F766E', // slightly darker primary for contrast
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  tabItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: palette.accent,
  },
  tabLabel: {
    color: '#CCFBF1',
    fontSize: fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: palette.textOnColor,
    fontWeight: '800',
  },

  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sectionContainer: {
    gap: spacing.md,
  },
  cardHeaderTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  rowLabel: { fontSize: fontSize.sm, color: palette.textMuted },
  rowValue: { fontSize: fontSize.sm, fontWeight: '600', color: palette.text },
  badge: { fontSize: 10, color: palette.primaryDark, backgroundColor: palette.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  idSubLabel: { fontSize: fontSize.xs, color: palette.textMuted, marginTop: 2 },
  toggleIdButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: palette.surfaceAlt,
    borderWidth: 1,
    borderColor: palette.border,
  },
  toggleIdText: { fontSize: fontSize.xs, fontWeight: '600', color: palette.text },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: spacing.sm },
  addressBody: { fontSize: fontSize.sm, color: palette.text, lineHeight: 20 },
  siteName: { fontSize: fontSize.md, fontWeight: '700', color: palette.text },
  siteArea: { fontSize: fontSize.xs, color: palette.textMuted, marginVertical: 2 },
  siteSince: { fontSize: 11, color: palette.textMuted, marginBottom: spacing.xs },
  siteNoticeBox: {
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginVertical: spacing.xs,
  },
  siteNoticeText: { fontSize: fontSize.xs, color: '#92400E', lineHeight: 16 },
  langHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langCurrent: { fontSize: fontSize.sm, color: palette.primaryDark, fontWeight: '700' },
  langChangeBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: palette.surfaceAlt },
  langChangeText: { fontSize: fontSize.xs, fontWeight: '600', color: palette.primary },

  screeningSuccessTitle: { fontSize: fontSize.md, fontWeight: '700', color: '#065F46' },
  statusBadge: { fontSize: fontSize.xs, fontWeight: '700', color: '#065F46', backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  screeningMetaText: { fontSize: fontSize.xs, color: palette.textMuted, marginTop: 2 },
  screeningSectionCard: {
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.card,
    gap: spacing.xs,
  },
  screeningSectionHeader: { fontSize: fontSize.sm, fontWeight: '700', color: palette.primaryDark, marginBottom: 4 },
  screeningRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  screeningLabel: { fontSize: fontSize.xs, color: palette.textMuted, flex: 1, marginRight: spacing.sm },
  screeningVal: { fontSize: fontSize.xs, fontWeight: '600', color: palette.text, textAlign: 'right', flex: 1 },
  lockNotice: { backgroundColor: '#F3F4F6', padding: spacing.md, borderRadius: radius.md },
  lockNoticeText: { fontSize: fontSize.xs, color: palette.textMuted, lineHeight: 16, textAlign: 'center' },
  screeningIncompleteTitle: { fontSize: fontSize.md, fontWeight: '700', color: palette.warning },

  recordsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  recordsTitle: { fontSize: fontSize.md, fontWeight: '700', color: palette.text },
  recordsCountBadge: { fontSize: fontSize.xs, color: palette.textMuted, fontWeight: '600' },
  emptyStateText: { textAlign: 'center', paddingVertical: spacing.md },
  recordCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 4,
    ...shadow.card,
    overflow: 'hidden',
  },
  recordCardHeader: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordDate: { fontSize: fontSize.sm, fontWeight: '700', color: palette.text },
  recordMethod: { fontSize: fontSize.xs, color: palette.textMuted, marginTop: 2 },
  resultChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  resultChipText: { fontSize: fontSize.xs, fontWeight: '700' },
  expandActionText: { fontSize: 11, color: palette.primary, fontWeight: '600' },
  expandedContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#FAFAFA',
  },
  subSectionTitle: { fontSize: fontSize.xs, fontWeight: '700', color: palette.text, marginVertical: 4 },
  rxCard: { backgroundColor: '#FFFFFF', padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: '#E5E7EB', marginVertical: 2 },
  rxDetails: { fontSize: fontSize.xs, color: palette.text, fontWeight: '600' },
  rxDate: { fontSize: 10, color: palette.textMuted, marginTop: 2 },
  fuCard: { backgroundColor: '#FFFFFF', padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: '#E5E7EB', marginVertical: 2 },
  fuQuestion: { fontSize: fontSize.xs, color: palette.textMuted },
  fuResponse: { fontSize: fontSize.xs, fontWeight: '700', color: palette.primaryDark, marginTop: 2 },
  fuNote: { fontSize: 10, color: palette.text, fontStyle: 'italic', marginTop: 1 },
  fuDate: { fontSize: 10, color: palette.textMuted, marginTop: 2 },
  emptySubText: { fontSize: fontSize.xs, color: palette.textMuted, fontStyle: 'italic', marginVertical: 2 },

  // New Card & Form styles
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cardHeaderSubtitle: { fontSize: fontSize.xs, color: palette.textMuted, marginTop: 1 },
  householdStatsGrid: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm },
  statBox: {
    flex: 1,
    backgroundColor: '#F5F3FF',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  statNumber: { fontSize: fontSize.lg, fontWeight: '800', color: '#6D28D9' },
  statLabel: { fontSize: 11, fontWeight: '600', color: '#6D28D9', marginTop: 2 },
  privacyNoticeBox: {
    backgroundColor: '#F5F3FF',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: spacing.sm,
  },
  privacyNoticeText: { fontSize: fontSize.xs, color: '#5B21B6', lineHeight: 16 },
  correctionNoticeBox: {
    backgroundColor: '#FFFBEB',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: spacing.sm,
  },
  correctionNoticeText: { fontSize: fontSize.xs, color: '#92400E', lineHeight: 16 },
  correctionFormBox: {
    backgroundColor: '#F9FAFB',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: spacing.xs,
  },
  formFieldLabel: { fontSize: fontSize.xs, fontWeight: '700', color: palette.text, marginTop: 4 },
  fieldPickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  fieldChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  fieldChipSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  fieldChipText: { fontSize: 11, color: palette.textMuted },
  fieldChipTextSelected: { color: '#B45309', fontWeight: '700' },
  subHeading: { fontSize: fontSize.xs, fontWeight: '700', color: palette.textMuted, marginTop: spacing.xs },
  correctionHistoryCard: {
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 3,
  },
  correctionHistoryField: { fontSize: fontSize.xs, fontWeight: '700', color: palette.text },
  correctionHistoryValue: { fontSize: fontSize.xs, color: palette.primaryDark },
  correctionHistoryMeta: { fontSize: 10, color: palette.textMuted },
  adminNoteText: { fontSize: 10, color: '#4B5563', fontStyle: 'italic', marginTop: 2 },
  statusBadgeSmall: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeSubmitted: { backgroundColor: '#FEF3C7' },
  statusBadgeApproved: { backgroundColor: '#D1FAE5' },
  statusBadgeRejected: { backgroundColor: '#FEE2E2' },
  statusBadgeSmallText: { fontSize: 10, fontWeight: '700' },
  statusTextSubmitted: { color: '#B45309' },
  statusTextApproved: { color: '#065F46' },
  statusTextRejected: { color: '#991B1B' },
});
