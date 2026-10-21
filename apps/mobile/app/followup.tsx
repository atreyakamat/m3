import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { api } from '@/src/api'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import {
  Button,
  Field,
  Card,
  FormShell,
  NoticeBanner,
  ChipPicker,
  StatusBadge,
  EmptyState,
  LoadingSpinner,
} from '@/components/ui'

interface FollowUpRow {
  id: string
  patient_id: string
  scheduled_day: string | number | null
  due_at: string
  status: string
  assigned_to_user_id: string | null
  assigned_user_name?: string | null
  completed_at?: string | null
  outcome?: string | null
}

interface HealthWorkerOption {
  id: string
  display_name: string
}

// Protocol-scheduled follow-ups (PRD CLIN-003): +1d, +3d, +7d, +14d, +28d.
const PROTOCOL_DAYS = [1, 3, 7, 14, 28]

function dueDateFor(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

export default function Followup() {
  const { language, session, online } = useAppStore()
  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])
  const params = useLocalSearchParams<{ patientId?: string }>()

  const isClinician = session?.user?.roles?.includes('clinician')
  const disabled = !online || !session?.token || session?.demo

  // Read-only assignment list for health workers (and clinicians).
  const [assignments, setAssignments] = useState<FollowUpRow[] | null>(null)
  const [listError, setListError] = useState('')

  // clinician-only assignment form
  const [workers, setWorkers] = useState<HealthWorkerOption[]>([])
  const [patientId, setPatientId] = useState(params.patientId || '')
  const [assignedId, setAssignedId] = useState('')
  const [scheduledDay, setScheduledDay] = useState<number>(3)
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    if (!session?.token || !online || session?.demo) return
    try {
      const res = await api<{ items: FollowUpRow[] }>('/follow-ups', session.token)
      setAssignments(res.items || [])
      setListError('')
    } catch (e) {
      setListError(e instanceof Error ? e.message : tr('error'))
    }
  }, [session?.token, online, session?.demo, language])

  useEffect(() => {
    load()
  }, [session?.token, online, session?.demo])

  async function loadWorkers() {
    try {
      const res = await api<{ items: HealthWorkerOption[] }>('/health-workers', session!.token!)
      setWorkers(res.items || [])
    } catch {
      // Non-fatal: clinician can still enter an ID manually via list of assignments.
    }
  }

  useEffect(() => {
    if (!isClinician || !session?.token || !online || session?.demo) return
    loadWorkers()
  }, [isClinician, session?.token, online, session?.demo])

  async function assign() {
    if (!session?.token) return
    setFormError('')
    if (!patientId.trim()) {
      setFormError('Patient ID or code is required')
      return
    }
    if (!assignedId) {
      setFormError('Assign a Health Worker before scheduling')
      return
    }
    setPending(true)
    try {
      await api('/follow-ups', session.token, {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId.trim(),
          assigned_user_id: assignedId,
          scheduled_day: `+${scheduledDay}d`,
          due_at: dueDateFor(scheduledDay),
          notes: notes.trim() || undefined,
        }),
      })
      Alert.alert(
        tr('saved'),
        `Follow-up visit scheduled for +${scheduledDay} day${scheduledDay === 1 ? '' : 's'} (${new Date(dueDateFor(scheduledDay)).toLocaleDateString()}). The assigned Health Worker sees it in their queue.`
      )
      setPatientId('')
      setNotes('')
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : tr('error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <FormShell contentContainerStyle={s.container}>
      <View style={s.header}>
        <Text style={s.eyebrow}>MONITORING &amp; RETENTION</Text>
        <Text style={s.title}>{tr('followups')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title="Protocol-Scheduled Follow-ups"
        message="Visits are generated on the +1d / +3d / +7d / +14d / +28d surveillance protocol. Completion records (adherence and outcome) are captured in the field and will surface here in the full release."
      />

      {!online && (
        <NoticeBanner type="offline" title={tr('offline')} message={tr('connectivityRequired')} />
      )}

      {isClinician ? (
        <Card title="Schedule Follow-up Visit" subtitle="Assignment of visits is a clinician-only action">
          <Field
            label={tr('selectWorker')}
            placeholder="e.g. M3-6A817D7C or UUID"
            value={patientId}
            onChangeText={setPatientId}
            hint="Patient code or UUID"
            required
          />

          {workers.length > 0 ? (
            <ChipPicker
              label="Assigned Health Worker"
              options={workers.map((w) => ({ label: w.display_name, value: w.id }))}
              value={assignedId}
              onChange={setAssignedId}
              horizontal={false}
            />
          ) : (
            <Field
              label="Assigned Health Worker ID"
              placeholder="User UUID of a health_worker account"
              value={assignedId}
              onChangeText={setAssignedId}
              required
            />
          )}

          <View style={s.presetSection}>
            <Text style={s.presetLabel}>Standard Protocol Intervals:</Text>
            <View style={s.presetRow}>
              {PROTOCOL_DAYS.map((days) => (
                <Button
                  key={days}
                  variant={scheduledDay === days ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => setScheduledDay(days)}
                >
                  +{days} {days === 1 ? 'day' : 'days'}
                </Button>
              ))}
            </View>
          </View>

          <Field
            label={tr('notes')}
            placeholder="Visit instructions, worker status, next steps..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          {formError ? <NoticeBanner type="error" title="Not scheduled" message={formError} /> : null}

          <View style={s.submitAction}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={pending}
              disabled={disabled || pending}
              onPress={assign}
            >
              {tr('submit')}
            </Button>
          </View>
        </Card>
      ) : (
        <NoticeBanner
          type="warning"
          title="Read-Only View"
          message="Health Worker and Admin accounts have read-only access to assigned follow-up visits. Scheduling new visits is restricted to Clinicians."
        />
      )}

      <Card title="My Assignments">
        {listError ? (
          <NoticeBanner type="error" title="Error" message={listError} />
        ) : assignments === null ? (
          <LoadingSpinner message="Loading follow-up queue..." />
        ) : assignments.length === 0 ? (
          <EmptyState
            title={tr('noRecords')}
            message={
              disabled
                ? 'Connect to the LAN API to load your assigned visits.'
                : 'No follow-up visits are assigned to you yet.'
            }
          />
        ) : (
          assignments.map((row) => (
            <View key={row.id} style={s.assignmentRow}>
              <View style={s.assignmentMain}>
                <Text style={s.assignmentTitle}>
                  {row.assigned_user_name || 'Health Worker'} · +{String(row.scheduled_day ?? '?').replace('+', '')}
                </Text>
                <Text style={s.assignmentMeta}>
                  Due {row.due_at ? new Date(row.due_at).toLocaleDateString() : '?'} · Worker {(row.patient_id || '').slice(0, 8)}
                </Text>
              </View>
              <StatusBadge
                label={row.completed_at ? 'completed' : row.status || 'scheduled'}
                variant={row.completed_at ? 'success' : row.status === 'missed' ? 'danger' : 'neutral'}
              />
            </View>
          ))
        )}
      </Card>
    </FormShell>
  )
}

const s = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
    flexGrow: 1,
    backgroundColor: '#f4f4f5',
  },
  header: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: '#71717a',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#18181b',
    letterSpacing: -0.5,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    gap: 8,
  },
  assignmentMain: {
    flex: 1,
    gap: 2,
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181b',
  },
  assignmentMeta: {
    fontSize: 12,
    color: '#71717a',
  },
  presetSection: {
    gap: 6,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27272a',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  submitAction: {
    marginTop: 8,
  },
})
