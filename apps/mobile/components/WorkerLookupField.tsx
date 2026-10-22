/**
 * Worker identity lookup shared by the clinician and pathologist questionnaires
 * (source "Patient Name / Mobile Number — Demographic Details: Linked to Mobile
 * Number").
 *
 * Searches existing worker profiles by name or mobile number using the role-
 * scoped `GET /workers?q=` endpoint and lets the user pick the authoritative
 * patient record; the selected patient id is the submitted value. A manual
 * code/UUID entry remains available as a fallback when search is unavailable
 * (search requires connectivity).
 */
import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { api } from '@/src/api'
import { Button, Field, ChipPicker, StatusBadge } from '@/components/ui'

interface WorkerCandidate {
  id?: string
  patient_code?: string
  display_name?: string
  phone_e164?: string
}

interface WorkerLookupFieldProps {
  /** Patient id (UUID or code) that the linked form submits as `patient_id`. */
  value: string
  onChangeText: (patientId: string) => void
  token?: string
  disabled?: boolean
  error?: string
  required?: boolean
  /** Identity trail (pathology notes) — name/mobile as typed for comparison. */
  onIdentityChange?: (identity: { name: string; mobile: string }) => void
  workerLabel?: string
}

export function WorkerLookupField({
  value,
  onChangeText,
  token,
  disabled,
  error,
  required,
  onIdentityChange,
  workerLabel = 'Worker',
}: WorkerLookupFieldProps) {
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [manualCode, setManualCode] = useState(value)
  const [candidates, setCandidates] = useState<WorkerCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [notice, setNotice] = useState('')

  function updateIdentity(nextName: string, nextMobile: string) {
    setName(nextName)
    setMobile(nextMobile)
    onIdentityChange?.({ name: nextName, mobile: nextMobile })
  }

  async function findWorker() {
    const query = (mobile.trim() || name.trim()).trim()
    if (!query) {
      setCandidates([])
      setNotice('Enter a mobile number or name to search for the worker.')
      return
    }
    setSearching(true)
    setNotice('')
    try {
      const res = await api<{ items: WorkerCandidate[] }>(
        `/workers?q=${encodeURIComponent(query)}&limit=5`,
        token,
      )
      const items = (res?.items || []).filter((w) => w && (w.id || w.patient_code))
      setCandidates(items)
      setNotice(items.length ? '' : 'No matching worker found. Enter the code or UUID below.')
    } catch {
      setNotice('Worker search unavailable — enter the code or UUID below.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <View style={v.box}>
      <Text style={v.label}>
        {workerLabel} Name &amp; Mobile Number{required ? ' *' : ''}
      </Text>
      <Text style={v.hint}>Demographic details are linked to the selected worker record.</Text>
      <Field
        label={`${workerLabel} Name (check against record)`}
        placeholder="e.g. Ramesh Kumar"
        value={name}
        onChangeText={(t) => updateIdentity(t, mobile)}
        editable={!disabled}
      />
      <Field
        label={`${workerLabel} Mobile Number`}
        placeholder="e.g. 98XXXXXXXX"
        keyboardType="phone-pad"
        value={mobile}
        onChangeText={(t) => updateIdentity(name, t)}
        editable={!disabled}
      />
      <Button
        variant="outline"
        size="sm"
        loading={searching}
        disabled={disabled || searching || !token}
        onPress={findWorker}
      >
        Find {workerLabel}
      </Button>
      {candidates.length > 0 ? (
        <ChipPicker
          label="Search Results — tap to link the record"
          horizontal={false}
          options={candidates.map((candidate, index) => ({
            label: `${candidate.display_name || 'Worker'} · ${candidate.patient_code || ''} · ${(candidate.phone_e164 || '').slice(-6).padStart(6, '•')}`,
            value: String(candidate.id || index),
          }))}
          value={value}
          onChange={(selected) => {
            const mode = candidates.find((c) => String(c.id || '') === selected)
            const id = String(mode?.id ?? selected)
            setManualCode(id)
            onChangeText(id)
          }}
        />
      ) : null}
      {notice ? <Text style={v.notice}>{notice}</Text> : null}

      <Field
        label={`${workerLabel} Code / UUID (submitted value)`}
        placeholder="e.g. M3-6A817D7C or UUID"
        value={manualCode}
        onChangeText={(t) => {
          setManualCode(t)
          onChangeText(t.trim())
        }}
        editable={!disabled}
        error={error}
      />
      {value ? <StatusBadge label={`Linked record: ${value}`} variant="neutral" /> : null}
    </View>
  )
}

const v = StyleSheet.create({
  box: { gap: 10 },
  label: { fontSize: 13, fontWeight: '700', color: '#18181b' },
  hint: { fontSize: 12, color: '#71717a' },
  notice: { fontSize: 12, color: '#a16207' },
})
