import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { api } from '@/src/api'
import { useAppStore } from '@/src/store'
import { t } from '@/src/i18n'

/* Task 7: notification drawer with filters (All / Unread / urgent positives).
 * Tap an unread notification to mark it read (POST /api/v1/notifications/read). */

interface NotifItem {
  id: string
  case_id?: string | null
  kind: string
  title: string
  body: string
  created_at: string
  read_at: string | null
}

type Filter = 'all' | 'unread' | 'urgent'

export function NotificationModal({
  visible,
  onClose,
  onUnreadChanged,
}: {
  visible: boolean
  onClose: () => void
  onUnreadChanged?: (count: number) => void
}) {
  const { session, online, language } = useAppStore()
  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!session?.token || !online || session?.demo) return
    setLoading(true)
    try {
      const unreadOnly = filter === 'unread' ? '&unread_only=true' : ''
      const res = await api<{ items: NotifItem[] }>(`/notifications?limit=50${unreadOnly}`, session.token)
      setItems(res?.items || [])
      const unreadCount = (res as any)?.unread ?? (res?.items || []).filter((n) => !n.read_at).length
      onUnreadChanged?.(Number(unreadCount) || 0)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [session?.token, session?.demo, online, filter, onUnreadChanged])

  useEffect(() => {
    if (visible) load()
  }, [visible, load])

  const markRead = useCallback(async (id: string) => {
    if (!session?.token) return
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
    onUnreadChanged?.(items.filter((n) => n.read_at == null && n.id !== id).length)
    try {
      await api('/notifications/read', session.token, {
        method: 'POST',
        body: JSON.stringify({ ids: [id] }),
      })
    } catch {
      // Non-fatal: optimistic UI, retry happens on next load.
    }
  }, [session?.token, items, onUnreadChanged])

  const visibleItems = filter === 'urgent' ? items.filter((n) => n.kind === 'diagnostic_positive' || n.title.toLowerCase().includes('urgent') || n.title.toLowerCase().includes('positive')) : items

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>{tr('notifications')}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text style={s.close}>✕</Text>
            </Pressable>
          </View>

          <View style={s.filtersRow}>
            {(
              [
                ['all', tr('filterAll')],
                ['unread', tr('filterUnread')],
                ['urgent', language === 'hi' ? 'तत्काल' : 'Urgent'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="button"
                onPress={() => setFilter(key)}
                style={[s.chip, filter === key && s.chipActive]}
              >
                <Text style={[s.chipText, filter === key && s.chipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={s.list}>
            {loading && !items.length ? (
              <View style={s.loadingRow}>
                <ActivityIndicator color="#0f766e" />
                <Text style={s.emptyText}>{tr('notifLoading')}</Text>
              </View>
            ) : visibleItems.length === 0 ? (
              <Text style={s.emptyText}>{tr('notifEmpty')}</Text>
            ) : (
              visibleItems.map((n) => (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  onPress={() => markRead(n.id)}
                  style={[s.item, !n.read_at && s.itemUnread]}
                >
                  <View style={s.itemTop}>
                    <Text style={[s.itemTitle, !n.read_at && s.itemTitleUnread]}>
                      {!n.read_at ? '● ' : ''}
                      {n.title}
                    </Text>
                    <Text style={s.itemTime}>
                      {String(n.created_at).slice(0, 16).replace('T', ' ')}
                    </Text>
                  </View>
                  <Text style={s.itemBody}>{n.body}</Text>
                  <View style={s.itemFoot}>
                    <Text style={s.kind}>{n.kind.replace(/_/g, ' ').toUpperCase()}</Text>
                    {!n.read_at && <Text style={s.markRead}>{tr('markRead')}</Text>}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1e293b',
  },
  close: {
    fontSize: 18,
    color: '#0f766e',
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  list: {
    padding: 12,
    gap: 8,
  },
  item: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 4,
  },
  itemUnread: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  itemTitleUnread: {
    color: '#0f766e',
    fontWeight: '800',
  },
  itemTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  itemBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  itemFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  kind: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
    letterSpacing: 0.5,
  },
  markRead: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
    textDecorationLine: 'underline',
  },
  loadingRow: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    padding: 24,
    fontSize: 13,
    lineHeight: 18,
  },
})

export default NotificationModal
