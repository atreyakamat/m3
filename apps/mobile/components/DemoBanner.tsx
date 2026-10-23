/**
 * Offline Demo Mode — persistent banner.
 *
 * Rendered on every dashboard/screen while a demo session is active so the
 * tester can never mistake the local synthetic sandbox for a live server
 * session. Distinguishes demo identity from real authentication (no banner,
 * no amber background, when signed in online).
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import { demoRoleLabel } from '@/src/demoData'

export function DemoBanner({ detail }: { detail?: string }) {
  const language = useAppStore((x) => x.language)
  const session = useAppStore((x) => x.session)
  if (!session?.demo) return null
  const role = session.user?.roles?.[0]
  return (
    <View style={s.banner} accessibilityLabel="Offline demo mode active">
      <View style={s.topRow}>
        <Text style={s.title}>⚠️ {t(language, 'offlineDemoTitle')}</Text>
        {role ? <Text style={s.role}>{demoRoleLabel(role)}</Text> : null}
      </View>
      <Text style={s.body}>{detail || t(language, 'offlineDemoBody')}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#fffbeb',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    color: '#92400e',
    fontSize: 13,
  },
  role: {
    fontWeight: '700',
    fontSize: 12,
    color: '#92400e',
    backgroundColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  body: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 17,
  },
})
