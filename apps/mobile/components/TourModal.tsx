import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from 'react-native'
import { useAppStore } from '@/src/store'
import { t } from '@/src/i18n'
import { writeMeta } from '@/src/cache'
import { Button } from '@/components/ui'

/* Task 3: interactive multi-step application tour (English + Hindi).
 * Shown automatically on first dashboard launch (storage key `m3_tour_completed`)
 * and reopenable from the dashboard's "Start Tour" button. Completing the tour
 * persists the flag in cache_meta so it is only shown once. */

export const TOUR_COMPLETED_KEY = 'm3_tour_completed'

const STEPS = [
  { icon: '🧍', titleKey: 'tourStep1Title', bodyKey: 'tourStep1Body' },
  { icon: '🔍', titleKey: 'tourStep2Title', bodyKey: 'tourStep2Body' },
  { icon: '🧪', titleKey: 'tourStep3Title', bodyKey: 'tourStep3Body' },
  { icon: '📡', titleKey: 'tourStep4Title', bodyKey: 'tourStep4Body' },
] as const

export function TourModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const language = useAppStore((x) => x.language)
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (visible) setStep(0)
  }, [visible])

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const finish = () => {
    writeMeta(TOUR_COMPLETED_KEY, '1')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={finish}>
      <StatusBar barStyle="light-content" />
      <View style={s.backdrop}>
        <View style={s.card}>
          {/* Step counter */}
          <Text style={s.stepCounter}>
            {tr('step')} {step + 1} / {STEPS.length}
          </Text>

          {/* Progress bars */}
          <View style={s.progressRow}>
            {STEPS.map((_, i) => (
              <View key={i} style={[s.progressBar, i <= step && s.progressBarActive]} />
            ))}
          </View>

          <Text style={s.icon}>{current.icon}</Text>
          <Text style={s.title}>{tr(current.titleKey as any)}</Text>
          <Text style={s.body}>{tr(current.bodyKey as any)}</Text>
          {isLast && <Text style={s.done}>{tr('tourDone')}</Text>}
          <Text style={s.hint}>{tr('tourHint')}</Text>

          <View style={s.navRow}>
            {step > 0 ? (
              <View style={{ flex: 1 }}>
                <Button variant="outline" size="md" onPress={() => setStep(step - 1)}>
                  {tr('previous')}
                </Button>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <View style={{ flex: 1 }}>
              {isLast ? (
                <Button variant="primary" size="md" onPress={finish}>
                  {tr('finish')}
                </Button>
              ) : (
                <Button variant="primary" size="md" onPress={() => setStep(step + 1)}>
                  {tr('next')}
                </Button>
              )}
            </View>
          </View>

          <Pressable accessibilityRole="button" onPress={finish} hitSlop={8} style={s.skipPress}>
            <Text style={s.skip}>{language === 'hi' ? 'छोड़ें' : 'Skip'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    gap: 12,
  },
  stepCounter: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#0f766e',
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  progressBarActive: {
    backgroundColor: '#0f766e',
  },
  icon: {
    fontSize: 34,
    textAlign: 'center',
    marginTop: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
  },
  done: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
  },
  hint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  skipPress: {
    alignSelf: 'center',
    padding: 4,
  },
  skip: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
})

export default TourModal
