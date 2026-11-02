import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Card } from '@/components/ui';
import { contractorApi, type ContractorNotificationRow } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius } from '@/theme';

export default function ContractorNotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [notifications, setNotifications] = useState<ContractorNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await contractorApi.notifications(token, unreadOnly);
      setNotifications(res.items ?? []);
      setUnreadCount(res.unread ?? 0);
    } catch (e) {
      /* non-fatal */
    }
  }, [token, unreadOnly]);

  useEffect(() => {
    setLoading(true);
    void fetchNotifications().finally(() => setLoading(false));
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  async function handleNotificationTap(item: ContractorNotificationRow) {
    if (!token) return;
    try {
      if (!item.read) {
        await contractorApi.ackNotification(token, item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      // Route to related record
      if (item.entityType === 'SiteJoinRequest') {
        router.push('/(contractor)/requests');
      } else if (item.entityType === 'SiteTransferRequest') {
        router.push('/(contractor)/requests');
      } else if (item.entityType === 'TravelReport' || item.entityType === 'TravelRecord') {
        router.push('/(contractor)/travels');
      }
    } catch {
      /* ignore navigation errors */
    }
  }

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1 }}>
        {/* Filter bar */}
        <View style={styles.filterBar}>
          <Text style={styles.unreadSummary}>
            {unreadCount} {t('contractor.unreadAlerts', 'unread notification(s)')}
          </Text>
          <Pressable
            style={[styles.filterToggle, unreadOnly ? styles.filterToggleActive : null]}
            onPress={() => setUnreadOnly((v) => !v)}
          >
            <Text style={[styles.filterToggleText, unreadOnly ? styles.filterToggleTextActive : null]}>
              {unreadOnly ? t('contractor.showAll', 'Show All') : t('contractor.unreadOnly', 'Unread Only')}
            </Text>
          </Pressable>
        </View>

        {/* List Content */}
        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={{ fontSize: 32 }}>🔔</Text>
            <Text style={styles.emptyTitle}>{t('contractor.noNotifications', 'No notifications')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('contractor.noNotificationsHint', 'Updates about worker join requests, transfers and travel alerts will appear here.')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} />}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.notifCard,
                  !item.read ? styles.notifCardUnread : null,
                  pressed ? styles.notifCardPressed : null,
                ]}
                onPress={() => handleNotificationTap(item)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    {!item.read ? <View style={styles.unreadDot} /> : null}
                    <Text style={[styles.notifTitle, !item.read ? { fontWeight: '800' } : null]}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.notifTime}>
                    {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                <Text style={styles.notifBody}>{item.body}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                  <Text style={styles.notifType}>
                    {item.type.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                  {item.entityType ? (
                    <Text style={styles.openLink}>{t('common.open', 'Open')} ›</Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  unreadSummary: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.textMuted,
  },
  filterToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    backgroundColor: '#F0F4F6',
  },
  filterToggleActive: {
    backgroundColor: palette.primary,
  },
  filterToggleText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: palette.text,
  },
  filterToggleTextActive: {
    color: '#fff',
  },
  notifCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  notifCardUnread: {
    backgroundColor: '#F7FCFC',
    borderColor: palette.primary,
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
  },
  notifCardPressed: {
    opacity: 0.85,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  notifTitle: {
    fontSize: fontSize.sm,
    color: palette.text,
  },
  notifTime: {
    fontSize: 11,
    color: palette.textMuted,
  },
  notifBody: {
    fontSize: fontSize.xs,
    color: '#4A5B64',
    marginTop: 4,
    lineHeight: 18,
  },
  notifType: {
    fontSize: 10,
    color: palette.textMuted,
    textTransform: 'capitalize',
  },
  openLink: {
    fontSize: fontSize.xs,
    color: palette.primary,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
});
