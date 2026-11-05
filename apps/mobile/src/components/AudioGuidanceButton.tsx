import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { palette, spacing, radius, fontSize, fontWeight } from '@/theme';

interface AudioGuidanceButtonProps {
  text: string;
  language?: string;
  label?: string;
  size?: 'small' | 'medium' | 'large';
}

export function mapSpeechLanguage(lang?: string): string {
  switch (lang) {
    case 'hi':
      return 'hi-IN';
    case 'bn':
      return 'bn-IN';
    case 'mr':
      return 'mr-IN';
    case 'kn':
      return 'kn-IN';
    case 'te':
      return 'te-IN';
    case 'ta':
      return 'ta-IN';
    case 'ml':
      return 'ml-IN';
    case 'gu':
      return 'gu-IN';
    case 'pa':
      return 'pa-IN';
    case 'ur':
      return 'ur-IN';
    case 'or':
      return 'or-IN';
    case 'as':
      return 'as-IN';
    case 'sat':
    case 'kok':
    case 'bho':
    case 'mai':
    case 'hne':
      return 'hi-IN'; // Fallback to Hindi voice for dialects/close Indic languages
    case 'en':
    default:
      return 'en-IN';
  }
}

export function AudioGuidanceButton({
  text,
  language,
  label,
  size = 'medium',
}: AudioGuidanceButtonProps) {
  const { i18n, t } = useTranslation();
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeLang = language || i18n.language || 'en';

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleToggleSpeak = async () => {
    try {
      const currentlySpeaking = await Speech.isSpeakingAsync();
      if (currentlySpeaking || isSpeaking) {
        await Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      Speech.speak(text, {
        language: mapSpeechLanguage(activeLang),
        pitch: 1.0,
        rate: 0.9, // Slightly slower for low-literacy clarity
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  };

  const isLarge = size === 'large';
  const isSmall = size === 'small';

  return (
    <Pressable
      onPress={handleToggleSpeak}
      accessibilityRole="button"
      accessibilityLabel={label || t('common.audioGuidance', 'Listen with Audio')}
      accessibilityHint={t('common.audioGuidanceHint', 'Plays spoken instructions in your selected language')}
      style={({ pressed }) => [
        styles.button,
        isLarge && styles.buttonLarge,
        isSmall && styles.buttonSmall,
        isSpeaking && styles.buttonSpeaking,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.icon, isLarge && styles.iconLarge, isSmall && styles.iconSmall]}>
        {isSpeaking ? '🔊' : '🔈'}
      </Text>
      {label ? (
        <Text
          style={[
            styles.label,
            isLarge && styles.labelLarge,
            isSpeaking && styles.labelSpeaking,
          ]}
        >
          {label}
        </Text>
      ) : null}
      {isSpeaking ? (
        <View style={styles.pulseBadge}>
          <Text style={styles.pulseText}>{t('common.playingAudio', 'Playing...')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export const audioButtonStyles = {
  button: {
    minHeight: 48, // Minimum touch target per accessibility standards (Phase 2.1)
  },
  buttonSmall: {
    minHeight: 48, // Enforce 48 dp even on small variant
  },
  buttonLarge: {
    minHeight: 52,
  },
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderColor: '#81C784',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    minHeight: audioButtonStyles.button.minHeight,
    marginVertical: 4,
  },
  buttonSmall: {
    minHeight: audioButtonStyles.buttonSmall.minHeight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  buttonLarge: {
    minHeight: audioButtonStyles.buttonLarge.minHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  buttonSpeaking: {
    backgroundColor: '#C8E6C9',
    borderColor: '#388E3C',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  icon: {
    fontSize: 20,
    marginRight: 6,
  },
  iconSmall: {
    fontSize: 16,
    marginRight: 4,
  },
  iconLarge: {
    fontSize: 26,
    marginRight: 8,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#2E7D32',
  },
  labelLarge: {
    fontSize: fontSize.md,
  },
  labelSpeaking: {
    color: '#1B5E20',
  },
  pulseBadge: {
    marginLeft: 8,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pulseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
