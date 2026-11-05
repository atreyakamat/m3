import React, { useEffect, useState } from 'react';
import { View, Text, Alert, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, TextField, Button } from '@/components/ui';
import { contractorApi, type ContractorSiteSummary } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function InitiateTransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, selectedSiteCode } = useSession();

  const [workerCode, setWorkerCode] = useState('');
  const [destinationSiteId, setDestinationSiteId] = useState('');
  const [reason, setReason] = useState('');
  const [sites, setSites] = useState<ContractorSiteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadSites() {
      if (!token) return;
      try {
        setLoading(true);
        const assigned = await contractorApi.sites(token);
        setSites(assigned);
        if (assigned.length > 0) {
          setDestinationSiteId(selectedSiteCode ?? assigned[0].siteId);
        }
      } catch (e) {
        /* non-fatal */
      } finally {
        setLoading(false);
      }
    }
    void loadSites();
  }, [token, selectedSiteCode]);

  async function handleSubmit() {
    if (!token) return;
    if (!workerCode.trim()) {
      Alert.alert(t('common.error', 'Error'), t('contractor.enterWorkerId', 'Please enter a Worker ID.'));
      return;
    }
    if (!destinationSiteId) {
      Alert.alert(t('common.error', 'Error'), t('contractor.selectDestinationSite', 'Please select a destination site.'));
      return;
    }

    try {
      setSubmitting(true);
      await contractorApi.initiateTransfer(token, {
        workerCode: workerCode.trim(),
        destinationSiteId,
        reason: reason.trim() || undefined,
      });

      Alert.alert(
        t('contractor.transferInitiatedTitle', 'Transfer Initiated'),
        t('contractor.transferInitiatedBody', 'The transfer request was submitted. The worker will be prompted to accept.'),
        [
          {
            text: t('common.ok', 'OK'),
            onPress: () => router.back(),
          },
        ],
      );
    } catch (e) {
      Alert.alert(t('common.error', 'Error'), e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Card style={styles.card}>
          <Text style={styles.title}>{t('contractor.initiateTransferTitle', 'Initiate Worker Transfer')}</Text>
          <Text style={styles.subtitle}>
            {t('contractor.initiateTransferSubtitle', 'Request a worker transfer into one of your managed construction sites.')}
          </Text>

          <TextField
            label={t('contractor.workerId', 'Worker ID')}
            value={workerCode}
            onChangeText={setWorkerCode}
            placeholder="e.g. M3-XXXXXX"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>{t('contractor.destinationSiteLabel', 'Destination Site')}</Text>
          <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
            {sites.map((s) => {
              const isSelected = s.siteId === destinationSiteId;
              return (
                <Pressable
                  key={s.siteId}
                  style={[styles.siteOption, isSelected ? styles.siteOptionSelected : null]}
                  onPress={() => setDestinationSiteId(s.siteId)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.siteOptionName, isSelected ? { color: palette.primary } : null]}>
                      {s.name}
                    </Text>
                    <Text style={styles.siteOptionCode}>{s.siteId} · {s.area}</Text>
                  </View>
                  {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <TextField
            label={t('contractor.reasonOptional', 'Reason (Optional)')}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Operational requirement"
          />

          <View style={{ marginTop: spacing.md }}>
            <Button
              label={t('contractor.submitTransfer', 'Submit Transfer Request')}
              onPress={handleSubmit}
              loading={submitting}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: palette.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
    marginBottom: spacing.xs,
  },
  siteOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FAFBFC',
  },
  siteOptionSelected: {
    backgroundColor: '#EDF5F6',
    borderColor: palette.primary,
  },
  siteOptionName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  siteOptionCode: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  checkmark: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.primary,
  },
});
