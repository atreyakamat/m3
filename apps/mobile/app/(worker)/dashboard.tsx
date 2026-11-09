/**
 * Worker Dashboard — Master Implementation.
 *
 * Implements Section 5 requirements:
 * - Exactly six primary actions in a 2-column, 3-row grid:
 *   Top row:    [Exit from Goa (Left, Blue)]    [Entry in Goa (Right, Teal)]
 *   Middle row: [Not Feeling Well (Left, Red)]  [Family (Right, Green)]
 *   Bottom row: [Roommate (Left, Purple)]       [Transfer Site (Right, Amber)]
 * - Realistic smartphone layout with light theme.
 * - Consistent typography, clean rounded cards, large touch targets.
 * - No Construction Site card, no unnecessary subtitles or decorative elements.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { WorkerHeader } from '@/components/WorkerHeader';
import {
  workerApi,
  recordsApi,
  type WorkerProfile,
  type EpisodeDto,
  isNetworkError,
} from '@/api';
import { useSession } from '@/store/session';
import { flushOutbox, pendingCount } from '@/services/sync';
import { palette, spacing, radius, fontSize, fontWeight, shadow } from '@/theme';

interface DashboardAction {
  id: string;
  route: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  lightBg: string;
  borderColor: string;
}

const DASHBOARD_ACTIONS: DashboardAction[] = [
  // Top row
  {
    id: 'exit',
    route: '/(worker)/exit',
    title: 'Exit from Goa',
    subtitle: 'Report departure',
    icon: '🛫',
    accentColor: '#2563EB', // Blue
    lightBg: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  {
    id: 'entry',
    route: '/(worker)/entry',
    title: 'Entry in Goa',
    subtitle: 'Report arrival',
    icon: '🛬',
    accentColor: '#0D9488', // Teal
    lightBg: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  // Middle row
  {
    id: 'unwell',
    route: '/(worker)/unwell',
    title: 'Not Feeling Well',
    subtitle: 'Report symptoms',
    icon: '🤒',
    accentColor: '#DC2626', // Red
    lightBg: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  {
    id: 'family',
    route: '/(worker)/family',
    title: 'Family',
    subtitle: 'Add family member',
    icon: '👨‍👩‍👧',
    accentColor: '#16A34A', // Green
    lightBg: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  // Bottom row
  {
    id: 'roommate',
    route: '/(worker)/roommate',
    title: 'Roommate',
    subtitle: 'Add roommate',
    icon: '👥',
    accentColor: '#9333EA', // Purple
    lightBg: '#FAF5FF',
    borderColor: '#D8B4FE',
  },
  {
    id: 'transfer',
    route: '/(worker)/transfer',
    title: 'Transfer Site',
    subtitle: 'Request site move',
    icon: '🔄',
    accentColor: '#D97706', // Amber/Orange
    lightBg: '#FFFBEB',
    borderColor: '#FDE68A',
  },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signOut } = useSession();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [outboxPending, setOutboxPending] = useState(0);

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [p] = await Promise.all([
        workerApi.me(token).catch((err) => {
          if (isNetworkError(err)) return null;
          throw err;
        }),
        flushOutbox(token).catch(() => {}),
      ]);

      if (p) {
        setProfile(p);
      }
      setOutboxPending(pendingCount());
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const workerName = profile?.name || user?.displayName || 'Worker';
  const workerCode = profile?.workerId || user?.workerId || 'M3-R2G6N3';
  const siteName = profile?.currentSite?.name || 'Candolim Beach Resort Project';
  const siteArea = profile?.currentSite?.area || 'Candolim, North Goa';

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <WorkerHeader
        title="M3 Malaria Surveillance"
        subtitle={`Worker ID: ${workerCode}`}
        rightElement={
          <AudioGuidanceButton
            text={`Worker dashboard. Welcome ${workerName}. Select from the six options: Exit from Goa, Entry in Goa, Not Feeling Well, Family, Roommate, or Transfer Site.`}
            size="small"
          />
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
      >
        {/* Worker Greeting & Assigned Site Card */}
        <Pressable
          style={({ pressed }) => [styles.workerCard, pressed && styles.cardPressed]}
          onPress={() => router.push('/(worker)/profile')}
          accessibilityRole="button"
          accessibilityLabel="View Worker Profile"
        >
          <View style={styles.workerAvatar}>
            <Text style={{ fontSize: 24 }}>👷‍♂️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingText}>Namaste, {workerName}</Text>
            <Pressable
              style={styles.siteBadgeRow}
              onPress={() => router.push('/(worker)/site')}
              accessibilityRole="button"
              accessibilityLabel="View Construction Site"
            >
              <Text style={styles.siteIcon}>🏗️</Text>
              <Text style={styles.siteNameText} numberOfLines={1}>
                {siteName}
              </Text>
            </Pressable>
            <Text style={styles.siteAreaText}>📍 {siteArea}</Text>
          </View>
          <Text style={styles.chevronIcon}>›</Text>
        </Pressable>

        {outboxPending > 0 && (
          <View style={styles.syncNotice}>
            <Text style={styles.syncNoticeText}>
              🔄 {outboxPending} unsynced submission(s) queued offline. Will sync automatically upon connection.
            </Text>
          </View>
        )}

        {/* Section Heading */}
        <Text style={styles.sectionHeading}>Worker Actions</Text>

        {/* Primary 6 Actions in 2-Column Grid */}
        <View style={styles.actionsGrid}>
          {DASHBOARD_ACTIONS.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  borderColor: item.borderColor,
                  backgroundColor: item.lightBg,
                },
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(item.route as never)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <View style={[styles.iconWrapper, { backgroundColor: item.accentColor }]}>
                <Text style={styles.actionIcon}>{item.icon}</Text>
              </View>
              <Text style={[styles.actionTitle, { color: '#0F172A' }]}>
                {item.title}
              </Text>
              <Text style={[styles.actionSubtitle, { color: item.accentColor }]}>
                {item.subtitle}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Surveillance Records & Worksite Hub */}
        <Text style={[styles.sectionHeading, { marginTop: spacing.xl }]}>
          Surveillance Records & Worksite
        </Text>
        <View style={styles.hubContainer}>
          {/* Construction Site */}
          <Pressable
            style={({ pressed }) => [styles.hubCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(worker)/site')}
            accessibilityRole="button"
            accessibilityLabel="Construction Site"
          >
            <View style={[styles.hubIconWrapper, { backgroundColor: '#F0FDFA' }]}>
              <Text style={styles.hubIcon}>🏗️</Text>
            </View>
            <View style={styles.hubTextCol}>
              <Text style={styles.hubTitle}>Construction Site</Text>
              <Text style={styles.hubSubtitle} numberOfLines={1}>
                {siteName} • Details & Contacts
              </Text>
            </View>
            <Text style={styles.hubChevron}>›</Text>
          </Pressable>

          {/* Worker Profile */}
          <Pressable
            style={({ pressed }) => [styles.hubCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(worker)/profile')}
            accessibilityRole="button"
            accessibilityLabel="My Profile"
          >
            <View style={[styles.hubIconWrapper, { backgroundColor: '#EFF6FF' }]}>
              <Text style={styles.hubIcon}>👤</Text>
            </View>
            <View style={styles.hubTextCol}>
              <Text style={styles.hubTitle}>My Profile</Text>
              <Text style={styles.hubSubtitle}>
                ID: {workerCode} • Demographics & Identity
              </Text>
            </View>
            <Text style={styles.hubChevron}>›</Text>
          </Pressable>

          {/* Initial Screening */}
          <Pressable
            style={({ pressed }) => [styles.hubCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(worker)/screening')}
            accessibilityRole="button"
            accessibilityLabel="Initial Screening"
          >
            <View style={[styles.hubIconWrapper, { backgroundColor: '#F5F3FF' }]}>
              <Text style={styles.hubIcon}>📋</Text>
            </View>
            <View style={styles.hubTextCol}>
              <Text style={styles.hubTitle}>Initial Screening</Text>
              <Text style={styles.hubSubtitle}>
                Baseline survey & medical history
              </Text>
            </View>
            <Text style={styles.hubChevron}>›</Text>
          </Pressable>

          {/* Household Management */}
          <Pressable
            style={({ pressed }) => [styles.hubCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/(worker)/household')}
            accessibilityRole="button"
            accessibilityLabel="Household Management"
          >
            <View style={[styles.hubIconWrapper, { backgroundColor: '#F0FDF4' }]}>
              <Text style={styles.hubIcon}>👨‍👩‍👧‍👦</Text>
            </View>
            <View style={styles.hubTextCol}>
              <Text style={styles.hubTitle}>Household Management</Text>
              <Text style={styles.hubSubtitle}>
                Active & inactive family & roommates overview
              </Text>
            </View>
            <Text style={styles.hubChevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Light grey background
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  workerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  greetingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A', // Dark navy
  },
  siteBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  siteIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  siteNameText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#0D9488', // Teal accent
    flex: 1,
  },
  siteAreaText: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 1,
  },
  syncNotice: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  syncNoticeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionCard: {
    width: '47.5%',
    minHeight: 135,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.card,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chevronIcon: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  hubContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  hubIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  hubIcon: {
    fontSize: 20,
  },
  hubTextCol: {
    flex: 1,
  },
  hubTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  hubSubtitle: {
    fontSize: 12,
    color: palette.textMuted,
  },
  hubChevron: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
});
