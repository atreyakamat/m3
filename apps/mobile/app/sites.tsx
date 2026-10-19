import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { api } from '@/src/api'
import { useAppStore } from '@/src/store'
import { t } from '@/src/i18n'
import {
  Button,
  Card,
  NoticeBanner,
  StatusBadge,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui'

interface Site {
  id: string
  code: string
  name: string
  area: string
  status: string
  worker_count?: number
}

export default function Sites() {
  const { language, session, online } = useAppStore()
  const tr = (k: Parameters<typeof t>[1]) => t(language, k)

  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSites = useCallback(async () => {
    if (!session?.token || !online || session?.demo) {
      setSites([
        {
          id: 'demo-site-1',
          code: 'SYN-SITE-01',
          name: 'Synthetic Riverside Build',
          area: 'Panaji',
          status: 'active',
          worker_count: 142,
        },
        {
          id: 'demo-site-2',
          code: 'SYN-SITE-02',
          name: 'Synthetic Zuari Industrial Expansion',
          area: 'Mormugao',
          status: 'active',
          worker_count: 98,
        },
      ])
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await api<{ items: Site[] }>('/sites', session.token)
      setSites(res.items || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('error'))
    } finally {
      setLoading(false)
    }
  }, [session?.token, online, session?.demo, tr])

  useEffect(() => {
    loadSites()
  }, [loadSites])

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={s.header}>
        <Text style={s.eyebrow}>CONSTRUCTION MONITORING</Text>
        <Text style={s.title}>{tr('sites')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title="Access Restriction Notice"
        message="Contractor users receive operational site rosters and aggregate workforce metrics only; personal clinical notes and research assays are restricted by role."
      />

      {!online && (
        <NoticeBanner
          type="offline"
          title={tr('offline')}
          message="Displaying cached site records. Connect to LAN to view live construction metrics."
        />
      )}

      {loading ? (
        <LoadingSpinner message="Loading authorized construction sites..." />
      ) : error ? (
        <NoticeBanner type="error" title="Error" message={error} />
      ) : sites.length === 0 ? (
        <EmptyState
          title="No Construction Sites Found"
          message="No active sites are assigned to your organization."
        />
      ) : (
        <View style={s.sitesList}>
          {sites.map((site) => (
            <Card key={site.id} style={s.siteCard}>
              <View style={s.siteCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.siteCode}>{site.code}</Text>
                  <Text style={s.siteName}>{site.name}</Text>
                </View>
                <StatusBadge
                  label={site.status.toUpperCase()}
                  variant={site.status === 'active' ? 'success' : 'neutral'}
                />
              </View>

              <View style={s.siteMetaRow}>
                <Text style={s.siteArea}>Location: {site.area}</Text>
                {site.worker_count !== undefined && (
                  <Text style={s.siteWorkers}>
                    {site.worker_count} active workers
                  </Text>
                )}
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={s.actions}>
        <Button
          variant="secondary"
          size="md"
          loading={loading}
          disabled={!online || session?.demo || loading}
          onPress={loadSites}
        >
          {tr('refresh')}
        </Button>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
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
  sitesList: {
    gap: 10,
  },
  siteCard: {
    gap: 8,
    padding: 16,
  },
  siteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  siteCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
  },
  siteName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#18181b',
    marginTop: 2,
  },
  siteMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
    paddingTop: 8,
    marginTop: 4,
  },
  siteArea: {
    fontSize: 13,
    color: '#52525b',
  },
  siteWorkers: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181b',
  },
  actions: {
    marginTop: 8,
  },
})
