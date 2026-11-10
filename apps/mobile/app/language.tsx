import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@m3/shared';
import { Screen, Button } from '@/components/ui';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { useSession } from '@/store/session';
import { spacing, palette, fontSize, fontWeight, radius, shadow } from '@/theme';

// Native script labels for clarity for workers
const NATIVE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kok: 'कोंकणी',
  bn: 'বাংলা',
  mr: 'मराठी',
  pa: 'ਪੰਜਾਬੀ',
  ur: 'اردو',
  sat: 'ᱥᱟᱱᱛᱟᱲᱤ',
  bho: 'भोजपुरी',
  mai: 'मैथिली',
  hne: 'छत्तीसगढ़ी',
  or: 'ଓଡ଼ିଆ',
  as: 'অসমীয়া',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
  te: 'తెలుగు',
  ta: 'தமிழ்',
  ml: 'മലയാളം',
};

export default function LanguageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage, token } = useSession();

  function onSelect(lng: Language) {
    void setLanguage(lng);
  }

  function handleContinue() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(token ? '/(worker)/dashboard' : '/sign-in');
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('language.title', 'Choose Your Language')}</Text>
            <Text style={styles.subtitle}>
              भाषा चुनें • भास निवडा • अपनी पसंदीदा भाषा चुनें
            </Text>
          </View>
          <AudioGuidanceButton
            text="Please select your language from the list below and tap Continue. आप नीचे दी गई सूची से अपनी भाषा चुन सकते हैं।"
            size="small"
          />
        </View>

        {/* Language Cards Grid */}
        <View style={styles.grid}>
          {LANGUAGES.map((lng) => {
            const isSelected = language === lng;
            const nativeName = NATIVE_NAMES[lng] || LANGUAGE_LABELS[lng as Language] || lng;
            const englishName = LANGUAGE_LABELS[lng as Language] || lng;

            return (
              <Pressable
                key={lng}
                onPress={() => onSelect(lng as Language)}
                style={({ pressed }) => [
                  styles.langCard,
                  isSelected && styles.langCardSelected,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${nativeName} (${englishName})`}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.nativeText, isSelected && styles.textSelected]}>
                    {nativeName}
                  </Text>
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>
                <Text style={[styles.englishText, isSelected && styles.textMutedSelected]}>
                  {englishName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Continue Button — Standardised Submit label */}
        <View style={styles.footer}>
          <Button
            label="Submit"
            onPress={handleContinue}
            style={styles.continueButton}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  grid: {
    gap: spacing.sm,
  },
  langCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    minHeight: 64,
    justifyContent: 'center',
    ...shadow.card,
  },
  langCardSelected: {
    borderColor: palette.primary,
    backgroundColor: '#F0FDFA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nativeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold as '700',
    color: palette.text,
  },
  textSelected: {
    color: palette.primary,
  },
  englishText: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginTop: 2,
  },
  textMutedSelected: {
    color: palette.primaryDark,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.surface,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.primary,
  },
  footer: {
    marginTop: spacing.xl,
  },
  continueButton: {
    minHeight: 52,
    borderRadius: radius.md,
  },
});
