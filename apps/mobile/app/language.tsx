import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@m3/shared';
import { Screen, Title, Subtitle, SelectRow, Button } from '@/components/ui';
import { useSession } from '@/store/session';
import { spacing, palette } from '@/theme';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage } = useSession();

  return (
    <Screen>
      <View style={{ paddingTop: spacing.xxl, gap: spacing.xs }}>
        <Title>{t('language.title')}</Title>
        <Subtitle>{t('language.subtitle')}</Subtitle>
      </View>
      <View style={{ marginTop: spacing.lg }}>
        {LANGUAGES.map((lng) => (
          <SelectRow
            key={lng}
            label={LANGUAGE_LABELS[lng as Language]}
            selected={language === lng}
            onPress={() => void setLanguage(lng as Language)}
          />
        ))}
      </View>
      <View style={{ marginTop: spacing.lg }}>
        <Button label={t('language.continue')} onPress={() => router.replace('/sign-in')} />
      </View>
    </Screen>
  );
}
