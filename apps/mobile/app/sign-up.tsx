import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { authApi, ApiError } from '@/api';
import { useSession } from '@/store/session';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { signIn } = useSession();

  // Form Fields matching Slide 1 Right Phone
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [aadhaar, setAadhaar] = useState('');
  const [pin, setPin] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function handleAadhaarChange(txt: string) {
    const clean = txt.replace(/[^0-9]/g, '').slice(0, 12);
    setAadhaar(clean);
  }

  async function handleRegister() {
    setErrors({});
    const errs: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      errs.name = 'Please enter your full name';
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      errs.phone = 'Please enter a valid 10-digit mobile number';
    }
    const ageNum = parseInt(age.trim(), 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 18 || ageNum > 85) {
      errs.age = 'Please enter a valid age (18–85)';
    }
    if (!pin || pin.length < 4 || pin.length > 6) {
      errs.pin = 'Please enter a 4–6 digit security PIN';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      setLoading(true);

      const res = await authApi.register({
        name: name.trim(),
        phone: cleanPhone,
        pin,
        preferredLanguage: 'en',
      });
      await signIn(res.token, res.user);

      // Navigate immediately to Slide 2: Registration Complete & Location Capture
      router.replace('/register-location' as never);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Registration failed. Please check your information and try again.';
      Alert.alert('Registration Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Top Header */}
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => router.push('/sign-in')}
            style={styles.backButton}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>← Back to Sign In</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Create your M3 account. Enter your full name, 10 digit mobile number, age, gender, Aadhaar number, and create a 4 digit PIN."
            size="small"
          />
        </View>

        {/* Title Header matching Slide 1 */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Let's get you registered</Text>
        </View>

        {/* Registration Form */}
        <View style={styles.formContainer}>
          {/* Full Name */}
          <Text style={styles.fieldLabel}>Full name</Text>
          <View style={[styles.inputBox, errors.name && styles.inputError]}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your full name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={(val) => {
                setName(val);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              accessibilityLabel="Full name"
            />
          </View>
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

          {/* Mobile Number */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Mobile number</Text>
          <View style={[styles.inputBox, errors.phone && styles.inputError]}>
            <TextInput
              style={styles.textInput}
              placeholder="+91"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(val) => {
                setPhone(val);
                if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
              }}
              accessibilityLabel="Mobile number"
            />
          </View>
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          {/* Age */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Age</Text>
          <View style={[styles.inputBox, errors.age && styles.inputError]}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter age"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={age}
              onChangeText={(val) => {
                setAge(val);
                if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
              }}
              accessibilityLabel="Age"
            />
          </View>
          {errors.age ? <Text style={styles.errorText}>{errors.age}</Text> : null}

          {/* Gender */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Gender</Text>
          <View style={styles.genderRow}>
            {(['male', 'female', 'other'] as const).map((g) => (
              <Pressable
                key={g}
                style={[
                  styles.genderChip,
                  gender === g && styles.genderChipSelected,
                ]}
                onPress={() => setGender(g)}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    gender === g && styles.genderChipTextSelected,
                  ]}
                >
                  {g === 'male' ? 'Male' : g === 'female' ? 'Female' : 'Other'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Aadhaar Number */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Aadhaar number</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="12-digit number"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              maxLength={12}
              value={aadhaar}
              onChangeText={handleAadhaarChange}
              accessibilityLabel="Aadhaar number"
            />
          </View>

          {/* Security PIN for account login */}
          <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Security PIN (for login)</Text>
          <View style={[styles.inputBox, errors.pin && styles.inputError]}>
            <TextInput
              style={styles.textInput}
              placeholder="4–6 digit PIN"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              value={pin}
              onChangeText={(val) => {
                setPin(val);
                if (errors.pin) setErrors((prev) => ({ ...prev, pin: '' }));
              }}
              accessibilityLabel="Security PIN"
            />
          </View>
          {errors.pin ? <Text style={styles.errorText}>{errors.pin}</Text> : null}

          {/* Submit Button matching Slide 1 (Teal #1C8982) */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="SUBMIT"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>SUBMIT</Text>
            )}
          </Pressable>

          {/* Footer Link */}
          <Pressable
            onPress={() => router.push('/sign-in')}
            style={styles.linkButton}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Already registered? Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
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
  backText: {
    fontSize: 14,
    color: '#3A70A6',
    fontWeight: '600',
  },
  headerBlock: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#183043',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6F7E89',
    marginTop: 6,
  },
  formContainer: {
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6F7E89',
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DCE4E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  textInput: {
    fontSize: 16,
    color: '#23303A',
    paddingVertical: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderChip: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DCE4E8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderChipSelected: {
    borderColor: '#1C8982',
    backgroundColor: '#E7F5F2',
  },
  genderChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6F7E89',
  },
  genderChipTextSelected: {
    color: '#183043',
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#1C8982',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
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
  linkButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 6,
  },
  linkText: {
    fontSize: 14,
    color: '#3A70A6',
    fontWeight: '600',
  },
});
