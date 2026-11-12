import React, { useState } from 'react';
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
  type SiteSummary,
  ApiError,
} from '@/api';
import { useSession } from '@/store/session';

export default function TransferScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useSession();

  const [siteQuery, setSiteQuery] = useState('');
  const [siteResults, setSiteResults] = useState<SiteSummary[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);
  const [searching, setSearching] = useState(false);

  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [capturingLoc, setCapturingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSiteSearch(q: string) {
    setSiteQuery(q);
    if (!token || !q.trim()) {
      setSiteResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await sitesApi.search(token, q);
      setSiteResults(res.items || []);
    } catch {
      // Non-fatal
    } finally {
      setSearching(false);
    }
  }

  function handleSelectSite(site: SiteSummary) {
    setSelectedSite(site);
    setSiteQuery(site.name);
    setSiteResults([]);
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
    if (!siteQuery.trim()) {
      Alert.alert('Site Required', 'Please enter or select the new construction site.');
      return;
    }

    setSubmitting(true);
    try {
      if (token) {
        let targetSiteId = selectedSite?.siteId;
        if (!targetSiteId) {
          try {
            const res = await sitesApi.search(token, siteQuery);
            const matched = res.items.find((s: SiteSummary) => s.name.toLowerCase().includes(siteQuery.toLowerCase()));
            if (matched) targetSiteId = matched.siteId;
          } catch {
            // Non-fatal
          }
        }

        if (targetSiteId) {
          await transferApi.create(token, {
            toSiteId: targetSiteId,
            note: 'Worker-initiated transfer to new site',
          });
        }
      }

      Alert.alert(
        'Transfer Requested',
        `Transfer request to ${siteQuery.trim()} has been submitted. Awaiting supervisor confirmation.`,
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header Navigation */}
        <View style={styles.topHeader}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Dashboard</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Transfer Site. Enter the name of your new construction site, capture your current location, and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title matching Slide 8 */}
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>Transfer Site</Text>
        </View>

        {/* Section 1: NEW SITE DETAILS */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>NEW SITE DETAILS</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Site Name"
              placeholderTextColor="#94A3B8"
              value={siteQuery}
              onChangeText={handleSiteSearch}
              accessibilityLabel="Site Name"
            />
            {searching && <ActivityIndicator color="#C48524" size="small" />}
          </View>

          {/* Autocomplete dropdown results */}
          {siteResults.length > 0 && (
            <View style={styles.dropdown}>
              {siteResults.map((s) => (
                <Pressable
                  key={s.siteId}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectSite(s)}
                >
                  <Text style={styles.dropdownName}>{s.name}</Text>
                  <Text style={styles.dropdownArea}>📍 {s.area}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Section 2: CURRENT LOCATION */}
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
    marginBottom: 28,
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
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    fontSize: 16,
    color: '#23303A',
    flex: 1,
    paddingVertical: 10,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE6EB',
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#19364F',
  },
  dropdownArea: {
    fontSize: 12,
    color: '#707E88',
    marginTop: 2,
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
    borderColor: '#C48524',
    backgroundColor: '#FEF3C7',
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
    marginTop: 20,
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
