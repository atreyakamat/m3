import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { api } from '@/src/api'
import { useAppStore } from '@/src/store'
import { NotificationModal } from '@/components/NotificationModal'

/* Task 7: in-app notification bell.
 * Polls the authenticated notification inbox (GET /api/v1/notifications) and
 * shows the unread count as a badge. Tap opens the NotificationModal with
 * filters. No push provider is configured in this deployment; polling plus the
 * server notification routing (POST assertions in services/api) is the
 * delivery path. A signed-out app renders nothing. */

const POLL_INTERVAL_MS = 30000

export function NotificationBell() {
  const { session, online, language } = useAppStore()
  const [unread, setUnread] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadUnread = useCallback(async () => {
    if (!session?.token || !online || session?.demo) {
      if (mounted.current) setUnread(0)
      return
    }
    try {
      const res = await api<{ unread: number }>('/notifications?limit=1&unread_only=true', session.token)
      if (mounted.current) setUnread(Number(res?.unread) || 0)
    } catch {
      // Non-fatal: the badge simply does not update this cycle.
    }
  }, [session?.token, session?.demo, online])

  useEffect(() => {
    loadUnread()
    if (!session?.token || !online) return
    const timer = setInterval(loadUnread, POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [loadUnread, session?.token, online])

  if (!session?.token) return null

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${language === 'hi' ? 'सूचनाएं' : 'Notifications'}${unread ? `: ${unread} ${language === 'hi' ? 'अपठित' : 'unread'}` : ''}`}
        onPress={() => {
          setModalOpen(true)
        }}
        style={({ pressed }) => [s.bellWrap, pressed && { opacity: 0.7 }]}
      >
        <Text style={s.bellIcon}>🔔</Text>
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Pressable>
      <NotificationModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false)
          // Re-check the unread badge after the drawer closes (reads may have
          // been marked read inside the modal).
          loadUnread()
        }}
        onUnreadChanged={setUnread}
      />
    </>
  )
}

const s = StyleSheet.create({
  bellWrap: {
    marginRight: 12,
    padding: 4,
  },
  bellIcon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#0f766e',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
})

export default NotificationBell
