import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAppStore } from '@/src/store'
import { t } from '@/src/i18n'
import { Button, StatusBadge } from '@/components/ui'
import type { CachedWorker } from '@/src/cache'

/* Task 4: touch-friendly worker identification card.
 * Lets health workers identify a candidate WITHOUT alphanumeric codes:
 * large name, phone, home state, and a single-screening status badge
 * (green = screened, yellow = pending). Tapping the card opens the full
 * WorkerDetailModal bottom sheet. */

export type WorkerCardActions = {
  onOpenRecord: () => void
  onQuickAction?: () => void
  quickActionLabel?: string
  quickActionDisabled?: boolean
}

export function WorkerCard({
  worker,
  onOpenRecord,
  onQuickAction,
  quickActionLabel,
  quickActionDisabled = false,
}: {
  worker: CachedWorker
} & WorkerCardActions) {
  const { language } = useAppStore()
  const tr = (k: any) => t(language, k as any)

  const screened = Boolean(worker.screening_completed)
  const badge = screened
    ? { label: tr('alreadyScreenedBadge'), variant: 'success' as const }
    : { label: tr('pendingBadge'), variant: 'warning' as const }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpenRecord}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.8 }]}
    >
      {/* Header row: name + status badge */}
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>
            ✓ {worker.display_name || worker.patient_code}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {worker.phone_e164 ? `📞 ${worker.phone_e164}` : ''}
            {worker.phone_e164 && worker.nativity ? '  •  ' : ''}
            {worker.nativity ? `🏔 ${tr('nativity')}: ${worker.nativity}` : ''}
            {worker.phone_e164 || worker.nativity ? '' : worker.patient_code}
          </Text>
        </View>
        <StatusBadge label={badge.label} variant={badge.variant} />
      </View>

      {/* Secondary row: age/gender/occupation + worker code */}
      <Text style={s.subMeta} numberOfLines={1}>
        {[
          worker.occupation || null,
          worker.age_years ? `${worker.age_years}` : null,
          worker.gender || null,
        ]
          .filter(Boolean)
          .join(' · ')}
        {worker.patient_code ? (worker.occupation || worker.age_years || worker.gender ? '  ·  ' : '') + worker.patient_code : ''}
      </Text>

      {/* Action row */}
      <View style={s.actionsRow}>
        <View style={s.actionBtn}>
          <Button variant="outline" size="sm" fullWidth onPress={onOpenRecord}>
            {tr('viewRecord')}
          </Button>
        </View>
        {onQuickAction && quickActionLabel ? (
          <View style={s.actionBtn}>
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              disabled={quickActionDisabled}
              onPress={onQuickAction}
            >
              {quickActionLabel}
            </Button>
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  meta: {
    fontSize: 13,
    color: '#475569'
    ,
    marginTop: 2,
  },
  subMeta: {
    fontSize: 12,
    color: '#64748b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  actionBtn: {
    flex: 1,
  },
})

export default WorkerCard
