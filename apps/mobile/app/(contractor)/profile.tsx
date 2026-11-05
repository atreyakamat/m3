import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, Title, Subtitle, Button } from '@/components/ui';
import { contractorApi, type ContractorProfile } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@m3/shared';

export default function ContractorProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, selectedSiteCode, language, setLanguage, signOut } = useSession();
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!token) return;
      try {
        setLoading(true);
        const data = await contractorApi.profile(token);
        setProfile(data);
      } catch (e) {
        Alert.alert(t('common.error', 'Error'), t('contractor.loadProfileError', 'Could not load profile.'));
      } finally {
        setLoading(false);
      }
    }
    void fetchProfile();
  }, [token, t]);

  async function handleSignOut() {
    Alert.alert(
      t('auth.signOut', 'Sign Out'),
      t('contractor.signOutConfirm', 'Are you sure you want to sign out?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('auth.signOut', 'Sign Out'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/sign-in');
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {/* Profile Card */}
        <Card style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 32 }}>👷</Text>
          </View>
          <Text style={styles.contractorName}>{profile?.name ?? user?.displayName ?? 'Contractor'}</Text>
          <Text style={styles.contractorIdBadge}>{profile?.contractorId ?? user?.contractorId ?? 'C000001'}</Text>

          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {profile?.active !== false
                ? t('contractor.accountActive', 'Active Account')
                : t('contractor.accountInactive', 'Inactive')}
            </Text>
          </View>
        </Card>

        {/* Details Section */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t('contractor.accountDetails', 'Account Details')}</Text>

          <DetailRow
            label={t('contractor.phoneLabel', 'Registered Mobile Number')}
            value={profile?.phone ?? '—'}
          />
          <DetailRow
            label={t('contractor.roleLabel', 'Role')}
            value="CONTRACTOR"
          />
          <DetailRow
            label={t('contractor.selectedSiteLabel', 'Currently Selected Site')}
            value={selectedSiteCode ? `${selectedSiteCode}` : '—'}
          />
          <DetailRow
            label={t('contractor.createdLabel', 'Account Created')}
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
          />
        </Card>

        {/* Assigned Sites List */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('contractor.assignedSitesTitle', 'Assigned Construction Sites')} ({profile?.assignedSites.length ?? 0})
          </Text>
          <Text style={styles.cardSubtitle}>
            {t('contractor.assignedSitesNote', 'Admin assigns sites. Each construction site has only one contractor.')}
          </Text>

          <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
            {profile?.assignedSites && profile.assignedSites.length > 0 ? (
              profile.assignedSites.map((site) => {
                const isSelected = site.siteId === selectedSiteCode;
                return (
                  <View
                    key={site.siteId}
                    style={[styles.siteItem, isSelected ? styles.siteItemSelected : null]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.siteItemName, isSelected ? { color: palette.primary } : null]}>
                        {site.name}
                      </Text>
                      <Text style={styles.siteItemMeta}>
                        {site.siteId} · {site.area} · {site.activeWorkers} {t('contractor.workers', 'workers')}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>{t('contractor.selected', 'Selected')}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={{ color: palette.textMuted, fontSize: fontSize.sm }}>
                {t('contractor.noSitesAssigned', 'No construction site assigned')}
              </Text>
            )}
          </View>
        </Card>

        {/* Language & Actions */}
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t('contractor.preferencesTitle', 'Preferences & Language')}</Text>
          <Text style={styles.cardSubtitle}>
            {t('contractor.currentLanguage', 'Current language')}: <Text style={{ fontWeight: '700', color: palette.primary }}>{LANGUAGE_LABELS[language] ?? language}</Text>
          </Text>

          <Button
            label={t('contractor.changeLanguage', 'Change Language')}
            variant="secondary"
            onPress={() => router.push('/language')}
          />

          <View style={{ marginTop: spacing.md }}>
            <Button
              label={t('auth.signOut', 'Sign Out')}
              variant="danger"
              onPress={handleSignOut}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EDF5F6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  contractorName: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  contractorIdBadge: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.primary,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statusChip: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  statusChipText: {
    color: palette.success,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  detailRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  detailLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: fontSize.sm,
    color: palette.text,
    fontWeight: '700',
    marginTop: 2,
  },
  siteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: palette.border,
  },
  siteItemSelected: {
    backgroundColor: '#EBF4F6',
    borderColor: palette.primary,
  },
  siteItemName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: palette.text,
  },
  siteItemMeta: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: palette.primary,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  selectedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
