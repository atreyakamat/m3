import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Clipboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { workerApi, transferApi, type WorkerPassStatusDto } from '@/api';
import { useSession } from '@/store/session';
import { Card, Button } from '@/components/ui';
import { WorkerHeader } from '@/components/WorkerHeader';
import {
  WorkerGuideCard,
  WorkerActionGuide,
} from '@/components/worker-guide';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

function uint8ToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    base64 += chars[b0 >> 2];
    base64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
    base64 += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    base64 += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return base64;
}

function qrToBmpDataUrl(text: string, scale = 7, margin = 2): string {
  const qr = QRCode.create(text);
  const size = qr.modules.size;
  const fullSize = size + margin * 2;
  const imgWidth = fullSize * scale;
  const imgHeight = fullSize * scale;

  const rowBytes = Math.ceil(imgWidth / 8);
  const paddedRowBytes = (rowBytes + 3) & ~3;
  const imageSize = paddedRowBytes * imgHeight;
  const fileSize = 54 + 8 + imageSize;

  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BITMAPFILEHEADER
  buf[0] = 0x42;
  buf[1] = 0x4d; // "BM"
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54 + 8, true);

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, imgWidth, true);
  view.setInt32(22, -imgHeight, true); // top-down
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true); // 1-bit monochrome
  view.setUint32(30, 0, true);
  view.setUint32(34, imageSize, true);

  // Color Table: 0 = Slate Black (#0F172A), 1 = White (#FFFFFF)
  buf[54] = 0x0f;
  buf[55] = 0x17;
  buf[56] = 0x2a;
  buf[57] = 0;
  buf[58] = 0xff;
  buf[59] = 0xff;
  buf[60] = 0xff;
  buf[61] = 0;

  // Fill pixel data with white (1s)
  const pixelOffset = 62;
  buf.fill(0xff, pixelOffset);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        for (let py = 0; py < scale; py++) {
          const y = (margin + r) * scale + py;
          for (let px = 0; px < scale; px++) {
            const x = (margin + c) * scale + px;
            const byteIdx = pixelOffset + y * paddedRowBytes + (x >> 3);
            const bit = 7 - (x & 7);
            buf[byteIdx] &= ~(1 << bit);
          }
        }
      }
    }
  }

  return 'data:image/bmp;base64,' + uint8ToBase64(buf);
}

