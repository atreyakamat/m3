import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { pinSchema } from '@m3/shared';
import { Screen, Title, Card, TextField, Button } from '@/components/ui';
import { authApi, ApiError } from '@/api';
import { useSession } from '@/store/session';
import { palette, spacing, fontSize } from '@/theme';

export default function FirstLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, user, signIn } = useSession();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (!token) {
      router.replace('/sign-in');
      return;
    }

    const pinCheck = pinSchema.safeParse(newPin);
    if (!pinCheck.success) {
      setError(t('contractor.pinRules', 'PIN must be 4 to 6 digits'));
      return;
    }

    if (newPin !== confirmPin) {
      setError(t('contractor.pinMismatch', 'The two entries do not match'));
      return;
    }

    try {
      setLoading(true);
      const res = await authApi.changeCredential(token, {
        newCredential: newPin,
        confirmCredential: confirmPin,
      });

      await signIn(res.token, res.user);

      Alert.alert(
        t('contractor.pinChangedTitle', 'PIN Changed'),
        t('contractor.pinChangedBody', 'Your new PIN has been set successfully. Welcome to the Contractor portal.'),
        [
          {
            text: t('common.continue', 'Continue'),
            onPress: () => router.replace('/(contractor)/dashboard'),
          },
        ],
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not change PIN';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xl, gap: spacing.sm, alignItems: 'center' }}>
        <Title>{t('contractor.firstLoginTitle', 'First-time Setup')}</Title>
        <Text style={{ fontSize: fontSize.sm, color: palette.textMuted, textAlign: 'center' }}>
          {t('contractor.firstLoginHint', 'Your account was created with a temporary PIN. Set a new private 4–6 digit PIN before continuing.')}
        </Text>
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        {error ? (
          <View style={{ backgroundColor: '#FFEBEE', padding: spacing.sm, borderRadius: 8, marginBottom: spacing.sm }}>
            <Text style={{ color: palette.danger, fontSize: fontSize.sm, fontWeight: '600' }}>{error}</Text>
          </View>
        ) : null}

        <TextField
          label={t('contractor.newPin', 'New PIN')}
          value={newPin}
          onChangeText={setNewPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="4–6 digits"
        />

        <TextField
          label={t('contractor.confirmPin', 'Confirm new PIN')}
          value={confirmPin}
          onChangeText={setConfirmPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="Repeat PIN"
        />

        <Button
          label={t('contractor.savePin', 'Save and Continue')}
          onPress={submit}
          loading={loading}
          disabled={!newPin || !confirmPin}
        />
      </Card>
    </Screen>
  );
}
