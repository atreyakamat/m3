import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loginSchema, LANGUAGE_LABELS, type Language } from '@m3/shared';
import { Screen, Card, TextField, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { authApi, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight, radius, shadow } from '@/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, signIn } = useSession();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
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
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Top Header with Language Switcher and Audio Guidance */}
        <View style={styles.topHeader}>
          <Pressable
            onPress={() => router.push('/language')}
            style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={t('language.changeLanguage', 'Change Language')}
          >
            <Text style={{ fontSize: 18, marginRight: 6 }}>🌐</Text>
            <Text style={styles.langButtonText}>
              {LANGUAGE_LABELS[language as Language] || (language ? language.toUpperCase() : 'English')}
            </Text>
            <Text style={{ fontSize: 12, marginLeft: 4, color: palette.textMuted }}>▼</Text>
          </Pressable>

          <AudioGuidanceButton
            text="Welcome to M3 Malaria Surveillance. Enter your 10 digit registered mobile number and PIN to sign in. New workers can tap create account."
            size="small"
          />
        </View>

        {/* M3 Application Branding */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>M3</Text>
          </View>
          <Text style={styles.brandTitle}>M3 Malaria Surveillance</Text>
          <Text style={styles.brandTagline}>ICMR–NIMR Field Worker Portal · Goa</Text>
        </View>

        {/* Sign In Form Card */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>{t('auth.returningWorker', 'Sign In')}</Text>
          <Text style={styles.formSubtitle}>
            {t('auth.enterCredentials', 'Enter your mobile number and PIN to access your health portal')}
          </Text>

          <TextField
            label={t('auth.phone', 'Mobile Number')}
            placeholder="e.g. 9497468512"
            value={phone}
            onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ''))}
            keyboardType="phone-pad"
            maxLength={10}
            error={errors.phone}
          />

          <View style={{ position: 'relative' }}>
            <TextField
              label={t('auth.pin', 'Password / PIN')}
              placeholder="4–6 digit security PIN"
              value={pin}
              onChangeText={(txt) => setPin(txt.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={6}
              error={errors.pin}
            />
            <Pressable
              onPress={() => setShowPin(!showPin)}
              style={styles.eyeToggle}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}
            >
              <Text style={{ fontSize: 16 }}>{showPin ? '👁️' : '🙈'}</Text>
            </Pressable>
          </View>

          {/* Sign In Button */}
          <Button
            label={t('auth.signIn', 'Sign In')}
            onPress={submit}
            loading={loading}
            style={styles.submitButton}
          />

          {/* Forgot PIN / Password */}
          <Pressable
            onPress={() => setForgotModalVisible(true)}
            style={styles.forgotButton}
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>
              {t('auth.forgotPin', 'Forgot PIN / Password?')}
            </Text>
          </Pressable>
        </Card>

        {/* New Worker / Create Account Section */}
        <View style={styles.newWorkerSection}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or', 'OR')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.newWorkerCard}>
            <Text style={styles.newWorkerTitle}>
              {t('auth.newHere', 'Are you a new worker in Goa?')}
            </Text>
            <Text style={styles.newWorkerSubtitle}>
              {t('auth.registerHint', 'Register your profile to receive free malaria testing, healthcare monitoring and worker welfare protection.')}
            </Text>
            <Button
              label={t('auth.createAccount', 'Create Account / New Worker')}
              variant="ghost"
              onPress={() => router.push('/sign-up' as never)}
              style={styles.registerButton}
            />
          </View>
        </View>

        {/* Forgot PIN Informational Modal */}
        <Modal
          visible={forgotModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setForgotModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderIcon}>
                <Text style={{ fontSize: 32 }}>🔐</Text>
              </View>
              <Text style={styles.modalTitle}>Forgot Your Security PIN?</Text>
              <Text style={styles.modalBody}>
                To protect your worker health records and identity in Goa, PIN resets are verified by authorized personnel.
              </Text>
              <View style={styles.modalInfoBox}>
                <Text style={styles.modalStep}>1. Contact your <Text style={{ fontWeight: '700' }}>Site Contractor</Text> or Site Supervisor.</Text>
                <Text style={styles.modalStep}>2. Or approach the on-site <Text style={{ fontWeight: '700' }}>ICMR–NIMR Health Worker</Text>.</Text>
                <Text style={styles.modalStep}>3. They will verify your identity via mobile number/Aadhaar and issue a temporary reset PIN.</Text>
              </View>
              <Button
                label="Understood / Close"
                onPress={() => setForgotModalVisible(false)}
                style={{ width: '100%', marginTop: spacing.md }}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: spacing.xxl,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    marginBottom: spacing.md,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: palette.primary,
    minHeight: 44,
  },
  langButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold as '700',
    color: palette.primary,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  logoText: {
    color: palette.textOnColor,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  brandTagline: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: palette.border,
    ...shadow.card,
  },
  formTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    marginBottom: 2,
  },
  formSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: spacing.md,
  },
  eyeToggle: {
    position: 'absolute',
    right: 14,
    top: 38,
    padding: 6,
  },
  submitButton: {
    marginTop: spacing.sm,
    minHeight: 52,
    borderRadius: radius.md,
  },
  forgotButton: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotText: {
    color: palette.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as '600',
  },
  newWorkerSection: {
    marginTop: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontWeight: '600',
  },
  newWorkerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  newWorkerTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    textAlign: 'center',
  },
  newWorkerSubtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  registerButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.md,
    borderColor: palette.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    ...shadow.card,
  },
  modalHeaderIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalBody: {
    fontSize: fontSize.sm,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalInfoBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    gap: spacing.xs,
  },
  modalStep: {
    fontSize: fontSize.xs,
    color: palette.text,
    lineHeight: 18,
  },
});
