import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  contractorApi,
  type WorkerPassIdentityConfirmationDto,
  type ContractorSiteSummary,
} from '@/api';
import { useSession } from '@/store/session';
import { Card, Button } from '@/components/ui';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function ContractorScanScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, selectedSiteCode } = useSession();

  const [permission, requestPermission] = useCameraPermissions();
  const [useManual, setUseManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Scanned verification data
  const [confirmationData, setConfirmationData] = useState<WorkerPassIdentityConfirmationDto | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Available sites & selected target site
  const [sites, setSites] = useState<ContractorSiteSummary[]>([]);
  const [targetSiteCode, setTargetSiteCode] = useState<string>(selectedSiteCode || '');
  const [note, setNote] = useState('');

  // Load contractor sites
  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const assigned = await contractorApi.sites(token);
        setSites(assigned);
        if (!targetSiteCode && assigned.length > 0) {
          setTargetSiteCode(assigned[0].siteId);
        }
      } catch (e) {
        console.warn('Failed to load sites:', e);
      }
    })();
  }, [token]);

  // Handle scanned or entered token
  const processToken = useCallback(
    async (rawToken: string) => {
      if (!token) return;
      const cleanToken = rawToken.trim();
      if (!cleanToken) {
        Alert.alert('Invalid Token', 'Please enter a valid QR Pass token.');
        return;
      }

      setLoading(true);
      try {
        const result = await contractorApi.scanPass(token, cleanToken);
        setConfirmationData(result);
        setModalVisible(true);
      } catch (err: any) {
        Alert.alert('Scan Failed', err?.message || 'Could not verify QR Pass token.');
        setScanning(true);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // Handle barcode scanned from camera
  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanning || loading) return;
      setScanning(false);
      void processToken(data);
    },
    [scanning, loading, processToken],
  );

  // Submit the assignment or transfer request
  const handleSubmitRequest = useCallback(async () => {
    if (!token || !confirmationData) return;
    if (!targetSiteCode) {
      Alert.alert('Missing Site', 'Please select a construction site for this worker.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await contractorApi.requestPass(token, {
        token: confirmationData.token,
        siteCode: targetSiteCode,
        note: note.trim() || undefined,
      });

      setModalVisible(false);
      setConfirmationData(null);
      setManualToken('');

      if (res.directAssignment) {
        Alert.alert(
          'Worker Assigned',
          `Worker ${confirmationData.name} has been directly assigned to your workforce at site ${targetSiteCode}.`,
          [
            {
              text: 'View My Workers',
              onPress: () => router.push('/(contractor)/workers'),
            },
            {
              text: 'Done',
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        Alert.alert(
          'Transfer Request Submitted',
          `Transfer request for ${confirmationData.name} submitted. The worker must accept, and releasing contractor must approve before transfer takes effect.`,
          [
            {
              text: 'View Requests',
              onPress: () => router.push('/(contractor)/requests'),
            },
            {
              text: 'Done',
              onPress: () => router.back(),
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert('Request Failed', err?.message || 'Could not submit workforce assignment request.');
    } finally {
      setSubmitting(false);
    }
  }, [token, confirmationData, targetSiteCode, note, router]);

  return (
    <View style={styles.container}>
      {/* Top Controls / Mode Switcher */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.modeTab, !useManual && styles.modeTabActive]}
          onPress={() => {
            setUseManual(false);
            setScanning(true);
          }}
        >
          <Text style={[styles.modeTabText, !useManual && styles.modeTabTextActive]}>
            📷 Camera Scanner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, useManual && styles.modeTabActive]}
          onPress={() => setUseManual(true)}
        >
          <Text style={[styles.modeTabText, useManual && styles.modeTabTextActive]}>
            ⌨️ Manual Entry
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Scanner / Manual View */}
      {useManual ? (
        <ScrollView contentContainerStyle={styles.manualContainer}>
          <Card style={styles.manualCard}>
            <Text style={styles.manualTitle}>Manual QR Pass Token Entry</Text>
            <Text style={styles.manualSubtitle}>
              Enter the 32-character pass token shown beneath the worker's QR Pass screen.
            </Text>

            <TextInput
              style={styles.tokenInput}
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="e.g. M3PASS:v1:abc123... or raw token"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Button
              label={loading ? 'Verifying Token…' : 'Verify Pass Token'}
              onPress={() => void processToken(manualToken)}
              disabled={loading || !manualToken.trim()}
            />
          </Card>
        </ScrollView>
      ) : (
        <View style={styles.cameraContainer}>
          {!permission ? (
            <View style={styles.permissionBox}>
              <ActivityIndicator color={palette.primary} />
            </View>
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Camera Permission Required</Text>
              <Text style={styles.permissionSubtitle}>
                Camera access is needed to scan Worker QR passes directly.
              </Text>
              <Button label="Grant Permission" onPress={requestPermission} />
              <TouchableOpacity
                style={{ marginTop: spacing.md }}
                onPress={() => setUseManual(true)}
              >
                <Text style={{ color: palette.primary, fontWeight: '700' }}>
                  Or enter token manually →
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={StyleSheet.absoluteFillObject}>
              <CameraView
                onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                style={StyleSheet.absoluteFillObject}
              />

              {/* Viewfinder Overlay */}
              <View style={styles.overlay}>
                <View style={styles.viewfinder}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.scanHint}>
                  Align Worker QR Pass within frame
                </Text>
              </View>

              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.loadingOverlayText}>Verifying Worker Pass…</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setModalVisible(false);
          setScanning(true);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Worker Identity Confirmation</Text>
                <Text style={styles.modalSubtitle}>
                  Verified from authorized health surveillance database.
                </Text>
              </View>

              {confirmationData && (
                <View style={styles.workerSummaryCard}>
                  <View style={styles.workerRow}>
                    <Text style={styles.workerRowLabel}>Worker ID:</Text>
                    <Text style={styles.workerRowValue}>{confirmationData.workerCode}</Text>
                  </View>
                  <View style={styles.workerRow}>
                    <Text style={styles.workerRowLabel}>Worker Name:</Text>
                    <Text style={styles.workerRowValue}>{confirmationData.name}</Text>
                  </View>
                  <View style={styles.workerRow}>
                    <Text style={styles.workerRowLabel}>Current Site:</Text>
                    <Text style={styles.workerRowValue}>
                      {confirmationData.currentSite
                        ? `${confirmationData.currentSite.name} (${confirmationData.currentSite.siteId})`
                        : 'Unassigned'}
                    </Text>
                  </View>
                  <View style={styles.workerRow}>
                    <Text style={styles.workerRowLabel}>Current Contractor:</Text>
                    <Text style={styles.workerRowValue}>
                      {confirmationData.currentContractor?.name || 'None'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Guard warning / reason if request cannot proceed */}
              {confirmationData && !confirmationData.canRequest ? (
                <View style={styles.guardAlert}>
                  <Text style={styles.guardAlertTitle}>⚠️ Request Blocked</Text>
                  <Text style={styles.guardAlertDesc}>{confirmationData.reason}</Text>
                </View>
              ) : null}

              {/* Form Controls if can request */}
              {confirmationData && confirmationData.canRequest ? (
                <>
                  <View>
                    <Text style={styles.fieldLabel}>Target Construction Site *</Text>
                    <View style={styles.sitePickerBox}>
                      {sites.map((s) => (
                        <TouchableOpacity
                          key={s.siteId}
                          style={[
                            styles.siteChip,
                            targetSiteCode === s.siteId && styles.siteChipSelected,
                          ]}
                          onPress={() => setTargetSiteCode(s.siteId)}
                        >
                          <Text
                            style={[
                              styles.siteChipText,
                              targetSiteCode === s.siteId && styles.siteChipTextSelected,
                            ]}
                          >
                            {s.name} ({s.siteId})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Reason / Operational Note (Optional)</Text>
                    <TextInput
                      style={styles.noteInput}
                      value={note}
                      onChangeText={setNote}
                      placeholder="e.g. Masonry team assignment…"
                      placeholderTextColor={palette.textMuted}
                    />
                  </View>

                  <Button
                    label={
                      submitting
                        ? 'Submitting…'
                        : confirmationData.hasActiveAssignment
                          ? 'Request Workforce Transfer'
                          : 'Assign to My Workforce'
                    }
                    onPress={handleSubmitRequest}
                    disabled={submitting}
                  />
                </>
              ) : null}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  setScanning(true);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel & Scan Again</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  topBar: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  modeTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeTabActive: {
    borderBottomColor: palette.primary,
  },
  modeTabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.textMuted,
  },
  modeTabTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: palette.bg,
  },
  permissionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  permissionSubtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  viewfinder: {
    width: 250,
    height: 250,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#38BDF8',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanHint: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingOverlayText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  manualContainer: {
    padding: spacing.lg,
  },
  manualCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  manualTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: palette.text,
  },
  manualSubtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    lineHeight: 20,
  },
  tokenInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    backgroundColor: palette.bg,
    color: palette.text,
    fontFamily: 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    gap: 2,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: palette.text,
  },
  modalSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  workerSummaryCard: {
    backgroundColor: palette.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: palette.border,
  },
  workerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  workerRowLabel: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
  },
  workerRowValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  guardAlert: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: palette.danger,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 4,
  },
  guardAlertTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#991B1B',
  },
  guardAlertDesc: {
    fontSize: fontSize.xs,
    color: '#991B1B',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  sitePickerBox: {
    gap: spacing.xs,
  },
  siteChip: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  siteChipSelected: {
    borderColor: palette.primary,
    backgroundColor: '#EEF2FF',
  },
  siteChipText: {
    fontSize: fontSize.xs,
    color: palette.text,
  },
  siteChipTextSelected: {
    color: palette.primary,
    fontWeight: '700',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    backgroundColor: palette.bg,
    color: palette.text,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.textMuted,
  },
});
