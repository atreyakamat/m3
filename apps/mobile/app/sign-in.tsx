import React, { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loginSchema, workerRegisterSchema } from '@m3/shared';
import { Screen, Title, Card, TextField, Button } from '@/components/ui';
import { authApi, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize, fontWeight } from '@/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, signIn } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit() {
    setErrors({});
    try {
      setLoading(true);
      if (mode === 'register') {
        const parsed = workerRegisterSchema.safeParse({ name, phone, pin, preferredLanguage: language });
        if (!parsed.success) return setFieldErrors(parsed.error);
        const res = await authApi.register(parsed.data);
        await signIn(res.token, res.user);
        // Step 3: Worker selects the initial construction site immediately after registration
        router.replace('/(worker)/site?initial=true');
        return;
      } else {
        const parsed = loginSchema.safeParse({ phone, pin });
        if (!parsed.success) return setFieldErrors(parsed.error);
        const res = await authApi.login(parsed.data);
        await signIn(res.token, res.user);
      }
      router.replace('/(worker)/dashboard');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong';
      Alert.alert(t('auth.welcome'), msg);
    } finally {
      setLoading(false);
    }
  }

  function setFieldErrors(err: import('zod').ZodError) {
    const out: Record<string, string> = {};
    for (const issue of err.issues) out[String(issue.path[0])] = issue.message;
    setErrors(out);
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.textOnColor, fontSize: 28, fontWeight: '800' }}>M3</Text>
        </View>
        <Title>{t('auth.welcome')}</Title>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }}>
        <Tab label={t('auth.returningWorker')} active={mode === 'login'} onPress={() => setMode('login')} />
        <Tab label={t('auth.newWorker')} active={mode === 'register'} onPress={() => setMode('register')} />
      </View>

      <Card>
        {mode === 'register' && (
          <TextField label={t('auth.name')} value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
        )}
        <TextField
          label={t('auth.phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
          error={errors.phone}
        />
        <TextField
          label={t('auth.pin')}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          error={errors.pin}
        />
        <Button
          label={mode === 'register' ? t('auth.register') : t('auth.signIn')}
          onPress={submit}
          loading={loading}
        />
      </Card>
    </Screen>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: active ? palette.primary : palette.surfaceAlt,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: active ? palette.textOnColor : palette.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold as '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
