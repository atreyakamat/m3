import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  contractorApi,
  type ContractorPhoneCheckResult,
} from '@/api';
import { useSession } from '@/store/session';
import { Card, Button } from '@/components/ui';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

export default function ContractorAddWorkerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [phone, setPhone] = useState('');
  const [checking, setChecking] = useState(false);
  const [searchResult, setSearchResult] = useState<ContractorPhoneCheckResult | null>(null);

  const handleCheckPhone = async () => {
    if (!token) return;
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setChecking(true);
    setSearchResult(null);
    try {
      const res = await contractorApi.checkWorkerPhone(token, cleanPhone);
      setSearchResult(res);
    } catch (err: any) {
      Alert.alert('Lookup Failed', err?.message || 'Failed to check phone number.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('addWorkerScreen.title', 'Add Worker to Workforce')}
        </Text>
        <Text style={styles.subtitle}>
          {t(
            'addWorkerScreen.subtitle',
            'Choose an onboarding method to bring a worker into your construction site workforce.',
          )}
        </Text>
      </View>

      {/* Option 1: Fast QR Pass Scan */}
      <TouchableOpacity
        style={styles.optionCard}
        onPress={() => router.push('/(contractor)/scan')}
      >
        <View style={styles.optionIconContainer}>
          <Text style={{ fontSize: 28 }}>📷</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>
            {t('addWorkerScreen.scanOptionTitle', 'Scan Worker QR Pass')}
          </Text>
          <Text style={styles.optionDesc}>
            {t(
              'addWorkerScreen.scanOptionDesc',
              'Instantly scan the temporary QR pass shown on the worker’s phone.',
            )}
          </Text>
        </View>
        <Text style={styles.optionArrow}>→</Text>
      </TouchableOpacity>

      {/* Option 2: Search by Phone Number */}
      <Card style={styles.phoneCard}>
        <View style={styles.phoneHeader}>
          <Text style={{ fontSize: 24 }}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>
              {t('addWorkerScreen.phoneCheckTitle', 'Check Existing Worker by Phone')}
            </Text>
            <Text style={styles.optionDesc}>
              {t(
                'addWorkerScreen.phoneCheckDesc',
                'Verify if the worker already exists in the Goa Malaria Surveillance database.',
              )}
            </Text>
          </View>
        </View>

        <View style={styles.phoneInputRow}>
          <TextInput
            style={styles.phoneInput}
            value={phone}
            onChangeText={(txt) => {
              setPhone(txt);
              if (searchResult) setSearchResult(null);
            }}
            placeholder="10-digit mobile number"
            placeholderTextColor={palette.textMuted}
            keyboardType="phone-pad"
            maxLength={13}
          />
          <TouchableOpacity
            style={[styles.checkBtn, checking && styles.btnDisabled]}
            onPress={handleCheckPhone}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.checkBtnText}>Check</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Result Feedback */}
        {searchResult && (
          <View
            style={[
              styles.resultBanner,
              searchResult.exists ? styles.resultFound : styles.resultNotFound,
            ]}
          >
            {searchResult.exists ? (
              <>
                <Text style={styles.resultTitle}>✓ Registered Worker Found</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Worker:</Text>
                  <Text style={styles.resultVal}>{searchResult.name} ({searchResult.workerCode})</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Current Site:</Text>
                  <Text style={styles.resultVal}>
                    {searchResult.currentSite ? searchResult.currentSite.name : 'Unassigned'}
                  </Text>
                </View>
                {searchResult.currentContractor ? (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Current Contractor:</Text>
                    <Text style={styles.resultVal}>{searchResult.currentContractor}</Text>
                  </View>
                ) : null}

                <Text style={styles.resultHint}>
                  To assign this worker to your team, please ask them to generate their QR Pass and scan it using the camera scanner.
                </Text>

                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    label="Open QR Scanner"
                    onPress={() => router.push('/(contractor)/scan')}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>ℹ️ Worker Not Found</Text>
                <Text style={styles.resultHint}>
                  No worker registered with phone {phone}. The worker can register on the M3 Worker app, or a health worker can enroll them during onsite screening.
                </Text>
              </>
            )}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    marginTop: 4,
    lineHeight: 20,
  },
  optionCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    ...shadow.card,
  },
  optionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  optionDesc: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  optionArrow: {
    fontSize: 20,
    color: palette.primary,
    fontWeight: '700',
  },
  phoneCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  phoneHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    backgroundColor: palette.bg,
    color: palette.text,
  },
  checkBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  checkBtnText: {
    color: palette.textOnColor,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
    gap: 4,
  },
  resultFound: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  resultNotFound: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  resultTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
  },
  resultVal: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: palette.text,
  },
  resultHint: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    lineHeight: 16,
    marginTop: 4,
  },
});
