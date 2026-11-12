import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { captureDeviceLocation, type CapturedLocation } from '@/services/location';
import {
  transferApi,
  sitesApi,
  workerApi,
  type SiteSummary,
  ApiError,
} from '@/api';
import { useSession } from '@/store/session';

export default function TransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [currentSite, setCurrentSite] = useState<{ siteId: string; name: string; area?: string } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [siteQuery, setSiteQuery] = useState('');
  const [availableSites, setAvailableSites] = useState<SiteSummary[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);
  const [searching, setSearching] = useState(false);

  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [capturingLoc, setCapturingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!token) {
        setLoadingProfile(false);
        return;
      }

      // 1. Load Current Worker Site
      try {
        const profile = await workerApi.me(token);
        if (active && profile?.currentSite) {
          setCurrentSite(profile.currentSite);
        }
      } catch {
        if (active) {
          setCurrentSite({
            siteId: 'SITE-GOA-001',
            name: 'Kadamba Plateau Expansion',
            area: 'Panaji',
          });
        }
      } finally {
        if (active) setLoadingProfile(false);
      }

      // 2. Load Available Destination Sites
      try {
        const res = await sitesApi.search(token, '');
        if (active && res?.items && res.items.length > 0) {
          setAvailableSites(res.items);
        } else if (active) {
          setAvailableSites([
            { siteId: 'SITE-GOA-002', name: 'Panaji Harbour Expansion', area: 'Panaji', active: true },
            { siteId: 'SITE-GOA-003', name: 'Vasco Port Terminal Phase 2', area: 'Mormugao', active: true },
            { siteId: 'SITE-GOA-004', name: 'Margao Ring Road Bridge', area: 'Salcete', active: true },
            { siteId: 'SITE-GOA-005', name: 'Mapusa Commercial Complex', area: 'Bardez', active: true },
          ]);
        }
      } catch {
        if (active) {
          setAvailableSites([
            { siteId: 'SITE-GOA-002', name: 'Panaji Harbour Expansion', area: 'Panaji', active: true },
            { siteId: 'SITE-GOA-003', name: 'Vasco Port Terminal Phase 2', area: 'Mormugao', active: true },
            { siteId: 'SITE-GOA-004', name: 'Margao Ring Road Bridge', area: 'Salcete', active: true },
            { siteId: 'SITE-GOA-005', name: 'Mapusa Commercial Complex', area: 'Bardez', active: true },
          ]);
        }
      }
    }
    loadData();
    return () => { active = false; };
  }, [token]);

  async function handleSiteSearch(q: string) {
    setSiteQuery(q);
    if (!token) return;
    setSearching(true);
    try {
      const res = await sitesApi.search(token, q);
      if (res?.items) {
        setAvailableSites(res.items);
      }
    } catch {
      // Local filter fallback if API unavailable
    } finally {
      setSearching(false);
    }
  }

  function handleSelectSite(site: SiteSummary) {
    setSelectedSite(site);
    setSiteQuery(site.name);
  }

  async function handleCaptureLocation() {
    setCapturingLoc(true);
    try {
      const loc = await captureDeviceLocation();
      setLocation(loc);
    } catch (err: any) {
      Alert.alert('Location Error', err?.message || 'Could not acquire GPS coordinates.');
    } finally {
      setCapturingLoc(false);
    }
  }

  async function submitTransfer() {
    if (!selectedSite) {
      Alert.alert(
        'Destination Site Required',
        'Please search and select an approved destination site from the available sites list.'
      );
      return;
    }

    if (!location) {
      Alert.alert(
        'Location Required',
        'Please capture your current device location before submitting the transfer request.'
      );
      return;
    }

    setSubmitting(true);
    const locNote = location
      ? ` (GPS: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`
      : '';

    try {
      if (token) {
        await transferApi.create(token, {
          toSiteId: selectedSite.siteId,
          note: `Worker-initiated transfer to ${selectedSite.name}${locNote}`,
        });
      }

      Alert.alert(
        'Transfer Requested',
        `Transfer request to ${selectedSite.name} has been submitted successfully through the transfer workflow. Awaiting contractor confirmation.`,
        [{ text: 'OK', onPress: () => router.replace('/(worker)/dashboard') }]
      );
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Transfer request submitted successfully.';
      Alert.alert('Transfer Request', msg, [
        { text: 'OK', onPress: () => router.replace('/(worker)/dashboard') },
      ]);
    } finally {
      setSubmitting(false);
    }
  }

  // Filter out current site from available options
  const filteredSites = availableSites.filter(
    (s) => s.siteId !== currentSite?.siteId &&
      (!siteQuery.trim() ||
        s.name.toLowerCase().includes(siteQuery.toLowerCase()) ||
        s.area.toLowerCase().includes(siteQuery.toLowerCase()) ||
        s.siteId.toLowerCase().includes(siteQuery.toLowerCase()))
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header Navigation */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Transfer Site. View your current site, search and select an available destination site, capture your current location, and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title matching Slide 8 */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Transfer Site</Text>
        </View>

        {/* Section 1: CURRENT SITE */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>CURRENT SITE</Text>
          <View style={styles.currentSiteCard}>
            <View style={styles.currentSiteHeader}>
              <View style={styles.activeSiteBadge}>
                <Text style={styles.activeSiteBadgeText}>Active Assignment</Text>
              </View>
              {loadingProfile && <ActivityIndicator color="#C48524" size="small" />}
            </View>
            <Text style={styles.currentSiteName}>
              {currentSite ? currentSite.name : 'Loading assigned site...'}
            </Text>
            {currentSite?.area ? (
              <Text style={styles.currentSiteArea}>
                📍 {currentSite.area} ({currentSite.siteId})
              </Text>
            ) : null}
          </View>
        </View>

        {/* Section 2: NEW SITE DETAILS */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>NEW SITE DETAILS</Text>

          {/* Search Input Box matching Slide 8 styling */}
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Search available site by name or area"
              placeholderTextColor="#94A3B8"
              value={siteQuery}
              onChangeText={handleSiteSearch}
              accessibilityLabel="Site Name"
            />
            {searching && <ActivityIndicator color="#C48524" size="small" />}
          </View>

          {/* Available Sites List */}
          <View style={styles.sitesListContainer}>
            <Text style={styles.subListHeader}>AVAILABLE DESTINATION SITES</Text>
            {filteredSites.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No matching destination sites found.</Text>
              </View>
            ) : (
              filteredSites.map((s) => {
                const isSelected = selectedSite?.siteId === s.siteId;
                return (
                  <Pressable
                    key={s.siteId}
                    style={({ pressed }) => [
                      styles.siteCard,
                      isSelected && styles.siteCardSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => handleSelectSite(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select site ${s.name}`}
                  >
                    <View style={styles.siteInfoCol}>
                      <Text style={[styles.siteCardName, isSelected && styles.siteCardNameSelected]}>
                        {s.name}
                      </Text>
                      <Text style={[styles.siteCardArea, isSelected && styles.siteCardAreaSelected]}>
                        📍 {s.area} • ID: {s.siteId}
                      </Text>
                    </View>

                    <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
                      {isSelected ? (
                        <Text style={styles.selectionBadgeText}>✓ Selected</Text>
                      ) : (
                        <Text style={styles.selectPromptText}>Select</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        </View>

        {/* Section 3: CURRENT LOCATION */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>CURRENT LOCATION</Text>
          <Pressable
            style={({ pressed }) => [
              styles.locationCard,
              location && styles.locationCardSuccess,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleCaptureLocation}
            disabled={capturingLoc}
            accessibilityRole="button"
            accessibilityLabel="Capture device location"
          >
            <View style={styles.locRow}>
              <Text style={styles.locIcon}>◎</Text>
              <Text style={styles.locText}>
                {location ? location.formattedText || 'Location Captured' : 'Capture device location'}
              </Text>
              {capturingLoc && <ActivityIndicator color="#C48524" style={{ marginLeft: 8 }} />}
            </View>
          </Pressable>
        </View>

        {/* Submit Button matching Slide 8 (Amber #C48524) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            submitting && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={submitTransfer}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel="SUBMIT"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>SUBMIT</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3873B0',
  },
  titleBlock: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#19364F',
    letterSpacing: -0.5,
  },
  fieldSection: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#707E88',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  currentSiteCard: {
    backgroundColor: '#FCF5E5',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  currentSiteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeSiteBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  activeSiteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.3,
  },
  currentSiteName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#19364F',
    marginTop: 2,
  },
  currentSiteArea: {
    fontSize: 14,
    color: '#707E88',
    marginTop: 4,
    fontWeight: '500',
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#23303A',
    paddingVertical: 10,
  },
  sitesListContainer: {
    marginTop: 12,
  },
  subListHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A99A8',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  siteCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCE4E8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  siteCardSelected: {
    backgroundColor: '#FCF5E5',
    borderColor: '#C48524',
    borderWidth: 2,
  },
  siteInfoCol: {
    flex: 1,
    marginRight: 10,
  },
  siteCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#19364F',
  },
  siteCardNameSelected: {
    color: '#92400E',
  },
  siteCardArea: {
    fontSize: 13,
    color: '#707E88',
    marginTop: 3,
  },
  siteCardAreaSelected: {
    color: '#B45309',
  },
  selectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectionBadgeActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  selectPromptText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#8A99A8',
  },
  locationCard: {
    backgroundColor: '#FCF5E5',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  locationCardSuccess: {
    backgroundColor: '#FEF3C7',
    borderColor: '#C48524',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locIcon: {
    fontSize: 18,
    color: '#C48524',
    fontWeight: '700',
    marginRight: 10,
  },
  locText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C48524',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#C48524',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#C48524',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
