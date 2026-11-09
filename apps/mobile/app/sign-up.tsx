import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { workerRegisterSchema, type Language } from '@m3/shared';
import { Screen, Card, TextField, Button, SelectRow } from '@/components/ui';
import { DatePickerField } from '@/components/DatePickerField';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { authApi, workerApi, sitesApi, ApiError, type SiteSummary } from '@/api';
import { useSession } from '@/store/session';
import { screeningLocalRepo } from '@/services/screeningLocal';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

// Default representative active Goa construction sites fallback if offline
const DEFAULT_GOA_SITES: SiteSummary[] = [
  { siteId: 'SITE-GOA-001', name: 'Candolim Beach Resort Project', area: 'Candolim, North Goa', active: true },
  { siteId: 'SITE-GOA-002', name: 'Panaji Smart City Infrastructure Hub', area: 'Panaji, North Goa', active: true },
  { siteId: 'SITE-GOA-003', name: 'Margao Commercial Complex Expansion', area: 'Margao, South Goa', active: true },
  { siteId: 'SITE-GOA-004', name: 'Vasco Port Logistics Terminal', area: 'Vasco da Gama, South Goa', active: true },
  { siteId: 'SITE-GOA-005', name: 'Mapusa Housing Enclave Phase II', area: 'Mapusa, North Goa', active: true },
];

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, signIn } = useSession();

  // Form Fields
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Personal & ID, Step 2: Site Selection
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('1996-01-01');
  const [calculatedAge, setCalculatedAge] = useState('30');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [idType, setIdType] = useState<'aadhaar' | 'voter' | 'other'>('aadhaar');
  const [idNumber, setIdNumber] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Site Selection
  const [sites, setSites] = useState<SiteSummary[]>(DEFAULT_GOA_SITES);
  const [siteSearch, setSiteSearch] = useState('');
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(DEFAULT_GOA_SITES[0]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Update calculated age when DOB changes
  function handleDobChange(newDob: string) {
    setDob(newDob);
    const birthYear = new Date(newDob).getFullYear();
    const currentYear = new Date().getFullYear();
    if (!isNaN(birthYear) && birthYear > 1920 && birthYear <= currentYear) {
      setCalculatedAge(String(currentYear - birthYear));
    }
  }

  // Format Aadhaar with spaces XXXX XXXX XXXX
  function handleIdNumberChange(txt: string) {
    if (idType === 'aadhaar') {
      const clean = txt.replace(/[^0-9]/g, '').slice(0, 12);
      const formatted = clean.replace(/(\d{4})(?=\d)/g, '$1 ');
      setIdNumber(formatted);
    } else {
      setIdNumber(txt.toUpperCase().slice(0, 20));
    }
  }

  // Validate Step 1
  async function validateStep1() {
    const errs: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      errs.name = 'Full name must be at least 2 characters';
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      errs.phone = 'Mobile number must be exactly 10 digits';
    }
    if (!pin || pin.length < 4 || pin.length > 6) {
      errs.pin = 'PIN must be 4–6 digits';
    }
    if (pin !== confirmPin) {
      errs.confirmPin = 'Security PINs do not match';
    }
    if (idType === 'aadhaar') {
      const rawDigits = idNumber.replace(/\s+/g, '');
      if (rawDigits.length > 0 && rawDigits.length !== 12) {
        errs.idNumber = 'Aadhaar must be 12 digits (or leave blank for later)';
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Duplicate check using authApi.exists
    try {
      setLoading(true);
      const chk = await authApi.exists(cleanPhone);
      if (chk.exists) {
        Alert.alert(
          'Worker Already Registered',
          `A worker profile with mobile number ${cleanPhone} already exists in the M3 system.\n\nPlease sign in with your PIN to access your records. Duplicate profiles are not permitted.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Go to Sign In', onPress: () => router.replace('/sign-in') },
          ]
        );
        return;
      }
    } catch {
      // offline or non-fatal
    } finally {
      setLoading(false);
    }

    setErrors({});
    setStep(2);
  }

  // Final Registration Submission
  async function submitRegistration() {
    if (!selectedSite) {
      Alert.alert('Selection Required', 'Please select your assigned construction site in Goa.');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanPin = pin.trim();

    try {
      setLoading(true);

      // 1. Register Worker via API
      const regData = {
        name: name.trim(),
        phone: cleanPhone,
        pin: cleanPin,
        preferredLanguage: language as Language,
      };

      const res = await authApi.register(regData);

      // 2. Set Session
      await signIn(res.token, res.user);

      // 3. Select Construction Site
      try {
        await workerApi.selectSite(res.token, selectedSite.siteId);
      } catch {
        // non-fatal if site already assigned or mock
      }

      // 4. Initialize Local Screening Draft with Demographic Information
      const workerId = res.user.workerId || res.user.userId || 'current_worker';
      screeningLocalRepo.saveDraft(
        workerId,
        {
          full_name: name.trim(),
          phone_number: cleanPhone,
          date_of_birth: dob,
          age: calculatedAge,
          gender: gender,
          gov_id_type: idType,
          gov_id_number: idNumber,
          current_site_id: selectedSite.siteId,
          current_site_name: selectedSite.name,
        },
        true,
        'LOCAL'
      );

      Alert.alert(
        'Registration Successful! 🎉',
        `Welcome ${name.trim()} to the M3 Malaria Surveillance Project.\n\nAssigned Site: ${selectedSite.name}.\nYour baseline profile is now active.`,
        [
          {
            text: 'Go to Dashboard',
            onPress: () => router.replace('/(worker)/dashboard'),
          },
        ]
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Registration failed. Please check your network and details.';
      if (msg.toLowerCase().includes('already exists')) {
        Alert.alert(
          'Account Exists',
          'A worker with this phone number is already registered. Please sign in.',
          [{ text: 'Sign In', onPress: () => router.replace('/sign-in') }]
        );
      } else {
        Alert.alert('Registration Error', msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
      s.area.toLowerCase().includes(siteSearch.toLowerCase()) ||
      s.siteId.toLowerCase().includes(siteSearch.toLowerCase())
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header with Back and Audio Guidance */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => (step === 2 ? setStep(1) : router.back())}
            style={styles.backButton}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 20, color: palette.primary }}>←</Text>
            <Text style={styles.backButtonText}>{step === 2 ? 'Back' : 'Sign In'}</Text>
          </Pressable>

          <AudioGuidanceButton
            text="New Worker Registration. Please enter your full name, 10 digit phone number, date of birth, gender, and select your construction site in Goa."
            size="small"
          />
        </View>

        {/* Title & Step Indicator */}
        <View style={styles.header}>
          <Text style={styles.title}>New Worker Registration</Text>
          <Text style={styles.subtitle}>
            {step === 1
              ? 'Step 1 of 2: Personal & Identity Information'
              : 'Step 2 of 2: Select Goa Construction Site'}
          </Text>

          {/* Stepper bar */}
          <View style={styles.stepperContainer}>
            <View style={[styles.stepBar, styles.stepBarActive]} />
            <View style={[styles.stepBar, step === 2 && styles.stepBarActive]} />
          </View>
        </View>

        {/* STEP 1: Personal, Age, Gender, ID, PIN */}
        {step === 1 && (
          <Card style={styles.card}>
            <Text style={styles.sectionHeader}>Personal Details</Text>

            <TextField
              label="Full Name *"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={errors.name}
            />

            <TextField
              label="Mobile Number (10 digits) *"
              placeholder="e.g. 9876543210"
              value={phone}
              onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ''))}
              keyboardType="phone-pad"
              maxLength={10}
              error={errors.phone}
            />

            <DatePickerField
              label="Date of Birth *"
              value={dob}
              onChange={handleDobChange}
              maximumDate={new Date()}
            />
            <Text style={styles.ageBadge}>
              Calculated Age: <Text style={{ fontWeight: '700', color: palette.primary }}>{calculatedAge} years</Text>
            </Text>

            {/* Gender Selection */}
            <Text style={styles.fieldLabel}>Gender *</Text>
            <View style={styles.genderRow}>
              {(['male', 'female', 'other'] as const).map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[
                    styles.genderChip,
                    gender === g && styles.genderChipSelected,
                  ]}
                >
                  <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                    {g === 'male' ? '👨 Male' : g === 'female' ? '👩 Female' : '🧑 Other'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Identification Details */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>Identity Document</Text>
            <View style={styles.idTypeRow}>
              {(['aadhaar', 'voter', 'other'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setIdType(t);
                    setIdNumber('');
                  }}
                  style={[
                    styles.idTypeChip,
                    idType === t && styles.idTypeChipSelected,
                  ]}
                >
                  <Text style={[styles.idTypeText, idType === t && styles.idTypeTextSelected]}>
                    {t === 'aadhaar' ? 'Aadhaar Card' : t === 'voter' ? 'Voter ID' : 'Other ID'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextField
              label={idType === 'aadhaar' ? 'Aadhaar Number (12 digits)' : 'Document ID Number'}
              placeholder={idType === 'aadhaar' ? 'XXXX XXXX XXXX' : 'Enter ID number'}
              value={idNumber}
              onChangeText={handleIdNumberChange}
              keyboardType={idType === 'aadhaar' ? 'number-pad' : 'default'}
              maxLength={idType === 'aadhaar' ? 14 : 20}
              error={errors.idNumber}
            />

            {/* Security PIN Creation */}
            <Text style={[styles.sectionHeader, { marginTop: spacing.lg }]}>Create Security PIN</Text>
            <Text style={styles.pinHint}>
              Create a 4–6 digit security PIN to sign in anytime without passwords.
            </Text>

            <TextField
              label="Create Security PIN (4–6 digits) *"
              placeholder="e.g. 1234"
              value={pin}
              onChangeText={(txt) => setPin(txt.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              error={errors.pin}
            />

            <TextField
              label="Confirm Security PIN *"
              placeholder="Re-enter security PIN"
              value={confirmPin}
              onChangeText={(txt) => setConfirmPin(txt.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              error={errors.confirmPin}
            />

            <Button
              label={loading ? 'Checking...' : 'Continue to Site Selection →'}
              onPress={validateStep1}
              loading={loading}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* STEP 2: Construction Site Selection */}
        {step === 2 && (
          <Card style={styles.card}>
            <Text style={styles.sectionHeader}>Assigned Construction Site</Text>
            <Text style={styles.siteHint}>
              Select the active construction project where you are currently employed in Goa.
            </Text>

            {/* Selected Site Confirmation Card */}
            {selectedSite && (
              <View style={styles.selectedSiteCard}>
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedBadgeText}>✓ Selected Worksite</Text>
                </View>
                <Text style={styles.selectedSiteName}>{selectedSite.name}</Text>
                <Text style={styles.selectedSiteArea}>📍 {selectedSite.area}</Text>
                <Text style={styles.selectedSiteCode}>Site ID: {selectedSite.siteId}</Text>
              </View>
            )}

            <TextField
              label="Search Goa Worksites"
              placeholder="Type site name or location (e.g. Candolim, Panaji...)"
              value={siteSearch}
              onChangeText={setSiteSearch}
            />

            <View style={styles.siteList}>
              {filteredSites.map((s) => {
                const isChosen = selectedSite?.siteId === s.siteId;
                return (
                  <SelectRow
                    key={s.siteId}
                    label={s.name}
                    sublabel={`${s.siteId} · ${s.area}`}
                    selected={isChosen}
                    onPress={() => setSelectedSite(s)}
                  />
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="← Back"
                  variant="ghost"
                  onPress={() => setStep(1)}
                  disabled={loading}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Button
                  label={loading ? 'Registering...' : 'Complete Registration ✓'}
                  onPress={submitRegistration}
                  loading={loading}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Bottom prompt to Sign In */}
        <View style={styles.bottomPrompt}>
          <Text style={{ fontSize: fontSize.xs, color: palette.textMuted }}>
            Already registered on M3?
          </Text>
          <Pressable onPress={() => router.replace('/sign-in')}>
            <Text style={styles.signInLink}>Sign In Here</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
  },
  backButtonText: {
    fontSize: fontSize.sm,
    color: palette.primary,
    fontWeight: fontWeight.bold as '700',
    marginLeft: 6,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  stepBarActive: {
    backgroundColor: palette.primary,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  sectionHeader: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium as '500',
    color: palette.textMuted,
    marginBottom: spacing.xs,
  },
  ageBadge: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  genderChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  genderChipSelected: {
    borderColor: palette.primary,
    backgroundColor: '#F0FDFA',
  },
  genderText: {
    fontSize: fontSize.xs,
    color: palette.text,
    fontWeight: '600',
  },
  genderTextSelected: {
    color: palette.primaryDark,
    fontWeight: '700',
  },
  idTypeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  idTypeChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    minHeight: 38,
    justifyContent: 'center',
  },
  idTypeChipSelected: {
    borderColor: palette.primary,
    backgroundColor: '#E0F2FE',
  },
  idTypeText: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '600',
  },
  idTypeTextSelected: {
    color: palette.primaryDark,
    fontWeight: '700',
  },
  pinHint: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  siteHint: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  selectedSiteCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.primary,
    marginBottom: spacing.md,
  },
  selectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: 4,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  selectedSiteName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: palette.text,
  },
  selectedSiteArea: {
    fontSize: fontSize.xs,
    color: palette.primaryDark,
    marginTop: 2,
  },
  selectedSiteCode: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 2,
  },
  siteList: {
    marginTop: spacing.xs,
  },
  bottomPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
  },
  signInLink: {
    fontSize: fontSize.xs,
    color: palette.primary,
    fontWeight: '700',
  },
});
