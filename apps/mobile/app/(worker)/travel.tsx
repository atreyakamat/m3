/**
 * TravelScreen — Simplified, accessible travel reporting with two prominent
 * color-coded actions: Leaving Goa and Entering Goa. Designed for workers
 * with low literacy with large touch targets, icons, and audio guidance.
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
import { useLocalSearchParams } from 'expo-router';
import { INDIAN_STATES, type IndianState } from '@m3/shared';
import { Card, Body, TextField, Button } from '@/components/ui';
import { DatePickerField } from '@/components/DatePickerField';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { recordsApi, travelApi, isNetworkError, type TravelRecordDto } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { travelLocalRepo, type LocalTravelRecord } from '@/services/travelLocal';
import { flushOutbox } from '@/services/sync';
import {
  WorkerGuideCard,
  WorkerActionGuide,
  WorkerEmptyStateIllustration,
} from '@/components/worker-guide';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

type ActionTab = 'none' | 'leaving' | 'entering' | 'report';

export default function TravelScreen() {
  const { t, i18n } = useTranslation();
  const { token } = useSession();
  const params = useLocalSearchParams<{ action?: string }>();

  const [records, setRecords] = useState<TravelRecordDto[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActionTab>(() => {
    if (params.action === 'leaving' || params.action === 'entering' || params.action === 'report') {
      return params.action as ActionTab;
    }
    return 'none';
  });
  const [helpGuideVisible, setHelpGuideVisible] = useState(false);

  // State selection modal
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [stateModalTarget, setStateModalTarget] = useState<'destination' | 'origin'>('destination');

  // Leaving Goa form states
  const [leavingDate, setLeavingDate] = useState(new Date().toISOString().slice(0, 10));
  const [destState, setDestState] = useState<string>('Bihar');
  const [destDistrict, setDestDistrict] = useState('');
  const [destTown, setDestTown] = useState('');
  const [hasExpectedReturn, setHasExpectedReturn] = useState(false);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  // Entering Goa form states
  const [enteringDate, setEnteringDate] = useState(new Date().toISOString().slice(0, 10));
  const [originState, setOriginState] = useState<string>('Bihar');
  const [originDistrict, setOriginDistrict] = useState('');
  const [originTown, setOriginTown] = useState('');
  const [hadFever, setHadFever] = useState<'yes' | 'no'>('no');
  const [treatmentGiven, setTreatmentGiven] = useState<'yes' | 'no'>('no');
  const [completedCourse, setCompletedCourse] = useState<'yes' | 'no'>('no');

  // Travel Report states
  const [reportComment, setReportComment] = useState('');
  const [reportTravelRecordId, setReportTravelRecordId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (token) {
      try {
        await flushOutbox(token);
        const remote = await recordsApi.travel(token);
        setRecords(remote);
        try {
          const reps = await travelApi.getReports(token);
          setReports(reps || []);
        } catch { /* non-fatal */ }
      } catch {
        // Fallback to local
        const local = travelLocalRepo.listAll();
        setRecords(local as any);
      }
    } else {
      const local = travelLocalRepo.listAll();
      setRecords(local as any);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (params.action === 'leaving' || params.action === 'entering' || params.action === 'report') {
      setActiveTab(params.action as ActionTab);
    }
  }, [params.action]);

  const handleSelectState = (state: string) => {
    if (stateModalTarget === 'destination') {
      setDestState(state);
    } else {
      setOriginState(state);
    }
    setStateModalVisible(false);
  };

  const handleOpenStateModal = (target: 'destination' | 'origin') => {
    setStateModalTarget(target);
    setStateModalVisible(true);
  };

  // Submit Leaving Goa
  const handleSubmitLeaving = async () => {
    if (!destState) {
      Alert.alert(t('common.error'), t('travel.selectStateError', 'Please select a destination state.'));
      return;
    }

    setSubmitting(true);
    const payload = {
      departureDate: leavingDate,
      destinationState: destState,
      destinationDistrict: destDistrict.trim() || null,
      destinationTown: destTown.trim() || null,
      expectedReturnDate: hasExpectedReturn && expectedReturnDate ? expectedReturnDate : null,
    };

    if (token) {
      try {
        await travelApi.leave(token, payload);
        Alert.alert(t('travel.departureReported', 'Departure Reported'), t('travel.departurePendingConfirm', 'Your departure from Goa has been recorded. Admin confirmation is pending.'));
        setActiveTab('none');
        await load();
      } catch (err: any) {
        if (isNetworkError(err)) {
          outboxRepo.enqueue({
            entityType: 'travel_leaving',
            localId: uuid(),
            payload,
          });
          Alert.alert(
            t('common.offline', 'Offline'),
            t('travel.offlineLeavingQueued', 'Saved offline. Your departure report will sync when connectivity returns.'),
          );
          setActiveTab('none');
        } else {
          Alert.alert(t('common.error'), err?.message || 'Could not report departure');
        }
      }
    }
    setSubmitting(false);
  };

  // Submit Travel Report
  const handleSubmitReport = async () => {
    if (!reportComment.trim()) {
      Alert.alert(t('common.error', 'Error'), t('travel.enterCommentError', 'Please enter your travel details or health update.'));
      return;
    }
    setSubmitting(true);
    const payload = {
      travelRecordId: reportTravelRecordId,
      comment: reportComment.trim(),
      destinationState: destState,
    };
    try {
      if (token) {
        await travelApi.submitReport(token, payload);
        Alert.alert(
          t('travel.reportSubmittedTitle', 'Travel Report Submitted'),
          t('travel.reportSubmittedBody', 'Your travel report has been recorded and submitted to health surveillance staff.'),
        );
        setReportComment('');
        setReportTravelRecordId(undefined);
        setActiveTab('none');
        await load();
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        outboxRepo.enqueue({
          entityType: 'travel_report',
          localId: uuid(),
          payload,
        });
        Alert.alert(
          t('common.offline', 'Offline'),
          t('travel.offlineReportQueued', 'Saved offline. Your travel report will sync when connectivity returns.'),
        );
        setReportComment('');
        setReportTravelRecordId(undefined);
        setActiveTab('none');
      } else {
        Alert.alert(t('common.error', 'Error'), err?.message || 'Could not submit travel report');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Entering Goa
  const handleSubmitEntering = async () => {
    if (!originState) {
      Alert.alert(t('common.error'), t('travel.selectOriginError', 'Please select an origin state.'));
      return;
    }

    setSubmitting(true);
    const payload = {
      arrivalDate: enteringDate,
      originState,
      originDistrict: originDistrict.trim() || null,
      originTown: originTown.trim() || null,
      hadFeverOrMalaria: hadFever === 'yes',
      treatmentGiven: hadFever === 'yes' && treatmentGiven === 'yes',
      completedCourse: hadFever === 'yes' && treatmentGiven === 'yes' && completedCourse === 'yes',
    };

    if (token) {
      try {
        await travelApi.enter(token, payload);
        if (hadFever === 'yes') {
          Alert.alert(
            t('travel.flaggedAttention', 'Health Alert'),
            t('travel.feverFollowUpNotice', 'Your reported symptoms have been recorded. Health workers and clinical staff will follow up to ensure you receive care.'),
          );
        } else {
          Alert.alert(t('travel.arrivalRecorded', 'Arrival Recorded'), t('travel.welcomeBack', 'Welcome back to Goa. Your arrival has been confirmed.'));
        }
        setActiveTab('none');
        await load();
      } catch (err: any) {
        if (isNetworkError(err)) {
          outboxRepo.enqueue({
            entityType: 'travel_entering',
            localId: uuid(),
            payload,
          });
          Alert.alert(
            t('common.offline', 'Offline'),
            t('travel.offlineEnteringQueued', 'Saved offline. Your arrival report will sync when connectivity returns.'),
          );
          setActiveTab('none');
        } else {
          Alert.alert(t('common.error'), err?.message || 'Could not record arrival');
        }
      }
    }
    setSubmitting(false);
  };

  const handleCancelTravel = (recordId: string) => {
    Alert.alert(
      t('travel.cancelConfirmTitle', 'Cancel Travel Record?'),
      t('travel.cancelConfirmBody', 'Are you sure you want to cancel this planned travel record?'),
      [
        { text: t('common.no', 'No'), style: 'cancel' },
        {
          text: t('common.yes', 'Yes, Cancel'),
          style: 'destructive',
          onPress: async () => {
            if (token) {
              try {
                await travelApi.cancel(token, recordId, 'Worker cancelled in app');
                await load();
              } catch (err: any) {
                Alert.alert(t('common.error'), err?.message || 'Could not cancel travel record');
              }
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <WorkerHeader
        title={t('travel.title', 'Travel Reporting')}
        subtitle={t('nav.travel', 'Travel Records')}
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
      />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}>
        {/* Header Audio Guidance */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>
            {t('travel.actionsHeader', 'Choose Travel Action')}
          </Text>
          <AudioGuidanceButton
            text="Choose whether you are Leaving Goa or Entering Goa. Tap the orange button to report leaving, or the green button to report arrival."
            size="small"
          />
        </View>

        {/* Picture-Based Visual Guidance Card */}
        <WorkerGuideCard
          illustration="worker_leaving_goa"
          title="Report Travel Outside Goa"
          audioText="Choose whether you are Leaving Goa or Entering Goa. Health workers provide malaria checkups and medicines when you return."
          step1="Choose Leaving Goa when going home, or Entering Goa when returning"
          step2="Select travel date and destination state"
          step3="Health workers check on your health when you return to Goa"
          actionLabel="Need Help? View Picture Guide"
          onAction={() => setHelpGuideVisible(true)}
        />

        {/* 2 Prominent Color-Coded Action Cards */}
        <View style={styles.actionButtonsContainer}>
          {/* Action 1: LEAVING GOA (Amber / Orange) */}
          <Pressable
            onPress={() => setActiveTab(activeTab === 'leaving' ? 'none' : 'leaving')}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionLeaving,
              activeTab === 'leaving' && styles.actionLeavingActive,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Leaving Goa. Tap to report your departure."
          >
            <View style={styles.actionIconWrapper}>
              <Text style={styles.actionIcon}>🧳</Text>
            </View>
            <Text style={styles.actionTitleLeaving}>
              {t('travel.leavingGoa', 'Leaving Goa')}
            </Text>
            <Text style={styles.actionSubtitleLeaving}>
              {t('travel.leavingSubtitle', 'Going outside Goa')}
            </Text>
            <View style={styles.actionIndicatorAmber}>
              <Text style={styles.actionIndicatorText}>
                {activeTab === 'leaving' ? '▲ ' + t('common.close', 'Close') : '▼ ' + t('common.report', 'Report')}
              </Text>
            </View>
          </Pressable>

          {/* Action 2: ENTERING GOA (Emerald / Green) */}
          <Pressable
            onPress={() => setActiveTab(activeTab === 'entering' ? 'none' : 'entering')}
            style={({ pressed }) => [
              styles.actionCard,
              styles.actionEntering,
              activeTab === 'entering' && styles.actionEnteringActive,
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Entering Goa. Tap to report your arrival."
          >
            <View style={styles.actionIconWrapper}>
              <Text style={styles.actionIcon}>🏠</Text>
            </View>
            <Text style={styles.actionTitleEntering}>
              {t('travel.enteringGoa', 'Entering Goa')}
            </Text>
            <Text style={styles.actionSubtitleEntering}>
              {t('travel.enteringSubtitle', 'Arrived back in Goa')}
            </Text>
            <View style={styles.actionIndicatorGreen}>
              <Text style={styles.actionIndicatorText}>
                {activeTab === 'entering' ? '▲ ' + t('common.close', 'Close') : '▼ ' + t('common.report', 'Report')}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Action 3: SUBMIT TRAVEL REPORT (Indigo / Blue) */}
        <Pressable
          onPress={() => {
            setActiveTab(activeTab === 'report' ? 'none' : 'report');
            if (activeTab !== 'report') setReportTravelRecordId(undefined);
          }}
          style={({ pressed }) => [
            styles.actionCardWide,
            styles.actionReport,
            activeTab === 'report' && styles.actionReportActive,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Submit a travel report or health update"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.actionIconWrapper, { backgroundColor: '#DBEAFE', marginBottom: 0 }]}>
              <Text style={styles.actionIcon}>📝</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitleReport}>
                {t('travel.reportCardTitle', 'Submit Travel Report / Health Note')}
              </Text>
              <Text style={styles.actionSubtitleReport}>
                {t('travel.reportCardSub', 'Report ongoing travel details, notes or health updates to staff')}
              </Text>
            </View>
            <View style={styles.actionIndicatorBlue}>
              <Text style={styles.actionIndicatorText}>
                {activeTab === 'report' ? '▲ ' + t('common.close', 'Close') : '▼ ' + t('common.report', 'Report')}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* ─── FORM 1: LEAVING GOA ────────────────────────────────────────── */}
        {activeTab === 'leaving' && (
          <Card style={styles.formCardLeaving}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={styles.formHeadingAmber}>
                🛫 {t('travel.leavingFormTitle', 'Report Departure from Goa')}
              </Text>
              <AudioGuidanceButton
                text="Please confirm your departure date and select the destination state you are travelling to."
                size="small"
              />
            </View>

            {/* Departure Date (auto-timestamped to today) */}
            <DatePickerField
              label={t('travel.departureDate', 'Departure Date')}
              value={leavingDate}
              onChange={setLeavingDate}
              minimumDate={new Date(new Date().setDate(new Date().getDate() - 7))}
              maximumDate={new Date(new Date().setMonth(new Date().getMonth() + 3))}
            />

            {/* Destination State Dropdown Selector */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>
                {t('travel.destinationState', 'Destination State (गंतव्य राज्य)')}
              </Text>
              <Pressable
                onPress={() => handleOpenStateModal('destination')}
                style={styles.dropdownButton}
              >
                <Text style={styles.dropdownValue}>{destState}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </Pressable>
            </View>

            <TextField
              label={t('travel.districtOptional', 'District (Optional)')}
              value={destDistrict}
              onChangeText={setDestDistrict}
              placeholder="e.g. Patna, Gorakhpur, Malda"
            />

            <TextField
              label={t('travel.townOptional', 'Town / Village (Optional)')}
              value={destTown}
              onChangeText={setDestTown}
              placeholder="e.g. Town or village name"
            />

            {/* Optional Expected Return Date */}
            <Pressable
              onPress={() => setHasExpectedReturn(!hasExpectedReturn)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: spacing.xs }}
            >
              <Text style={{ fontSize: 18 }}>{hasExpectedReturn ? '☑️' : '◻️'}</Text>
              <Text style={{ fontSize: fontSize.sm, color: palette.text, fontWeight: '600' }}>
                {t('travel.hasExpectedReturn', 'I have an expected return date (वापसी की तारीख)')}
              </Text>
            </Pressable>

            {hasExpectedReturn && (
              <DatePickerField
                label={t('travel.expectedReturnDate', 'Expected Return Date')}
                value={expectedReturnDate || new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().slice(0, 10)}
                onChange={setExpectedReturnDate}
                minimumDate={new Date(leavingDate)}
              />
            )}

            <Button
              label={submitting ? t('common.saving', 'Recording...') : t('travel.confirmDepartureBtn', 'Confirm Departure')}
              onPress={handleSubmitLeaving}
              disabled={submitting}
              style={{ backgroundColor: '#D97706', marginTop: spacing.sm }}
            />
          </Card>
        )}

        {/* ─── FORM 2: ENTERING GOA ───────────────────────────────────────── */}
        {activeTab === 'entering' && (
          <Card style={styles.formCardEntering}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={styles.formHeadingGreen}>
                🛬 {t('travel.enteringFormTitle', 'Report Arrival in Goa')}
              </Text>
              <AudioGuidanceButton
                text="Please confirm your arrival date, the state you returned from, and whether you experienced fever or malaria during your journey."
                size="small"
              />
            </View>

            {/* Arrival Date */}
            <DatePickerField
              label={t('travel.arrivalDate', 'Arrival Date')}
              value={enteringDate}
              onChange={setEnteringDate}
              minimumDate={new Date(new Date().setDate(new Date().getDate() - 30))}
              maximumDate={new Date()}
            />

            {/* Origin State Dropdown Selector */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>
                {t('travel.originState', 'Where did you travel from? (किस राज्य से आए हैं?)')}
              </Text>
              <Pressable
                onPress={() => handleOpenStateModal('origin')}
                style={styles.dropdownButton}
              >
                <Text style={styles.dropdownValue}>{originState}</Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </Pressable>
            </View>

            <TextField
              label={t('travel.originDistrict', 'District (Optional)')}
              value={originDistrict}
              onChangeText={setOriginDistrict}
              placeholder="e.g. District name"
            />

            {/* Fever / Malaria during travel? */}
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>
                🌡️ {t('travel.feverQuestion', 'Did you have fever or malaria during your travel?')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Pressable
                  onPress={() => setHadFever('yes')}
                  style={[styles.radioCard, hadFever === 'yes' && styles.radioCardActiveDanger]}
                >
                  <Text style={[styles.radioText, hadFever === 'yes' && styles.radioTextActive]}>
                    🔴 {t('common.yes', 'Yes')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setHadFever('no')}
                  style={[styles.radioCard, hadFever === 'no' && styles.radioCardActiveSuccess]}
                >
                  <Text style={[styles.radioText, hadFever === 'no' && styles.radioTextActive]}>
                    🟢 {t('common.no', 'No')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {hadFever === 'yes' && (
              <View style={styles.conditionalBlock}>
                <Text style={styles.fieldLabel}>{t('travel.treatmentQuestion', 'Was treatment given?')}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Pressable
                    onPress={() => setTreatmentGiven('yes')}
                    style={[styles.radioCard, treatmentGiven === 'yes' && styles.radioCardActive]}
                  >
                    <Text style={[styles.radioText, treatmentGiven === 'yes' && styles.radioTextActive]}>
                      {t('common.yes', 'Yes')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTreatmentGiven('no')}
                    style={[styles.radioCard, treatmentGiven === 'no' && styles.radioCardActive]}
                  >
                    <Text style={[styles.radioText, treatmentGiven === 'no' && styles.radioTextActive]}>
                      {t('common.no', 'No')}
                    </Text>
                  </Pressable>
                </View>

                {treatmentGiven === 'yes' && (
                  <View>
                    <Text style={styles.fieldLabel}>{t('travel.fullCourseQuestion', 'Was the full course completed?')}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        onPress={() => setCompletedCourse('yes')}
                        style={[styles.radioCard, completedCourse === 'yes' && styles.radioCardActive]}
                      >
                        <Text style={[styles.radioText, completedCourse === 'yes' && styles.radioTextActive]}>
                          {t('common.yes', 'Yes')}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setCompletedCourse('no')}
                        style={[styles.radioCard, completedCourse === 'no' && styles.radioCardActive]}
                      >
                        <Text style={[styles.radioText, completedCourse === 'no' && styles.radioTextActive]}>
                          {t('common.no', 'No')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            <Button
              label={submitting ? t('common.saving', 'Recording...') : t('travel.confirmArrivalBtn', 'Confirm Arrival in Goa')}
              onPress={handleSubmitEntering}
              disabled={submitting}
              style={{ backgroundColor: '#059669', marginTop: spacing.sm }}
            />
          </Card>
        )}

        {/* ─── FORM 3: SUBMIT TRAVEL REPORT ─────────────────────────────── */}
        {activeTab === 'report' && (
          <Card style={styles.formCardReport}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={styles.formHeadingBlue}>
                📝 {t('travel.submitReportHeading', 'Submit Travel Report / Health Update')}
              </Text>
              <AudioGuidanceButton
                text="Please write any details about your journey, location, or health status for health workers and contractors."
                size="small"
              />
            </View>

            {/* Linked Travel Journey Selection if records exist */}
            {records.length > 0 && (
              <View style={styles.fieldWrapper}>
                <Text style={styles.fieldLabel}>
                  {t('travel.linkToJourney', 'Link to Travel Record (Optional)')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                  <Pressable
                    onPress={() => setReportTravelRecordId(undefined)}
                    style={[
                      styles.chipButton,
                      !reportTravelRecordId && styles.chipButtonActive,
                    ]}
                  >
                    <Text style={[styles.chipText, !reportTravelRecordId && styles.chipTextActive]}>
                      General Update
                    </Text>
                  </Pressable>
                  {records.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setReportTravelRecordId(r.id)}
                      style={[
                        styles.chipButton,
                        reportTravelRecordId === r.id && styles.chipButtonActive,
                      ]}
                    >
                      <Text style={[styles.chipText, reportTravelRecordId === r.id && styles.chipTextActive]}>
                        {r.destination || r.state || 'Journey'} ({r.departureDate?.slice(0, 10) || 'Date'})
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextField
              label={t('travel.reportCommentLabel', 'Travel Details / Symptoms / Location *')}
              value={reportComment}
              onChangeText={setReportComment}
              placeholder="e.g. Arrived safely at village, feeling well, or experiencing fever..."
              multiline
              numberOfLines={3}
            />

            <Button
              label={submitting ? t('common.saving', 'Submitting...') : t('travel.submitReportBtn', 'Submit Travel Report')}
              onPress={handleSubmitReport}
              disabled={submitting}
              style={{ backgroundColor: '#2563EB', marginTop: spacing.sm }}
            />
          </Card>
        )}

        {/* ─── TRAVEL HISTORY ────────────────────────────────────────────── */}
        <View style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text }}>
              📋 {t('travel.historyTitle', 'Travel History')}
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: palette.textMuted }}>
              {records.length} {t('travel.journeysCount', 'journey(s)')}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator style={{ padding: spacing.xl }} color={palette.primary} />
          ) : records.length === 0 ? (
            <WorkerEmptyStateIllustration
              illustration="worker_returning_to_goa"
              title={t('travel.noHistory', 'No travel recorded yet')}
              message={t('travel.noHistoryHint', 'Use the buttons above when you plan to leave Goa or when you return.')}
              actionLabel="Report Leaving Goa"
              onAction={() => setActiveTab('leaving')}
            />
          ) : (
            records.map((r) => {
              const isLeaving = r.direction === 'LEAVING_GOA' || r.planningTravel;
              const dateStr = isLeaving ? r.departureDate : (r.returnDate || r.departureDate);
              const isPending = r.departureStatus === 'PENDING_CONFIRMATION';
              const isConfirmed = r.departureStatus === 'CONFIRMED';
              const isCancelled = r.status === 'CANCELLED' || r.departureStatus === 'CANCELLED';

              return (
                <Card key={r.id} style={styles.historyCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={[styles.badge, isLeaving ? styles.badgeAmber : styles.badgeGreen]}>
                      <Text style={[styles.badgeText, isLeaving ? styles.badgeTextAmber : styles.badgeTextGreen]}>
                        {isLeaving ? '🛫 LEAVING GOA' : '🛬 ENTERING GOA'}
                      </Text>
                    </View>

                    {isPending && (
                      <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={{ color: '#D97706', fontSize: 11, fontWeight: '700' }}>
                          ⏳ PENDING CONFIRMATION
                        </Text>
                      </View>
                    )}
                    {isConfirmed && (
                      <View style={[styles.badge, { backgroundColor: '#D1FAE5' }]}>
                        <Text style={{ color: '#059669', fontSize: 11, fontWeight: '700' }}>
                          ✓ CONFIRMED
                        </Text>
                      </View>
                    )}
                    {isCancelled && (
                      <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '700' }}>
                          ✕ CANCELLED
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text }}>
                      {r.destination || r.state || (isLeaving ? 'Destination outside Goa' : 'From outside Goa')}
                    </Text>
                    {dateStr ? (
                      <Text style={{ fontSize: fontSize.sm, color: palette.textMuted, marginTop: 2 }}>
                        📅 {isLeaving ? 'Departure: ' : 'Arrival: '} {dateStr.slice(0, 10)}
                      </Text>
                    ) : null}
                  </View>

                  {r.hadFeverOrMalaria ? (
                    <View style={styles.feverWarning}>
                      <Text style={styles.feverWarningText}>
                        🌡️ Fever/Malaria Reported During Travel
                      </Text>
                    </View>
                  ) : null}

                  {/* Travel Card Actions: Add Report / Cancel */}
                  <View style={{ marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: spacing.xs, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, alignItems: 'center' }}>
                    {!isCancelled && (
                      <Pressable
                        onPress={() => {
                          setReportTravelRecordId(r.id);
                          setActiveTab('report');
                        }}
                        style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                      >
                        <Text style={{ color: palette.primary, fontWeight: '700', fontSize: fontSize.xs }}>
                          📝 {t('travel.addNote', 'Add Report / Note')}
                        </Text>
                      </Pressable>
                    )}
                    {isPending && !isCancelled ? (
                      <Pressable
                        onPress={() => handleCancelTravel(r.id)}
                        style={{ paddingVertical: 4, paddingHorizontal: 8 }}
                      >
                        <Text style={{ color: palette.danger, fontWeight: '600', fontSize: fontSize.xs }}>
                          ✕ {t('travel.cancelTrip', 'Cancel trip')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </View>

        {/* ─── SUBMITTED TRAVEL REPORTS (Phase 2.2) ───────────────────────── */}
        {reports.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={{ fontSize: fontSize.md, fontWeight: '700', color: palette.text, marginBottom: spacing.xs }}>
              📝 {t('travel.submittedReportsTitle', 'Submitted Travel Reports & Notes')}
            </Text>
            {reports.map((rep) => (
              <Card key={rep.id} style={{ marginBottom: spacing.xs, backgroundColor: '#F8FAFC' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: fontSize.xs, color: palette.textMuted }}>
                    📅 {rep.createdAt ? new Date(rep.createdAt).toLocaleDateString() : 'Reported'}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
                    <Text style={{ color: '#1D4ED8', fontSize: 10, fontWeight: '700' }}>
                      ✓ {rep.status || 'SUBMITTED'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: fontSize.sm, color: palette.text, marginTop: 4, fontWeight: '500' }}>
                  {rep.comment}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── INDIAN STATES SELECTION MODAL ─────────────────────────────── */}
      <Modal
        visible={stateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setStateModalVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontSize: fontSize.lg, fontWeight: '700', color: palette.text }}>
                {t('travel.selectStateModal', 'Select State (राज्य चुनें)')}
              </Text>
              <Pressable onPress={() => setStateModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: palette.textMuted }}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              {INDIAN_STATES.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => handleSelectState(st)}
                  style={({ pressed }) => [
                    styles.stateItem,
                    ((stateModalTarget === 'destination' ? destState : originState) === st) && styles.stateItemSelected,
                    pressed && { backgroundColor: '#F0F4F8' },
                  ]}
                >
                  <Text
                    style={[
                      styles.stateItemText,
                      ((stateModalTarget === 'destination' ? destState : originState) === st) && styles.stateItemTextSelected,
                    ]}
                  >
                    {st}
                  </Text>
                  {((stateModalTarget === 'destination' ? destState : originState) === st) && (
                    <Text style={{ color: palette.primary, fontWeight: 'bold' }}>✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Visual Workflow Action Guide Modal */}
      <WorkerActionGuide
        visible={helpGuideVisible}
        workflow="travel"
        onClose={() => setHelpGuideVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  actionLeaving: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  actionLeavingActive: {
    borderColor: '#B45309',
    borderWidth: 3,
  },
  actionEntering: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  actionEnteringActive: {
    borderColor: '#047857',
    borderWidth: 3,
  },
  actionIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionIcon: {
    fontSize: 26,
  },
  actionTitleLeaving: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
  },
  actionSubtitleLeaving: {
    fontSize: fontSize.xs,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 2,
  },
  actionTitleEntering: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#065F46',
    textAlign: 'center',
  },
  actionSubtitleEntering: {
    fontSize: fontSize.xs,
    color: '#047857',
    textAlign: 'center',
    marginTop: 2,
  },
  actionIndicatorAmber: {
    marginTop: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  actionIndicatorGreen: {
    marginTop: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  actionIndicatorText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  formCardLeaving: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FFFBEB',
  },
  formCardEntering: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#ECFDF5',
  },
  formHeadingAmber: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#92400E',
  },
  formHeadingGreen: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#065F46',
  },
  fieldWrapper: {
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.text,
    marginBottom: 6,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  dropdownValue: {
    fontSize: fontSize.md,
    color: palette.text,
    fontWeight: '600',
  },
  dropdownArrow: {
    fontSize: 12,
    color: palette.textMuted,
  },
  radioCard: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  radioCardActive: {
    borderColor: palette.primary,
    backgroundColor: '#EBF4FF',
  },
  radioCardActiveDanger: {
    borderColor: palette.danger,
    backgroundColor: '#FEE2E2',
  },
  radioCardActiveSuccess: {
    borderColor: palette.success,
    backgroundColor: '#D1FAE5',
  },
  radioText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.text,
  },
  radioTextActive: {
    color: palette.text,
    fontWeight: '700',
  },
  conditionalBlock: {
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.sm,
  },
  historyCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextAmber: {
    color: '#D97706',
  },
  badgeTextGreen: {
    color: '#059669',
  },
  feverWarning: {
    marginTop: spacing.xs,
    backgroundColor: '#FEE2E2',
    padding: 6,
    borderRadius: 4,
  },
  feverWarningText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  stateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    minHeight: 48,
  },
  stateItemSelected: {
    backgroundColor: '#EBF4FF',
    borderRadius: 8,
  },
  stateItemText: {
    fontSize: fontSize.md,
    color: palette.text,
  },
  stateItemTextSelected: {
    color: palette.primary,
    fontWeight: '700',
  },
  actionCardWide: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    marginTop: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionReport: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  actionReportActive: {
    borderColor: '#2563EB',
    borderWidth: 3,
  },
  actionTitleReport: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#1E40AF',
  },
  actionSubtitleReport: {
    fontSize: fontSize.xs,
    color: '#2563EB',
    marginTop: 2,
  },
  actionIndicatorBlue: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  formCardReport: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  formHeadingBlue: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#1E40AF',
  },
  chipButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipButtonActive: {
    borderColor: palette.primary,
    backgroundColor: '#EBF4FF',
  },
  chipText: {
    fontSize: fontSize.xs,
    color: palette.text,
  },
  chipTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
});
