import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@m3/shared';
import { AudioGuidanceButton } from '@/components/AudioGuidanceButton';
import { useSession } from '@/store/session';

// Native script badge representations matching Slide 1
const SCRIPT_BADGES: Record<string, string> = {
  en: 'A',
  hi: 'हि',
  kok: 'कों',
  bn: 'বা',
  or: 'ଓ',
  mr: 'म',
  pa: 'ਪੰ',
  ur: 'اردو',
  sat: 'ᱥᱟ',
  bho: 'भोज',
  mai: 'मै',
  hne: 'छत्त',
  as: 'অ',
  gu: 'ગુ',
  kn: 'ಕ',
  te: 'తె',
  ta: 'த',
  ml: 'മ',
};

const NATIVE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kok: 'कोंकणी',
  bn: 'বাংলা',
  or: 'ଓଡ଼ିଆ',
  mr: 'मराठी',
  pa: 'ਪੰਜਾਬੀ',
  ur: 'اردو',
  sat: 'ᱥᱟᱱᱛᱟᱲᱤ',
  bho: 'भोजपुरी',
  mai: 'मैथिली',
  hne: 'छत्तीसगढ़ी',
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
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top bar with audio guidance */}
        <View style={styles.topBar}>
          <AudioGuidanceButton
            text="Choose your preferred language from the list below and tap SUBMIT."
            size="small"
          />
        </View>

        {/* Title Header matching Slide 1 */}
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Choose your language</Text>
          <Text style={styles.subtitle}>Select your preferred language</Text>
        </View>

        {/* Language Options List */}
        <View style={styles.listContainer}>
          {LANGUAGES.map((lng) => {
            const isSelected = language === lng;
            const badge = SCRIPT_BADGES[lng] || lng.slice(0, 2).toUpperCase();
            const nativeName = NATIVE_NAMES[lng] || LANGUAGE_LABELS[lng as Language] || lng;

            return (
              <Pressable
                key={lng}
                onPress={() => onSelect(lng as Language)}
                style={({ pressed }) => [
                  styles.langCard,
                  isSelected ? styles.langCardSelected : styles.langCardDefault,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={nativeName}
              >
                <View style={[styles.badgeCircle, isSelected && styles.badgeCircleSelected]}>
                  <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                    {badge}
                  </Text>
                </View>

                <Text style={[styles.langText, isSelected && styles.langTextSelected]}>
                  {nativeName}
                </Text>

                <View style={styles.checkCol}>
                  {isSelected && <Text style={styles.checkMark}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Bottom Submit Button matching Slide 1 (Teal #1C8982) */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="SUBMIT"
        >
          <Text style={styles.submitButtonText}>SUBMIT</Text>
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
  container: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  topBar: {
    alignItems: 'flex-end',
    marginBottom: 8,
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
  listContainer: {
    marginBottom: 24,
  },
  langCard: {
    height: 60,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  langCardDefault: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE4E8',
  },
  langCardSelected: {
    backgroundColor: '#E7F5F2',
    borderColor: '#1C8982',
  },
  badgeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  badgeCircleSelected: {
    backgroundColor: '#CCFBF1',
  },
  badgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#183043',
  },
  badgeTextSelected: {
    color: '#0D9488',
  },
  langText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#23303A',
  },
  langTextSelected: {
    color: '#183043',
    fontWeight: '700',
  },
  checkCol: {
    width: 28,
    alignItems: 'center',
  },
  checkMark: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C8982',
  },
  submitButton: {
    backgroundColor: '#1C8982',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
});
