import React, { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { api, ApiError } from '@/src/api'
import { useAppStore } from '@/src/store'
import { readWorkers, CachedWorker } from '@/src/cache'
import { t } from '@/src/i18n'
import {
  Button,
  Card,
  Field,
  FormShell,
  ChipPicker,
  NoticeBanner,
  StatusBadge,
  LoadingSpinner,
  EmptyState,
} from '@/components/ui'

interface Site {
  id: string
  site_id?: string
  code: string
  name: string
  district?: string
  area: string
  contractor_name?: string
  status: string
  worker_count?: number
  created_at?: string
}

interface WorkerRosterItem {
  id: string
  patient_code: string
  display_name?: string
  age_years?: number
  gender?: string
  occupation?: string
  start_date: string
  reported_malaria_status?: string
  reported_treatment_status?: string
  assignment_id: string
}

type ViewMode = 'list' | 'create' | 'detail'

export default function Sites() {
  const { language, session, online } = useAppStore()
  const tr = useCallback((k: Parameters<typeof t>[1]) => t(language, k), [language])

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Selected site for detail view
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [roster, setRoster] = useState<WorkerRosterItem[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

  // Create Site form state
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteDistrict, setNewSiteDistrict] = useState('North Goa')
  const [newSiteArea, setNewSiteArea] = useState('Panaji')
  const [newSiteCode, setNewSiteCode] = useState('')
  const [creatingSite, setCreatingSite] = useState(false)
  const [createError, setCreateError] = useState('')

  // Add Worker by QR state
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false)
  const [workerQrInput, setWorkerQrInput] = useState('')
  const [addingWorker, setAddingWorker] = useState(false)
  const [addWorkerSuccess, setAddWorkerSuccess] = useState('')
  const [cachedWorkers, setCachedWorkers] = useState<CachedWorker[]>([])

  // Contractor reported status modal state
  const [statusWorker, setStatusWorker] = useState<WorkerRosterItem | null>(null)
  const [reportedMalaria, setReportedMalaria] = useState<'not_reported' | 'pv' | 'pf' | 'pv_pf' | 'other' | 'none' | 'unknown'>('not_reported')
  const [reportedTreatment, setReportedTreatment] = useState<'not_reported' | 'treated' | 'untreated' | 'unknown'>('not_reported')
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusSuccess, setStatusSuccess] = useState('')

  const isContractor = session?.user?.roles?.includes('contractor')
  const canWrite = online && !session?.demo && isContractor

  // Load sites list
  const loadSites = useCallback(async () => {
    if (!session?.token || !online || session?.demo) {
      const demoSites: Site[] = [
        {
          id: 'demo-site-1',
          code: 'SYN-SITE-01',
          name: 'Synthetic Riverside Build',
          district: 'North Goa',
          area: 'Panaji',
          status: 'active',
          worker_count: 142,
        },
        {
          id: 'demo-site-2',
          code: 'SYN-SITE-02',
          name: 'Synthetic Zuari Industrial Expansion',
          district: 'South Goa',
          area: 'Mormugao',
          status: 'active',
          worker_count: 98,
        },
      ]
      setSites(demoSites)
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

  // Load site workers roster
  const loadRoster = useCallback(async (siteId: string) => {
    if (!session?.token || !online || session?.demo) {
      setRoster([
        {
          id: 'demo-w-1',
          patient_code: 'M3-DEMO-001',
          display_name: 'Demo Construction Worker',
          age_years: 32,
          gender: 'male',
          occupation: 'Mason',
          start_date: new Date().toISOString().slice(0, 10),
          reported_malaria_status: 'none',
          reported_treatment_status: 'not_reported',
          assignment_id: 'demo-assign-1',
        },
      ])
      return
    }

    setRosterLoading(true)
    try {
      const res = await api<{ items: WorkerRosterItem[]; total: number }>(`/sites/${siteId}/workers`, session.token)
      setRoster(res.items || [])
    } catch (e) {
      Alert.alert('Roster Load Error', e instanceof Error ? e.message : 'Failed to load site roster')
    } finally {
      setRosterLoading(false)
    }
  }, [session?.token, online, session?.demo])

  useEffect(() => {
    loadSites()
    try {
      if (session?.user?.id) {
        setCachedWorkers(readWorkers(session.user.id))
      }
    } catch {
      setCachedWorkers([])
    }
  }, [session?.token, online, session?.demo, session?.user?.id, loadSites])

  // Handle opening a site's detail
  function handleOpenSite(site: Site) {
    setSelectedSite(site)
    setViewMode('detail')
    setNotice('')
    loadRoster(site.id)
  }

  // Handle Create Site
  async function handleCreateSite() {
    if (!newSiteName.trim()) {
      setCreateError('Site Name is required')
      return
    }
    if (!newSiteDistrict.trim()) {
      setCreateError('District is required')
      return
    }
    if (!newSiteArea.trim()) {
      setCreateError('Area / Taluk is required')
      return
    }

    setCreatingSite(true)
    setCreateError('')
    const requestId = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    try {
      const payload: any = {
        name: newSiteName.trim(),
        district: newSiteDistrict.trim(),
        area: newSiteArea.trim(),
        client_request_id: requestId,
      }
      if (newSiteCode.trim()) {
        payload.code = newSiteCode.trim().toUpperCase()
      }

      const res = await api<Site>('/sites', session?.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      // Reset form
      setNewSiteName('')
      setNewSiteCode('')
      setNewSiteArea('Panaji')
      setNewSiteDistrict('North Goa')

      // Refresh sites list and navigate to new site
      await loadSites()
      setSelectedSite(res)
      setViewMode('detail')
      setNotice(`Site created successfully with permanent ID: ${res.id}`)
      loadRoster(res.id)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create site')
    } finally {
      setCreatingSite(false)
    }
  }

  // Helper to extract clean token from QR payload or raw string
  function parseQrToken(raw: string): string {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed.token) return String(parsed.token).trim()
      } catch {
        // Fall back to raw string
      }
    }
    return trimmed
  }

  // Handle Add Worker via QR or code
  async function handleAssignWorker(confirmTransfer = false, explicitRequestId?: string) {
    const cleanToken = parseQrToken(workerQrInput)
    if (!cleanToken) {
      Alert.alert('Worker Identifier Required', 'Please scan a QR code or enter a worker token or code.')
      return
    }
    if (!selectedSite) return

    setAddingWorker(true)
    setAddWorkerSuccess('')
    const requestId = explicitRequestId || `assign_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    try {
      const payload: any = {
        client_request_id: requestId,
        confirm_transfer: confirmTransfer,
      }

      // Check if input looks like an opaque QR token (e.g. urlsafe string >= 20 chars without hyphens)
      if (cleanToken.length >= 20 && !cleanToken.startsWith('M3-') && !cleanToken.startsWith('PAT-')) {
        payload.qr_token = cleanToken
      } else {
        payload.worker_id = cleanToken
      }

      const res = await api<any>(`/sites/${selectedSite.id}/workers`, session?.token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      if (res.already_assigned) {
        Alert.alert('Worker Already Assigned', `Worker is already an active member of ${selectedSite.name}.`)
      } else {
        setAddWorkerSuccess(`Worker ${res.worker?.patient_code || ''} assigned successfully!`)
        Alert.alert(
          'Worker Assigned',
          `Worker ${res.worker?.patient_code || ''} (${res.worker?.display_name || ''}) successfully assigned to ${selectedSite.name}.`
        )
      }

      setWorkerQrInput('')
      setShowAddWorkerModal(false)
      loadRoster(selectedSite.id)
      loadSites()
    } catch (e) {
      const err = e as ApiError
      if (err instanceof ApiError && err.status === 409 && err.detail?.requires_transfer_confirmation) {
        const d = err.detail
        Alert.alert(
          'Worker Assigned to Another Site',
          `This worker is currently assigned to ${d.current_site_name || 'another site'} (${d.current_site_code || ''}).\n\nTransfer this worker to ${selectedSite.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm Transfer',
              onPress: () => handleAssignWorker(true, requestId),
            },
          ]
        )
      } else {
        Alert.alert(tr('error'), e instanceof Error ? e.message : tr('error'))
      }
    } finally {
      setAddingWorker(false)
    }
  }

  // Handle Reported Status submission with optimistic concurrency guard
  async function handleSaveStatus() {
    if (!statusWorker || !selectedSite) return
    setSavingStatus(true)
    setStatusSuccess('')

    const doSubmit = async (baseUpdatedAt?: string) => {
      await api(`/workers/${statusWorker.id}/reported-status`, session?.token, {
        method: 'PUT',
        body: JSON.stringify({
          malaria_status: reportedMalaria,
          treatment_status: reportedTreatment,
          base_updated_at: baseUpdatedAt,
        }),
      })
    }

    try {
      // Fetch latest version for optimistic concurrency
      let baseUpdatedAt: string | undefined
      try {
        const fresh = await api<{ updated_at?: string }>(`/workers/${statusWorker.id}`, session?.token)
        baseUpdatedAt = fresh?.updated_at
      } catch {
        baseUpdatedAt = undefined
      }

      await doSubmit(baseUpdatedAt)
      setStatusSuccess('Reported health status recorded successfully.')
      Alert.alert('Status Updated', 'Reported malaria & treatment status recorded.')
      setStatusWorker(null)
      loadRoster(selectedSite.id)
    } catch (e) {
      const err = e as ApiError
      if (err instanceof ApiError && err.status === 409 && err.detail?.current_updated_at) {
        Alert.alert(
          'Record Changed Elsewhere',
          `This worker's reported status was updated at ${String(err.detail.current_updated_at).replace('T', ' ').slice(0, 19)}.\n\nReload and apply your update?`,
          [
            { text: 'Keep server version', style: 'cancel' },
            {
              text: 'Load & retry',
              onPress: async () => {
                setSavingStatus(true)
                try {
                  await doSubmit(err.detail.current_updated_at)
                  setStatusWorker(null)
                  loadRoster(selectedSite.id)
                } catch (retryErr) {
                  Alert.alert(tr('error'), retryErr instanceof Error ? retryErr.message : tr('error'))
                } finally {
                  setSavingStatus(false)
                }
              },
            },
          ]
        )
      } else {
        Alert.alert(tr('error'), e instanceof Error ? e.message : tr('error'))
      }
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <FormShell contentContainerStyle={s.container}>
      {/* HEADER SECTION */}
      <View style={s.header}>
        <Text style={s.eyebrow}>CONSTRUCTION MONITORING</Text>
        <Text style={s.title}>{tr('sites')}</Text>
      </View>

      <NoticeBanner
        type="info"
        title="Contractor Site Scoping"
        message="Contractor users manage authorized construction sites, assign workers by QR code, and maintain operational rosters. Health Worker and Admin views remain strictly read-only."
      />

      {notice ? (
        <NoticeBanner type="info" title="Success" message={notice} />
      ) : null}

      {!online && (
        <NoticeBanner
          type="offline"
          title={tr('offline')}
          message="Displaying cached site records. Connect to LAN to create sites or assign workers."
        />
      )}

      {/* VIEW 1: SITES LIST */}
      {viewMode === 'list' && (
        <View style={{ gap: 14 }}>
          {isContractor && (
            <View style={s.topActionBar}>
              <Button
                variant="primary"
                size="md"
                disabled={!canWrite}
                onPress={() => {
                  setCreateError('')
                  setViewMode('create')
                }}
              >
                + Create Site
              </Button>
            </View>
          )}

          {loading ? (
            <LoadingSpinner message="Loading authorized construction sites..." />
          ) : error ? (
            <NoticeBanner type="error" title="Error" message={error} />
          ) : sites.length === 0 ? (
            <EmptyState
              title="No Construction Sites Found"
              message="No active sites are assigned to your organization. Tap Create Site above to set up your first construction site."
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
                    <Text style={s.siteArea}>
                      {site.district ? `${site.district} · ` : ''}{site.area}
                    </Text>
                    <Text style={s.siteWorkers}>
                      {site.worker_count !== undefined ? `${site.worker_count} active workers` : 'Operational'}
                    </Text>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => handleOpenSite(site)}
                    >
                      Manage Site & Workers →
                    </Button>
                  </View>
                </Card>
              ))}
            </View>
          )}

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
      )}

      {/* VIEW 2: CREATE SITE */}
      {viewMode === 'create' && (
        <Card title="Create Construction Site" subtitle="Create site with a permanent unique ID">
          {createError ? (
            <NoticeBanner type="error" title="Creation Failed" message={createError} />
          ) : null}

          <Field
            label="Site Name"
            placeholder="e.g. Mandovi Riverfront Expansion"
            value={newSiteName}
            onChangeText={setNewSiteName}
            required
          />

          <Field
            label="District"
            placeholder="e.g. North Goa"
            value={newSiteDistrict}
            onChangeText={setNewSiteDistrict}
            required
          />

          <Field
            label="Area / Taluk"
            placeholder="e.g. Panaji"
            value={newSiteArea}
            onChangeText={setNewSiteArea}
            required
          />

          <Field
            label="Site Code (Optional)"
            placeholder="e.g. SITE-MND-01 (leave blank to auto-generate)"
            value={newSiteCode}
            onChangeText={setNewSiteCode}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              variant="outline"
              size="md"
              style={{ flex: 1 }}
              disabled={creatingSite}
              onPress={() => setViewMode('list')}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              style={{ flex: 1 }}
              loading={creatingSite}
              disabled={!canWrite || creatingSite || !newSiteName.trim()}
              onPress={handleCreateSite}
            >
              Create Site
            </Button>
          </View>
        </Card>
      )}

      {/* VIEW 3: SITE DETAIL & WORKER ROSTER */}
      {viewMode === 'detail' && selectedSite && (
        <View style={{ gap: 14 }}>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setViewMode('list')
              loadSites()
            }}
          >
            ← Back to All Sites
          </Button>

          {/* SITE SUMMARY CARD */}
          <Card style={s.siteDetailCard}>
            <View style={s.siteCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.siteCode}>{selectedSite.code}</Text>
                <Text style={s.siteTitleLarge}>{selectedSite.name}</Text>
              </View>
              <StatusBadge
                label={selectedSite.status.toUpperCase()}
                variant={selectedSite.status === 'active' ? 'success' : 'neutral'}
              />
            </View>

            <View style={s.detailInfoGrid}>
              <View style={s.detailInfoItem}>
                <Text style={s.detailLabel}>District</Text>
                <Text style={s.detailValue}>{selectedSite.district || 'Unspecified'}</Text>
              </View>
              <View style={s.detailInfoItem}>
                <Text style={s.detailLabel}>Area / Taluk</Text>
                <Text style={s.detailValue}>{selectedSite.area}</Text>
              </View>
              <View style={s.detailInfoItem}>
                <Text style={s.detailLabel}>Permanent Site ID</Text>
                <Text style={[s.detailValue, { fontSize: 11 }]} numberOfLines={1}>
                  {selectedSite.id}
                </Text>
              </View>
              <View style={s.detailInfoItem}>
                <Text style={s.detailLabel}>Active Workers</Text>
                <Text style={[s.detailValue, { fontWeight: '700', color: '#166534' }]}>
                  {roster.length}
                </Text>
              </View>
            </View>
          </Card>

          {/* ROSTER HEADER & ACTION BAR */}
          <View style={s.rosterHeaderBar}>
            <View>
              <Text style={s.sectionTitle}>Operational Worker Roster</Text>
              <Text style={s.sectionSubtitle}>
                {roster.length} {roster.length === 1 ? 'worker' : 'workers'} assigned
              </Text>
            </View>
            {isContractor && (
              <Button
                variant="primary"
                size="sm"
                disabled={!canWrite}
                onPress={() => {
                  setWorkerQrInput('')
                  setAddWorkerSuccess('')
                  setShowAddWorkerModal(true)
                }}
              >
                + Add Worker
              </Button>
            )}
          </View>

          {/* ROSTER LIST */}
          {rosterLoading ? (
            <LoadingSpinner message="Loading worker roster..." />
          ) : roster.length === 0 ? (
            <EmptyState
              title="No Workers Assigned"
              message="No workers are currently assigned to this site. Tap 'Add Worker' to scan a worker's QR pass and assign them."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {roster.map((w) => (
                <Card key={w.assignment_id} style={s.workerCard}>
                  <View style={s.siteCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.workerCode}>{w.patient_code}</Text>
                      <Text style={s.workerName}>{w.display_name || 'Worker'}</Text>
                    </View>
                    <StatusBadge
                      label={`ASSIGNED ${w.start_date || ''}`}
                      variant="success"
                    />
                  </View>

                  <View style={s.workerDemographics}>
                    {w.age_years ? <Text style={s.workerTag}>{w.age_years} yrs</Text> : null}
                    {w.gender ? <Text style={s.workerTag}>{w.gender}</Text> : null}
                    {w.occupation ? <Text style={s.workerTag}>{w.occupation}</Text> : null}
                  </View>

                  <View style={s.workerStatusRow}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Text style={s.statusTagLabel}>Malaria:</Text>
                      <StatusBadge
                        label={(w.reported_malaria_status || 'not_reported').toUpperCase()}
                        variant={w.reported_malaria_status === 'none' ? 'neutral' : w.reported_malaria_status === 'not_reported' ? 'neutral' : 'warning'}
                      />
                      <Text style={s.statusTagLabel}>Treatment:</Text>
                      <StatusBadge
                        label={(w.reported_treatment_status || 'not_reported').toUpperCase()}
                        variant={w.reported_treatment_status === 'treated' ? 'success' : 'neutral'}
                      />
                    </View>

                    {isContractor && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setStatusWorker(w)
                          setReportedMalaria((w.reported_malaria_status as any) || 'not_reported')
                          setReportedTreatment((w.reported_treatment_status as any) || 'not_reported')
                        }}
                      >
                        Update Status
                      </Button>
                    )}
                  </View>
                </Card>
              ))}
            </View>
          )}

          <Button
            variant="secondary"
            size="md"
            loading={rosterLoading}
            disabled={rosterLoading}
            onPress={() => loadRoster(selectedSite.id)}
          >
            {tr('refresh')} Roster
          </Button>
        </View>
      )}

      {/* MODAL 1: ADD WORKER BY QR OR CODE */}
      <Modal
        visible={showAddWorkerModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAddWorkerModal(false)}
      >
        <FormShell contentContainerStyle={s.modalContainer}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>SITE WORKER ASSIGNMENT</Text>
              <Text style={s.title}>Add Worker to Site</Text>
              <Text style={s.modalSub}>
                Assigning to: {selectedSite?.name} ({selectedSite?.code})
              </Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setShowAddWorkerModal(false)}
            >
              Close
            </Button>
          </View>

          {addWorkerSuccess ? (
            <NoticeBanner type="info" title="Assigned" message={addWorkerSuccess} />
          ) : null}

          <Card title="Scan or Enter Worker QR Token">
            <Field
              label="Worker QR Token or Patient Code"
              placeholder="Paste scanned QR payload or enter token/code"
              value={workerQrInput}
              onChangeText={setWorkerQrInput}
              required
            />

            <Text style={s.helperText}>
              Workers display their unique QR code from the &quot;My QR Code&quot; card in their M3 app.
              Scanning or pasting the QR payload will automatically resolve and assign the worker.
            </Text>

            <View style={{ marginTop: 12 }}>
              <Button
                variant="primary"
                size="md"
                loading={addingWorker}
                disabled={addingWorker || !workerQrInput.trim()}
                onPress={() => handleAssignWorker(false)}
              >
                Assign Worker
              </Button>
            </View>
          </Card>

          {/* Quick-Pick helper from cached workers for testing/demo */}
          {cachedWorkers.length > 0 && (
            <Card title="Quick Pick from Cached Workers" subtitle="Convenience helper for field demo & testing">
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {cachedWorkers.map((cw) => (
                  <View key={cw.id} style={s.quickPickRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.workerCode}>{cw.patient_code}</Text>
                      <Text style={s.workerName}>{cw.display_name || 'Worker'}</Text>
                    </View>
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => setWorkerQrInput(cw.patient_code)}
                    >
                      Select
                    </Button>
                  </View>
                ))}
              </ScrollView>
            </Card>
          )}
        </FormShell>
      </Modal>

      {/* MODAL 2: UPDATE REPORTED HEALTH STATUS */}
      <Modal
        visible={Boolean(statusWorker)}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setStatusWorker(null)}
      >
        <FormShell contentContainerStyle={s.modalContainer}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>OPERATIONAL HEALTH CHECK</Text>
              <Text style={s.title}>Reported Status</Text>
              <Text style={s.modalSub}>
                Worker: {statusWorker?.patient_code} ({statusWorker?.display_name || 'Worker'})
              </Text>
            </View>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setStatusWorker(null)}
            >
              Close
            </Button>
          </View>

          {statusSuccess ? (
            <NoticeBanner type="info" title="Saved" message={statusSuccess} />
          ) : null}

          <Card title="Record Health Status">
            <ChipPicker
              label="Reported Malaria Status"
              options={[
                { label: 'Not Reported', value: 'not_reported' },
                { label: 'None', value: 'none' },
                { label: 'P. vivax (Pv)', value: 'pv' },
                { label: 'P. falciparum (Pf)', value: 'pf' },
                { label: 'Mixed (Pv + Pf)', value: 'pv_pf' },
                { label: 'Other', value: 'other' },
                { label: 'Unknown', value: 'unknown' },
              ]}
              value={reportedMalaria}
              onChange={(v) => setReportedMalaria(v as any)}
            />

            <ChipPicker
              label="Reported Treatment Status"
              options={[
                { label: 'Not Reported', value: 'not_reported' },
                { label: 'Treated', value: 'treated' },
                { label: 'Untreated', value: 'untreated' },
                { label: 'Unknown', value: 'unknown' },
              ]}
              value={reportedTreatment}
              onChange={(v) => setReportedTreatment(v as any)}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Button
                variant="outline"
                size="md"
                style={{ flex: 1 }}
                disabled={savingStatus}
                onPress={() => setStatusWorker(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                loading={savingStatus}
                disabled={savingStatus}
                onPress={handleSaveStatus}
              >
                Save Status
              </Button>
            </View>
          </Card>
        </FormShell>
      </Modal>
    </FormShell>
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
  modalContainer: {
    padding: 18,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
    backgroundColor: '#f4f4f5',
  },
  header: {
    gap: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalSub: {
    fontSize: 13,
    color: '#52525b',
    marginTop: 2,
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
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  sitesList: {
    gap: 10,
  },
  siteCard: {
    gap: 8,
    padding: 16,
  },
  siteDetailCard: {
    gap: 12,
    padding: 18,
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
  siteTitleLarge: {
    fontSize: 22,
    fontWeight: '800',
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
  detailInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
  },
  detailInfoItem: {
    width: '46%',
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    color: '#18181b',
    fontWeight: '500',
  },
  rosterHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181b',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#71717a',
  },
  workerCard: {
    gap: 8,
    padding: 14,
  },
  workerCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717a',
  },
  workerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181b',
  },
  workerDemographics: {
    flexDirection: 'row',
    gap: 8,
  },
  workerTag: {
    fontSize: 12,
    color: '#52525b',
    backgroundColor: '#f4f4f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  workerStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f4f4f5',
  },
  statusTagLabel: {
    fontSize: 11,
    color: '#71717a',
  },
  helperText: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 6,
    lineHeight: 18,
  },
  quickPickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
})
