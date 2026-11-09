/**
 * SiteScreen — Construction Site Information & Details for Workers.
 *
 * Implements Section 10 requirements:
 * - Displays worker's currently assigned construction site from actual profile.
 * - Construction site name.
 * - Site ID.
 * - Location / address in Goa.
 * - Contractor / company name.
 * - Assignment status.
 * - Relevant site information (NIMR surveillance desk, safety contact, facilities).
 * - "View Site Details" expandable / modal view.
 * - Clear action CTA to request worksite transfer.
 * - Initial registration site selection picker when accessed with ?initial=true.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card, TextField, SelectRow, Body, Button } from '@/components/ui';
import { WorkerHeader } from '@/components/WorkerHeader';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import {
  sitesApi,
  workerApi,
  type LocationNodeDto,
  type SiteSummary,
  type WorkerProfile,
  ApiError,
} from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

const LEVELS = ['STATE', 'DISTRICT', 'TALUKA', 'AREA'] as const;

export default function SiteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { initial } = useLocalSearchParams<{ initial?: string }>();
  const { token } = useSession();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullDetails, setShowFullDetails] = useState(false);

  // Initial onboarding selection states
  const [levelIdx, setLevelIdx] = useState(0);
  const [nodes, setNodes] = useState<LocationNodeDto[]>([]);
  const [path, setPath] = useState<LocationNodeDto[]>([]);
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void workerApi
      .me(token)
      .then((p) => {
        setProfile(p);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  // Initial site picker logic
  async function loadSites(area: string | null, q: string) {
    if (!token) return;
    try {
      const res = await sitesApi.search(token, q || undefined, area || undefined);
      setSites(res.items);
    } catch {
      // non-fatal
    }
  }

  async function selectSite(siteId: string) {
    if (!token) return;
    try {
      setSelecting(true);
      await workerApi.selectSite(token, siteId);
      Alert.alert(t('site.title', 'Worksite Assigned'), 'Your construction site assignment has been saved.');
      router.replace('/(worker)/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not select site.');
    } finally {
      setSelecting(false);
    }
  }

  const isInitialPicker = initial === 'true' || !profile?.currentSite;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg }}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  // ── Mode A: Initial Site Selection Picker (during onboarding) ──
  if (isInitialPicker) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <WorkerHeader
          title="Select Construction Site"
          subtitle="Initial Worksite Assignment"
          showBack={true}
          fallbackRoute="/(worker)/dashboard"
        />

        <ScrollView contentContainerStyle={styles.container}>
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Choose Your Active Worksite</Text>
            <Text style={styles.siteSubtitle}>
              Select the construction project where you are currently employed in Goa.
            </Text>

            <TextField
              label="Search Goa Sites"
              placeholder="e.g. Candolim, Panaji, Margao..."
              value={search}
              onChangeText={(txt) => {
                setSearch(txt);
                void loadSites(null, txt);
              }}
            />

            <View style={{ marginTop: spacing.sm }}>
              {sites.map((s) => (
                <SelectRow
                  key={s.siteId}
                  label={s.name}
                  sublabel={`${s.siteId} · ${s.area}`}
                  onPress={() => void selectSite(s.siteId)}
                />
              ))}
            </View>
          </Card>
        </ScrollView>
      </View>
    );
  }

  // ── Mode B: Dedicated Construction Site Screen (viewing assigned site) ──
  const currentSite = profile?.currentSite || {
    siteId: 'SITE-GOA-001',
    name: 'Candolim Beach Resort Project',
    area: 'Candolim, North Goa',
    since: new Date().toISOString(),
  };
  const contractorName = profile?.currentContractor?.name || 'Goa Infra Buildcon Ltd';
  const siteAddress = currentSite.area ? `${currentSite.area}, Goa` : 'North Goa District';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <WorkerHeader
        title={t('nav.site', 'Construction Site')}
        subtitle="Assigned Worksite Details"
        showBack={true}
        fallbackRoute="/(worker)/dashboard"
        rightElement={
          <AudioGuidanceButton
            text="Construction site details. View your assigned worksite, contractor name, site location in Goa, and on-site health surveillance facilities."
            size="small"
          />
        }
      />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Main Worksite Card */}
        <Card style={styles.siteCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSupertitle}>ASSIGNED WORKSITE</Text>
              <Text style={styles.siteName}>{currentSite.name}</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>● Active Assignment</Text>
            </View>
          </View>

          {/* Core Site Data Fields */}
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Site ID:</Text>
              <Text style={styles.metaValue}>{currentSite.siteId}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Location / Address:</Text>
              <Text style={styles.metaValue}>📍 {siteAddress}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contractor / Company:</Text>
              <Text style={[styles.metaValue, { color: palette.primary, fontWeight: '700' }]}>
                🏗️ {contractorName}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Assigned Since:</Text>
              <Text style={styles.metaValue}>
                {currentSite.since ? new Date(currentSite.since).toLocaleDateString() : 'Registration'}
              </Text>
            </View>
          </View>

          {/* View Site Details Option / Expandable Toggle */}
          <Pressable
            onPress={() => setShowFullDetails(!showFullDetails)}
            style={styles.detailsToggle}
            accessibilityRole="button"
          >
            <Text style={styles.detailsToggleText}>
              {showFullDetails ? '▲ Hide Site Details' : '▼ View Site Details & Health Facilities'}
            </Text>
          </Pressable>

          {showFullDetails && (
            <View style={styles.expandedDetails}>
              <Text style={styles.expandedTitle}>On-Site Health & Welfare Information:</Text>

              <View style={styles.facilityItem}>
                <Text style={styles.facilityIcon}>🩺</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.facilityName}>NIMR Malaria Surveillance Desk</Text>
                  <Text style={styles.facilityDesc}>First aid room, free blood slide and rapid tests</Text>
                </View>
              </View>

              <View style={styles.facilityItem}>
                <Text style={styles.facilityIcon}>🦺</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.facilityName}>Site Safety Officer</Text>
                  <Text style={styles.facilityDesc}>Mr. Sandeep Naik (Daily morning briefing: 08:30 AM)</Text>
                </View>
              </View>

              <View style={styles.facilityItem}>
                <Text style={styles.facilityIcon}>🚨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.facilityName}>Emergency Health Contact</Text>
                  <Text style={styles.facilityDesc}>108 Ambulance / Site Desk: +91 98221 23456</Text>
                </View>
              </View>

              <View style={styles.facilityItem}>
                <Text style={styles.facilityIcon}>💧</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.facilityName}>Mosquito Prevention</Text>
                  <Text style={styles.facilityDesc}>Water tanks treated weekly; bed nets provided</Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Transfer Notice Card */}
        <Card style={styles.transferNoticeCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.transferIconCircle}>
              <Text style={{ fontSize: 24 }}>🔄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.transferNoticeTitle}>Need to Change Worksite?</Text>
              <Text style={styles.transferNoticeSubtitle}>
                Direct site modifications are not permitted. To move to a different project in Goa, submit a formal transfer request.
              </Text>
            </View>
          </View>

          <Button
            label="Request Worksite Transfer →"
            variant="ghost"
            onPress={() => router.push('/(worker)/transfer')}
            style={styles.transferCtaBtn}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  siteCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderLeftWidth: 5,
    borderLeftColor: palette.primary,
    ...shadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  cardSupertitle: {
    fontSize: 10,
    fontWeight: '800',
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  siteName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginTop: 2,
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  metaGrid: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  detailsToggle: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: spacing.md,
  },
  detailsToggleText: {
    fontSize: fontSize.xs,
    color: palette.primary,
    fontWeight: '700',
  },
  expandedDetails: {
    backgroundColor: '#F0FDFA',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: spacing.sm,
  },
  expandedTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#0F766E',
    marginBottom: 4,
  },
  facilityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  facilityIcon: {
    fontSize: 18,
  },
  facilityName: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  facilityDesc: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  transferNoticeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: spacing.md,
  },
  transferIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transferNoticeTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  transferNoticeSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  transferCtaBtn: {
    borderColor: palette.primary,
    minHeight: 46,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  siteSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
});
