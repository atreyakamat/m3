import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loginSchema, LANGUAGE_LABELS, type Language } from '@m3/shared';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { authApi, ApiError } from '@/api';
import { useSession } from '@/store/session';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [forgotModalVisible, setForgotModalVisible] = useState(false);

  async function submit() {
    setErrors({});
    const parsed = loginSchema.safeParse({ phone, pin });
    if (!parsed.success) {
      const out: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        out[String(issue.path[0])] = issue.message;
      }
      return setErrors(out);
    }

    try {
      setLoading(true);
      const res = await authApi.login(parsed.data);
      await signIn(res.token, res.user);

      if (res.user.credentialChangeRequired) {
        router.replace('/first-login');
        return;
      }
      if (res.user.role === 'CONTRACTOR') {
        router.replace('/(contractor)/dashboard');
        return;
      }
      if (res.user.role === 'HEALTH_WORKER') {
        router.replace('/(health-worker)/dashboard');
        return;
      }
      router.replace('/(worker)/dashboard');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Invalid phone number or PIN. Please check and try again.';
      Alert.alert(t('auth.welcome', 'Sign In'), msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Top Header with Language Switcher and Audio Guidance */}
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => router.push('/language')}
            style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={t('language.changeLanguage', 'Change Language')}
          >
            <Text style={{ fontSize: 16, marginRight: 4 }}>🌐</Text>
            <Text style={styles.langButtonText}>
              {LANGUAGE_LABELS[language as Language] || (language ? language.toUpperCase() : 'English')}
            </Text>
            <Text style={{ fontSize: 11, marginLeft: 3, color: '#6F7E89' }}>▼</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Welcome to M3 App. Enter your registered mobile number and PIN to sign in. If you are new, tap Create your account below."
            size="small"
          />
        </View>

        {/* Title Header matching Slide 1 */}
        <View style={styles.headerBlock}>
          <Text style={styles.welcomeTitle}>Welcome to M3 App</Text>
          <Text style={styles.welcomeSubtitle}>Malaria surveillance for workers</Text>
        </View>

        {/* Sign In Form */}
        <View style={styles.formContainer}>
          {/* Mobile Number Field */}
          <Text style={styles.fieldLabel}>Mobile number</Text>
          <View style={[styles.inputBox, errors.phone && styles.inputError]}>
            <TextInput
              style={styles.textInput}
              placeholder="+91 98765 43210"
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

          {/* Password / PIN Field */}
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Password / PIN</Text>
          <View style={[styles.inputBox, errors.pin && styles.inputError]}>
            <TextInput
              style={styles.textInput}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry
              keyboardType="numeric"
              value={pin}
              onChangeText={(val) => {
                setPin(val);
                if (errors.pin) setErrors((prev) => ({ ...prev, pin: '' }));
              }}
              accessibilityLabel="Password or PIN"
            />
          </View>
          {errors.pin ? <Text style={styles.errorText}>{errors.pin}</Text> : null}

          {/* Primary Submit Button matching Slide 1 (Teal #1C8982) */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              loading && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={submit}
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

          {/* Forgot Password Link */}
          <Pressable
            onPress={() => setForgotModalVisible(true)}
            style={styles.linkButton}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>Forgot password?</Text>
          </Pressable>

          {/* New to M3 Section matching Slide 1 */}
          <View style={styles.newWorkerSection}>
            <Text style={styles.newWorkerLabel}>New to M3?</Text>
            <Pressable
              style={({ pressed }) => [
                styles.registerButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push('/sign-up' as never)}
              accessibilityRole="button"
              accessibilityLabel="Create your account"
            >
              <Text style={styles.registerButtonText}>Create your account</Text>
            </Pressable>
          </View>
        </View>

        {/* Forgot Password Modal */}
        <Modal
          visible={forgotModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setForgotModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>PIN Reset Assistance</Text>
              <Text style={styles.modalBody}>
                To protect migrant worker health records, PIN resets must be verified in person by your assigned worksite contractor or visiting Primary Health Centre (PHC) health surveillance worker.
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setForgotModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
    marginBottom: 24,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE4E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#183043',
  },
  headerBlock: {
    marginBottom: 28,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#183043',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6F7E89',
    marginTop: 6,
    lineHeight: 22,
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
  submitButton: {
    backgroundColor: '#1C8982',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
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
    paddingVertical: 14,
    marginTop: 4,
  },
  linkText: {
    fontSize: 14,
    color: '#3A70A6',
    fontWeight: '600',
  },
  newWorkerSection: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  newWorkerLabel: {
    fontSize: 14,
    color: '#6F7E89',
    marginBottom: 12,
  },
  registerButton: {
    backgroundColor: '#183043',
    width: '100%',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#183043',
    marginBottom: 12,
  },
  modalBody: {
    fontSize: 14,
    color: '#6F7E89',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: '#1C8982',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
