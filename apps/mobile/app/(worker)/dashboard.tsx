import React, { useCallback, useEffect, useState } from 'react';
import {
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
import {
  workerApi,
  type WorkerProfile,
  isNetworkError,
} from '@/api';
import { useSession } from '@/store/session';
import { flushOutbox, pendingCount } from '@/services/sync';

interface ActionCardItem {
  id: string;
  route: string;
  title: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  borderColor: string;
}

const DASHBOARD_ACTIONS: ActionCardItem[] = [
  // Top row
  {
    id: 'exit',
    route: '/(worker)/exit',
    title: 'Exit from Goa',
    icon: '↗',
    iconColor: '#3873B0',
    bgColor: '#E0F5F1',
    borderColor: '#BAE6FD',
  },
  {
    id: 'entry',
    route: '/(worker)/entry',
    title: 'Entry in Goa',
    icon: '↘️',
    iconColor: '#008B8B',
    bgColor: '#E8F1FA',
    borderColor: '#99F6E4',
  },
  // Middle row
  {
    id: 'unwell',
    route: '/(worker)/unwell',
    title: 'Not Feeling Well',
    icon: '🤒',
    iconColor: '#CD3640',
    bgColor: '#FFEBEC',
    borderColor: '#FECDD3',
  },
  {
    id: 'family',
    route: '/(worker)/family',
    title: 'Family',
    icon: '👨‍👩‍👧',
    iconColor: '#2E8B57',
    bgColor: '#E7F5EB',
    borderColor: '#BBF7D0',
  },
  // Bottom row
  {
    id: 'roommate',
    route: '/(worker)/roommate',
    title: 'Roommate',
    icon: '⌂',
    iconColor: '#6F55A6',
    bgColor: '#F1ECFA',
    borderColor: '#E9D5FF',
  },
  {
    id: 'transfer',
    route: '/(worker)/transfer',
    title: 'Transfer Site',
    icon: '⇄',
    iconColor: '#C48524',
    bgColor: '#FCF5E5',
    borderColor: '#FDE68A',
  },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, language } = useSession();

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

  return (
    <View style={styles.container}>
      {/* Top Bar with Language Selector and Audio Guidance */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.push('/language')}
          style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Change Language"
        >
          <Text style={{ fontSize: 16, marginRight: 4 }}>🌐</Text>
          <Text style={styles.langButtonText}>
            {language ? language.toUpperCase() : 'EN'}
          </Text>
          <Text style={{ fontSize: 10, marginLeft: 2, color: '#6F7E89' }}>▼</Text>
        </Pressable>

        <AudioGuidanceButton
          text={`Welcome to M3 App ${workerName}. Select from the six options: Exit from Goa, Entry in Goa, Not Feeling Well, Family, Roommate, or Transfer Site.`}
          size="small"
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#008B8B']} />}
      >
        {/* Header Block matching Slides 3-8 */}
        <View style={styles.headerBlock}>
          <Text style={styles.appTitle}>Welcome to M3 App</Text>
          <Text style={styles.workerName}>{workerName}</Text>
        </View>

        {outboxPending > 0 && (
          <View style={styles.syncNotice}>
            <Text style={styles.syncNoticeText}>
              🔄 {outboxPending} unsynced submission(s) queued offline. Will sync automatically upon connection.
            </Text>
          </View>
        )}

        {/* Exactly Six Primary Actions in 2-Column by 3-Row Grid matching Slides 3-8 */}
        <View style={styles.actionsGrid}>
          {DASHBOARD_ACTIONS.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.actionCard,
                {
                  backgroundColor: item.bgColor,
                  borderColor: item.borderColor,
                },
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(item.route as never)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <Text style={[styles.actionIcon, { color: item.iconColor }]}>
                {item.icon}
              </Text>
              <Text style={styles.actionTitle}>
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 8,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE4E8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#183043',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerBlock: {
    marginBottom: 28,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: -0.5,
  },
  workerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#19364F',
    marginTop: 4,
  },
  syncNotice: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  syncNoticeText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  actionCard: {
    width: '47.5%',
    height: 125,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#19364F',
    textAlign: 'center',
  },
});
