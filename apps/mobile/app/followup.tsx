import React, { useEffect, useState, useCallback, useRef } from 'react'
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
import { DemoBanner } from '@/components/DemoBanner'
import { demoFollowups, demoHealthWorkerOptions } from '@/src/demoData'
import { saveDemoRecord, listDemoRecords } from '@/src/demoStore'
import type { DemoFollowup } from '@/src/demoData'

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
  // Demo: the read-only queue and (for clinicians) the local demo assignment
  // form stay available; only real server writes require token + network.
  const isDemo = Boolean(session?.demo)
  const canAssign = isDemo ? isClinician : online && Boolean(session?.token) && isClinician

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

  // Entity idempotency key for POST /follow-ups (defect D2). Minted at the
  // first Assign of a logical task, reused on every retry until the server
  // confirms, then released. A success leaves the form, and the next task
  // mints a fresh key.
  const followupRequestId = useRef<string | undefined>(undefined)

  const load = useCallback(async () => {
    if (session?.demo) {
      // Synthetic demo queue: deterministic examples + everything recorded
      // locally in demo mode during this install. Zero server traffic.
      const localRows: FollowUpRow[] = listDemoRecords('followup').map((r) => {
        const p = r.payload as any
        return {
          id: r.id,
          patient_id: p?.patient_id || '',
          scheduled_day: p?.scheduled_day,
          due_at: p?.due_at || r.created_at,
          status: 'demo_saved_locally',
          assigned_to_user_id: p?.assigned_user_id || null,
          assigned_user_name: p?.assigned_user_name || 'Synthetic Health Worker',
          completed_at: null,
          outcome: null,
        }
      })
      setAssignments([
        ...localRows,
        ...(demoFollowups() as unknown as FollowUpRow[]),
      ])
      setListError('')
      return
    }
    if (!session?.token || !online) return
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
    if (session?.demo) {
      // Synthetic health-worker options so the demo assignment form is usable.
      setWorkers(demoHealthWorkerOptions())
      return
    }
    try {
      const res = await api<{ items: HealthWorkerOption[] }>('/health-workers', session!.token!)
      setWorkers(res.items || [])
    } catch {
      // Non-fatal: clinician can still enter an ID manually via list of assignments.
    }
  }

  useEffect(() => {
    if (session?.demo) {
      // Demo: synthetic assignments + health-worker options, no server.
      load()
      loadWorkers()
      return
    }
    if (!isClinician || !session?.token || !online) return
    loadWorkers()
  }, [isClinician, session?.token, online, session?.demo, load])

  async function assign() {
    if (!isClinician) return
    if (!session?.demo && !session?.token) return
    setFormError('')
    if (!patientId.trim()) {
      setFormError('Patient ID or code is required')
      return
    }
    if (!assignedId) {
      setFormError('Assign a Health Worker before scheduling')
      return
    }

    if (session?.demo) {
      // Offline Demo: finalize a LOCAL synthetic demo assignment (never a
      // server write; the demo queue above shows it with its local timestamp).
      const assignedName = demoHealthWorkerOptions().find((w) => w.id === assignedId)?.display_name
        || 'Synthetic Health Worker'
      saveDemoRecord({
        kind: 'followup',
        label: `Follow-up +${scheduledDay}d — ${patientId.trim()}`,
        payload: {
          patient_id: patientId.trim(),
          assigned_user_id: assignedId,
          assigned_user_name: assignedName,
          scheduled_day: `+${scheduledDay}d`,
          due_at: dueDateFor(scheduledDay),
          notes: notes.trim() || undefined,
        },
      })
      Alert.alert(
        'Demo follow-up saved locally',
        `Reference saved on this device at ${new Date().toLocaleString()}.\n\nThis is SYNTHETIC DEMO data only; no health worker has actually been assigned and nothing will upload to a server.`
      )
      setPatientId('')
      setNotes('')
      await load()
      return
    }

    setPending(true)
    try {
      if (!followupRequestId.current) {
        followupRequestId.current = `fup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      }
      await api('/follow-ups', session.token, {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId.trim(),
          assigned_user_id: assignedId,
          scheduled_day: `+${scheduledDay}d`,
          due_at: dueDateFor(scheduledDay),
          notes: notes.trim() || undefined,
          client_request_id: followupRequestId.current,
        }),
      })
      // Server confirmed: release the key so a NEW assignment mints a fresh one.
      followupRequestId.current = undefined
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
      {isDemo && (
        <DemoBanner detail="The queue below is a synthetic example set. Clinicians can schedule a LOCAL demo follow-up; no real health worker will be assigned and nothing uploads." />
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
              disabled={!canAssign || pending}
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
              !canAssign
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