export default function WorkerPassScreen() {
  const { t } = useTranslation();
  const { token, user } = useSession();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [passData, setPassData] = useState<WorkerPassStatusDto | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [decidingTransferId, setDecidingTransferId] = useState<string | null>(null);
  const [tokenRevealed, setTokenRevealed] = useState<boolean>(false);
  const [tokenCopied, setTokenCopied] = useState<boolean>(false);
  const [helpGuideVisible, setHelpGuideVisible] = useState<boolean>(false);

  // Load pass status from API
  const loadStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await workerApi.passStatus(token);
      setPassData(res);
      if (res.activeToken) {
        const secs = Math.max(0, Math.floor((new Date(res.activeToken.expiresAt).getTime() - Date.now()) / 1000));
        setRemainingSec(secs);
      } else {
        setRemainingSec(0);
        setQrDataUrl(null);
        setActiveToken(null);
      }
    } catch (err: any) {
      console.warn('Failed to load pass status:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Generate a new QR pass token
  const handleGenerate = useCallback(async () => {
    if (!token) return;
    setGenerating(true);
    try {
      const res = await workerApi.generatePass(token);
      setActiveToken(res.token);
      setTokenRevealed(false);
      setTokenCopied(false);
      setRemainingSec(res.remainingSeconds);

      // Render QR to Data URL using pure-JS BMP encoder (zero canvas/DOM dependency)
      const url = qrToBmpDataUrl(res.token);
      setQrDataUrl(url);

      // Refresh overall pass status to get updated pending transfers / site info
      await loadStatus();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate QR Pass.');
    } finally {
      setGenerating(false);
    }
  }, [token, loadStatus]);

  // Revoke active pass
  const handleRevoke = useCallback(async () => {
    if (!token) return;
    Alert.alert(
      t('pass.revoke', 'Revoke Pass'),
      'Are you sure you want to cancel and deactivate this QR Pass immediately?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevoking(true);
            try {
              await workerApi.revokePass(token);
              setQrDataUrl(null);
              setActiveToken(null);
              setRemainingSec(0);
              await loadStatus();
              Alert.alert('Pass Revoked', 'Your QR Pass has been deactivated.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to revoke pass.');
            } finally {
              setRevoking(false);
            }
          },
        },
      ],
    );
  }, [token, t, loadStatus]);

  // Copy manual token to clipboard with user feedback
  const handleCopyToken = useCallback(() => {
    if (!activeToken) return;
    Clipboard.setString(activeToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 3000);
    Alert.alert(
      t('pass.copiedTitle', 'Token Copied'),
      t('pass.copiedBody', 'Pass token copied to clipboard. Share only with authorized contractors on site.'),
    );
  }, [activeToken, t]);

  // Accept incoming transfer request
  const handleAcceptTransfer = useCallback(
    async (transferId: string) => {
      if (!token) return;
      setDecidingTransferId(transferId);
      try {
        await transferApi.accept(token, transferId);
        Alert.alert(
          'Transfer Accepted',
          'You have approved the workforce assignment request.',
        );
        await loadStatus();
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to accept transfer.');
      } finally {
        setDecidingTransferId(null);
      }
    },
    [token, loadStatus],
  );

  // Reject incoming transfer request
  const handleRejectTransfer = useCallback(
    async (transferId: string) => {
      if (!token) return;
      setDecidingTransferId(transferId);
      try {
        await transferApi.reject(token, transferId);
        Alert.alert(
          'Request Declined',
          'You have declined the workforce transfer request.',
        );
        await loadStatus();
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Failed to reject transfer.');
      } finally {
        setDecidingTransferId(null);
      }
    },
    [token, loadStatus],
  );

  // Initial mount load and generate pass if none active
  useEffect(() => {
    void (async () => {
      await loadStatus();
      // Auto generate pass on initial screen visit
      await handleGenerate();
    })();
  }, []);

  // Live countdown timer
  useEffect(() => {
    if (remainingSec <= 0) {
      if (qrDataUrl) {
        setQrDataUrl(null);
      }
      return;
    }
    const timer = setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setQrDataUrl(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [remainingSec, qrDataUrl]);

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const isExpired = remainingSec <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorkerHeader
        title={t('pass.title', 'QR Worker Pass')}
        subtitle={user?.workerId ? `${t('dashboard.workerId')}: ${user.workerId}` : undefined}
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: palette.bg }}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStatus} />}
      >
        {/* Header Info */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('pass.title', 'Worker QR Pass')}</Text>
          <Text style={styles.headerSubtitle}>
            {t(
              'pass.subtitle',
              'Show this QR code to your contractor to join their workforce or request a site transfer.',
            )}
          </Text>
        </View>

        {/* Visual Human Guidance Card */}
        <WorkerGuideCard
          illustration="worker_showing_qr_to_contractor"
          title="Show Pass to Contractor"
          audioText="Open this pass on your phone. Show the QR code to your contractor on site. They scan to assign you to work."
          step1="Keep this QR code open on your phone screen"
          step2="Show it to your construction contractor or supervisor"
          step3="Contractor scans to verify your work site assignment"
          actionLabel="Need Help? Open Picture Guide"
          onAction={() => setHelpGuideVisible(true)}
        />

      {/* QR Code Presentation Card */}
      <View style={styles.qrCard}>
        {/* Status Badge */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: !isExpired ? '#DCFCE7' : '#FEE2E2' },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: !isExpired ? '#16A34A' : '#DC2626' },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: !isExpired ? '#15803D' : '#991B1B' },
              ]}
            >
              {!isExpired
                ? t('pass.expiresIn', { time: timeFormatted, defaultValue: `Expires in ${timeFormatted}` })
                : t('pass.expired', 'QR Pass Expired')}
            </Text>
          </View>
        </View>

        {/* QR Display */}
        <View style={styles.qrContainer}>
          {generating ? (
            <View style={styles.placeholderContainer}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={styles.loadingText}>
                {t('pass.generating', 'Generating secure pass…')}
              </Text>
            </View>
          ) : qrDataUrl && !isExpired ? (
            <Image
              source={{ uri: qrDataUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.expiredIcon}>⌛</Text>
              <Text style={styles.expiredTitle}>
                {t('pass.expired', 'Pass Expired')}
              </Text>
              <Text style={styles.expiredSubtitle}>
                {t('pass.expiredHint', 'Generate a new pass to allow your contractor to scan your code.')}
              </Text>
            </View>
          )}
        </View>

        {/* Protected Token Presentation for Manual Entry */}
        {activeToken && !isExpired ? (
          <View style={styles.tokenContainer}>
            {/* Security Warning Callout */}
            <View style={styles.warningBox}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>
                {t(
                  'pass.tokenWarning',
                  'Warning: This token provides temporary worker identification access. Share only with authorized contractors on site.',
                )}
              </Text>
            </View>

            {/* Token Card */}
            <View style={styles.tokenBox}>
              <View style={styles.tokenHeaderRow}>
                <Text style={styles.tokenLabel}>
                  {t('pass.manualTokenLabel', 'Manual Entry Token')}
                </Text>
                {tokenCopied ? (
                  <View style={styles.copiedBadge}>
                    <Text style={styles.copiedBadgeText}>✓ {t('pass.copied', 'Copied')}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.tokenValueContainer}>
                <Text
                  selectable={tokenRevealed}
                  style={[
                    styles.tokenValue,
                    !tokenRevealed && styles.tokenValueMasked,
                  ]}
                >
                  {tokenRevealed
                    ? activeToken
                    : '•••••••• •••••••• •••••••• ••••••••'}
                </Text>
              </View>

              {/* Action Buttons: Reveal / Hide & Copy */}
              <View style={styles.tokenActionRow}>
                <TouchableOpacity
                  style={[styles.tokenBtn, styles.tokenRevealBtn]}
                  onPress={() => setTokenRevealed((prev) => !prev)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={tokenRevealed ? 'Hide Token' : 'Reveal Token'}
                >
                  <Text style={styles.tokenRevealBtnText}>
                    {tokenRevealed
                      ? `🙈 ${t('pass.hideToken', 'Hide Token')}`
                      : `👁️ ${t('pass.revealToken', 'Reveal Token')}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tokenBtn, styles.tokenCopyBtn]}
                  onPress={handleCopyToken}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Copy Token"
                >
                  <Text style={styles.tokenCopyBtnText}>
                    📋 {t('pass.copyToken', 'Copy Token')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, generating && styles.btnDisabled]}
            onPress={handleGenerate}
            disabled={generating}
          >
            <Text style={styles.btnPrimaryText}>
              {generating ? t('pass.generating', 'Generating…') : t('pass.generateNew', 'Generate New Pass')}
            </Text>
          </TouchableOpacity>

          {!isExpired ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline, revoking && styles.btnDisabled]}
              onPress={handleRevoke}
              disabled={revoking}
            >
              <Text style={styles.btnOutlineText}>
                {revoking ? t('pass.revoking', 'Revoking…') : t('pass.revoke', 'Revoke')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            🔒 {t('pass.privacyNotice', 'Secure Single-Use Token: Contains zero personal, demographic or medical records.')}
          </Text>
        </View>
      </View>

      {/* Current Workforce Assignment Card */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Current Workforce Assignment</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Site:</Text>
          <Text style={styles.infoValue}>
            {passData?.currentSite ? `${passData.currentSite.name} (${passData.currentSite.siteId})` : 'Unassigned'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contractor:</Text>
          <Text style={styles.infoValue}>
            {passData?.currentContractor ? passData.currentContractor.name : 'None assigned'}
          </Text>
        </View>
      </Card>

      {/* Pending Incoming Transfers */}
      {passData?.pendingTransfers && passData.pendingTransfers.length > 0 ? (
        <View style={styles.transferSection}>
          <Text style={styles.transferSectionTitle}>
            {t('pass.incomingTransfers', 'Incoming Transfer Requests')}
          </Text>
          <Text style={styles.transferSectionSubtitle}>
            {t('pass.incomingHint', 'A contractor has requested to assign you to their workforce. Accept or decline below.')}
          </Text>

          {passData.pendingTransfers.map((req) => (
            <Card key={req.id} style={styles.transferCard}>
              <View style={styles.transferHeaderRow}>
                <Text style={styles.transferInitiator}>
                  Request by {req.toContractor?.name || 'Contractor'}
                </Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{req.status}</Text>
                </View>
              </View>

              <View style={styles.transferDetailRow}>
                <Text style={styles.transferDetailLabel}>Destination Site:</Text>
                <Text style={styles.transferDetailVal}>{req.toSite.name}</Text>
              </View>

              {req.fromSite ? (
                <View style={styles.transferDetailRow}>
                  <Text style={styles.transferDetailLabel}>From Site:</Text>
                  <Text style={styles.transferDetailVal}>{req.fromSite.name}</Text>
                </View>
              ) : null}

              {req.note ? (
                <View style={styles.transferDetailRow}>
                  <Text style={styles.transferDetailLabel}>Note:</Text>
                  <Text style={styles.transferDetailVal}>{req.note}</Text>
                </View>
              ) : null}

              {req.workerDecision === 'PENDING' ? (
                <View style={styles.transferBtnRow}>
                  <TouchableOpacity
                    style={[styles.transferBtn, styles.acceptBtn]}
                    onPress={() => handleAcceptTransfer(req.id)}
                    disabled={decidingTransferId === req.id}
                  >
                    {decidingTransferId === req.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.acceptBtnText}>
                        {t('pass.acceptTransfer', 'Accept Transfer')}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.transferBtn, styles.rejectBtn]}
                    onPress={() => handleRejectTransfer(req.id)}
                    disabled={decidingTransferId === req.id}
                  >
                    <Text style={styles.rejectBtnText}>
                      {t('pass.rejectTransfer', 'Decline')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.decisionBanner}>
                  <Text style={styles.decisionBannerText}>
                    Your Decision: {req.workerDecision}
                  </Text>
                </View>
              )}
            </Card>
          ))}
        </View>
      ) : null}
      </ScrollView>

      {/* Visual Workflow Action Guide Modal */}
      <WorkerActionGuide
        visible={helpGuideVisible}
        workflow="qr_pass"
        onClose={() => setHelpGuideVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: palette.text,
  },
  headerSubtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  qrCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.card,
  },
  badgeRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  qrContainer: {
    width: 270,
    height: 270,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.sm,
  },
  qrImage: {
    width: 250,
    height: 250,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    color: palette.textMuted,
  },
  expiredIcon: {
    fontSize: 48,
    marginBottom: spacing.xs,
  },
  expiredTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: palette.text,
  },
  expiredSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 200,
  },
  tokenContainer: {
    width: '100%',
    marginTop: spacing.md,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  warningIcon: {
    fontSize: 16,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#92400E',
    lineHeight: 16,
    fontWeight: '500',
  },
  tokenBox: {
    padding: spacing.sm,
    backgroundColor: palette.bg,
    borderRadius: radius.md,
    width: '100%',
    borderWidth: 1,
    borderColor: palette.border,
  },
  tokenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tokenLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  copiedBadgeText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '700',
  },
  tokenValueContainer: {
    backgroundColor: palette.surface,
    padding: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: spacing.xs,
  },
  tokenValue: {
    fontFamily: 'monospace',
    fontSize: fontSize.xs,
    color: palette.text,
    textAlign: 'center',
  },
  tokenValueMasked: {
    letterSpacing: 2,
    color: palette.textMuted,
    fontWeight: '700',
  },
  tokenActionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  tokenBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tokenRevealBtn: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  },
  tokenRevealBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: palette.text,
  },
  tokenCopyBtn: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  tokenCopyBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#4338CA',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: palette.primary,
  },
  btnPrimaryText: {
    color: palette.textOnColor,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: 'transparent',
    flex: 0.6,
  },
  btnOutlineText: {
    color: palette.danger,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  privacyNote: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    width: '100%',
  },
  privacyText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  infoCard: {
    padding: spacing.md,
  },
  infoCardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
  },
  infoValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: palette.text,
  },
  transferSection: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  transferSectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  transferSectionSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  transferCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  transferHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transferInitiator: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  pendingBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#92400E',
  },
  transferDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  transferDetailLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  transferDetailVal: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: palette.text,
  },
  transferBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  transferBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: '#16A34A',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  rejectBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: palette.border,
  },
  rejectBtnText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: fontSize.sm,
  },
  decisionBanner: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: '#F3F4F6',
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  decisionBannerText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
});
