import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Card, Body, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { healthWorkerApi, isNetworkError } from '@/api';
import { useSession } from '@/store/session';
import { outboxRepo, uuid } from '@/db/outbox';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function ArrivalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Arrival screening modal
  const [screenModal, setScreenModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [hadFever, setHadFever] = useState<'yes' | 'no'>('no');
  const [testedTreated, setTestedTreated] = useState<'yes' | 'no'>('no');
  const [referred, setReferred] = useState<'yes' | 'no'>('no');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const prof = await healthWorkerApi.me(token);
      const facId = prof.activeFacility?.id || prof.assignedFacilities?.[0]?.id;
      if (facId) {
        const list = await healthWorkerApi.travelArrivals(token, facId);
        setArrivals(list);
      }
    } catch (e: any) {
      if (!isNetworkError(e)) {
        Alert.alert(t('common.error', 'Error'), e?.message || 'Could not load arrivals');
      }
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleOpenScreen = (record: any) => {
    setSelectedRecord(record);
    setHadFever(record.hadFeverOrMalaria ? 'yes' : 'no');
    setTestedTreated(record.treatmentGiven ? 'yes' : 'no');
    setReferred('no');
    setScreenModal(true);
  };

  const handleSubmitArrivalScreening = async () => {
    if (!token || !selectedRecord) return;

    setSubmitting(true);
    const profile = await healthWorkerApi.me(token).catch(() => null);
    const facilityId = profile?.activeFacility?.id || profile?.assignedFacilities?.[0]?.id;

    const payload = {
      travelId: selectedRecord.id,
      arrivalFacilityId: facilityId,
      arrivalFever: hadFever === 'yes',
      arrivalTestedOrTreated: testedTreated === 'yes',
      arrivalReferred: referred === 'yes',
    };

    try {
      await healthWorkerApi.arrivalScreening(token, selectedRecord.id, payload);
      Alert.alert(t('common.success', 'Success'), t('healthWorker.arrivalScreeningSaved', 'Arrival screening saved on existing travel journey.'));
      setScreenModal(false);
      await loadData();
    } catch (err: any) {
      if (isNetworkError(err)) {
        outboxRepo.enqueue({
          entityType: 'hw_arrival_screening',
          localId: uuid(),
          payload,
        });
        Alert.alert(t('common.offline', 'Offline'), t('healthWorker.offlineSaved', 'Saved offline. Record will upload when connection returns.'));
        setScreenModal(false);
      } else {
        Alert.alert(t('common.error', 'Error'), err?.message || 'Could not record arrival screening');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={['bottom']}>
      <View style={{ padding: spacing.md, flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={styles.headerTitle}>
            {t('healthWorker.travelArrivalsList', 'Travel Arrivals Entering Goa')} ({arrivals.length})
          </Text>
          <AudioGuidanceButton
            text="Travel arrivals screen. Review workers entering Goa, check fever history, and complete arrival screening."
            size="small"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : arrivals.length === 0 ? (
          <Card style={{ marginVertical: spacing.md, alignItems: 'center', padding: spacing.lg }}>
            <Text style={{ fontSize: 32, marginBottom: spacing.xs }}>✈️</Text>
            <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: palette.text }}>
              {t('healthWorker.noArrivals', 'No recent arrivals')}
            </Text>
            <Body style={{ textAlign: 'center', marginTop: spacing.xs }}>
              {t('healthWorker.noArrivalsDesc', 'No workers have reported entering Goa in this facility surveillance jurisdiction.')}
            </Body>
          </Card>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
            {arrivals.map((tr) => (
              <Card key={tr.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{tr.worker?.name || 'Worker'}</Text>
                    <Text style={styles.code}>{tr.worker?.workerCode} · 📱 {tr.worker?.phone}</Text>
                    <Text style={styles.detail}>
                      📍 Origin: {tr.originState ? `${tr.originDistrict || ''}, ${tr.originState}` : 'Outside Goa'}
                    </Text>
                    <Text style={styles.detail}>
                      Fever/Malaria: {tr.hadFeverOrMalaria ? '⚠️ Reported Fever' : 'None reported'}
                    </Text>
                    <Text style={[styles.detail, { fontWeight: fontWeight.bold, color: tr.arrivalFacility ? palette.success : palette.warning }]}>
                      Status: {tr.arrivalFacility ? `Screened (${tr.arrivalFacility.name})` : 'Pending Arrival Screening'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleOpenScreen(tr)}
                    style={styles.actionBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.actionBtnText}>{t('healthWorker.screenArrival', 'Screen Arrival')}</Text>
                  </Pressable>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Arrival Screening Modal */}
      <Modal visible={screenModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('healthWorker.screenArrivalTitle', 'Arrival Screening')}</Text>
            <Text style={styles.modalSub}>{selectedRecord?.worker?.name} ({selectedRecord?.worker?.workerCode})</Text>

            <Text style={styles.qText}>1. Did the worker have fever upon or immediately prior to arrival?</Text>
            <View style={styles.choiceRow}>
              <Pressable
                onPress={() => setHadFever('yes')}
                style={[styles.choiceBtn, hadFever === 'yes' && styles.choiceActiveYes]}
              >
                <Text style={styles.choiceText}>🔥 Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => setHadFever('no')}
                style={[styles.choiceBtn, hadFever === 'no' && styles.choiceActiveNo]}
              >
                <Text style={styles.choiceText}>❄️ No</Text>
              </Pressable>
            </View>

            <Text style={styles.qText}>2. Was the worker tested or given antimalarial treatment en route?</Text>
            <View style={styles.choiceRow}>
              <Pressable
                onPress={() => setTestedTreated('yes')}
                style={[styles.choiceBtn, testedTreated === 'yes' && styles.choiceActiveYes]}
              >
                <Text style={styles.choiceText}>💊 Yes</Text>
              </Pressable>
              <Pressable
                onPress={() => setTestedTreated('no')}
                style={[styles.choiceBtn, testedTreated === 'no' && styles.choiceActiveNo]}
              >
                <Text style={styles.choiceText}>❌ No</Text>
              </Pressable>
            </View>

            <Text style={styles.qText}>3. Refer worker for immediate facility clinical assessment / RDT?</Text>
            <View style={styles.choiceRow}>
              <Pressable
                onPress={() => setReferred('yes')}
                style={[styles.choiceBtn, referred === 'yes' && styles.choiceActiveYes]}
              >
                <Text style={styles.choiceText}>🏥 Yes, Refer</Text>
              </Pressable>
              <Pressable
                onPress={() => setReferred('no')}
                style={[styles.choiceBtn, referred === 'no' && styles.choiceActiveNo]}
              >
                <Text style={styles.choiceText}>👍 No</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button label={t('common.cancel', 'Cancel')} variant="ghost" onPress={() => setScreenModal(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={submitting ? t('common.saving', 'Saving...') : t('common.save', 'Save Screening')}
                  variant="primary"
                  onPress={handleSubmitArrivalScreening}
                  disabled={submitting}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.card,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  code: {
    fontSize: fontSize.xs,
    color: palette.primary,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  detail: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 3,
  },
  actionBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.sm,
    minHeight: 48,
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: palette.text,
  },
  modalSub: {
    fontSize: fontSize.sm,
    color: palette.primary,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  qText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: palette.text,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  choiceActiveYes: {
    borderColor: palette.danger,
    backgroundColor: '#FEF2F2',
  },
  choiceActiveNo: {
    borderColor: palette.success,
    backgroundColor: '#F0FDF4',
  },
  choiceText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: palette.text,
  },
});
