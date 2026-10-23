import React, { useEffect, useState, useCallback } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { api } from '@/src/api'
import { t } from '@/src/i18n'
import { useAppStore } from '@/src/store'
import {
  Card,
  StatusBadge,
  NoticeBanner,
  LoadingSpinner,
  EmptyState,
  colors,
} from '@/components/ui'
import { DemoBanner } from '@/components/DemoBanner'
import { demoResearchAggregates } from '@/src/demoData'

interface ResearchResult {
  id: string
  sample_id: string
  pcr_status: string
  species_confirmation?: string | null
  parasite_density?: number | null
  parasite_density_unit?: string | null
  gametocyte_presence: string
  pfhrp2_status: string
  pfhrp3_status: string
}

export default function Research() {
  const { language, session, online } = useAppStore()
  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])

  const [results, setResults] = useState<ResearchResult[] | null>(null)
  const [error, setError] = useState('')

  const isDemo = Boolean(session?.demo)

  const load = useCallback(async () => {
    if (session?.demo) {
      // Deterministic synthetic aggregate dataset — no identifiers beyond
      // opaque M3-RES-SYN sample codes, and zero network activity.
      setResults(demoResearchAggregates())
      setError('')
      return
    }
    if (!session?.token || !online) {
      setError('')
      setResults([])
      return
    }
    try {
      const res = await api<{ items: ResearchResult[] }>('/research-results', session.token)
      setResults(res.items || [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('error'))
    }
  }, [session?.token, online, session?.demo, tr])

  useEffect(() => {
    load()
  }, [session?.token, online, session?.demo, load])

  const statusVariant = (status: string): 'success' | 'neutral' | 'warning' => {
    if (status === 'detected' || status === 'positive') return 'success'
    if (status === 'not_detected') return 'neutral'
    if (status === 'inconclusive') return 'warning'
    return 'neutral'
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.header}>
        <Text style={s.eyebrow}>RESEARCH LABORATORY · READ-ONLY</Text>
        <Text style={s.title}>{tr('research')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title="Read-only throughout the initial release"
        message="Research Lab accounts have no create, edit or delete capability in the initial release (PRD sections 3 and 9). Results are de-identified and linked to opaque Worker IDs and sample codes only."
      />

      {!online && (
        <NoticeBanner
          type="offline"
          title={tr('offline')}
          message="Connect to the LAN API to view the approved molecular dataset."
        />
      )}

      {isDemo && (
        <DemoBanner detail="Read-only SYNTHETIC aggregate dataset: each example carries an opaque M3-RES-SYN sample code only — no real worker identifiers exist in this screen." />
      )}

      {error ? <NoticeBanner type="error" title="Error" message={error} /> : null}

      {results === null ? (
        <LoadingSpinner message="Loading approved molecular dataset..." />
      ) : results.length === 0 ? (
        <EmptyState
          title={tr('noRecords')}
          message="No molecular research results are available in the approved scope yet."
        />
      ) : (
        results.map((result) => (
          <Card key={result.id} title={`Sample ${result.sample_id.slice(0, 8)}`}>
            <View style={s.rowBetween}>
              <StatusBadge label={result.pcr_status.toUpperCase()} variant={statusVariant(result.pcr_status)} />
              <Text style={s.metaText}>PCR</Text>
            </View>
            <View style={s.statusRow}>
              <Text style={s.labelText}>Species confirmation</Text>
              <Text style={s.valueText}>{result.species_confirmation || 'not recorded'}</Text>
            </View>
            <View style={s.statusRow}>
              <Text style={s.labelText}>Parasite density</Text>
              <Text style={s.valueText}>
                {result.parasite_density != null ? `${result.parasite_density} ${result.parasite_density_unit || 'parasites/µL'}` : 'not recorded'}
              </Text>
            </View>
            <View style={s.statusRow}>
              <Text style={s.labelText}>Gametocytes</Text>
              <Text style={s.valueText}>{result.gametocyte_presence}</Text>
            </View>
            <View style={s.statusRow}>
              <Text style={s.labelText}>pfhrp2 / pfhrp3</Text>
              <Text style={s.valueText}>{result.pfhrp2_status} / {result.pfhrp3_status}</Text>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labelText: {
    fontSize: 13,
    color: '#71717a',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181b',
  },
  metaText: {
    fontSize: 11,
    letterSpacing: 0.8,
    fontWeight: '700',
    color: '#71717a',
  },
})
