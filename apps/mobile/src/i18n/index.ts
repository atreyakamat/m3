import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import type { Language } from '@m3/shared';
import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';
import kok from './locales/kok.json';
import kn from './locales/kn.json';
import or from './locales/or.json';
import te from './locales/te.json';
import ta from './locales/ta.json';
import ml from './locales/ml.json';
import bho from './locales/bho.json';
import as from './locales/as.json';
import gu from './locales/gu.json';
import pa from './locales/pa.json';
import ur from './locales/ur.json';
import mai from './locales/mai.json';
import sat from './locales/sat.json';
import hne from './locales/hne.json';

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  mr: { translation: mr },
  kok: { translation: kok },
  kn: { translation: kn },
  or: { translation: or },
  te: { translation: te },
  ta: { translation: ta },
  ml: { translation: ml },
  bho: { translation: bho },
  as: { translation: as },
  gu: { translation: gu },
  pa: { translation: pa },
  ur: { translation: ur },
  mai: { translation: mai },
  sat: { translation: sat },
  hne: { translation: hne },
} as const;

export const RTL_LANGUAGES: Language[] = ['ur'];

export function isLanguageRTL(language: string): boolean {
  return language === 'ur';
}

let initialised = false;

export function initI18n(language: Language = 'en'): typeof i18n {
  if (!initialised) {
    const isRtl = isLanguageRTL(language);
    try {
      I18nManager.allowRTL(isRtl);
      I18nManager.forceRTL(isRtl);
    } catch {
      /* ignore native layout errors in tests */
    }

    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    });
    initialised = true;
  }
  return i18n;
}

export function changeLanguage(language: Language): void {
  const isRtl = isLanguageRTL(language);
  try {
    if (I18nManager.isRTL !== isRtl) {
      I18nManager.allowRTL(isRtl);
      I18nManager.forceRTL(isRtl);
    }
  } catch {
    /* ignore in tests */
  }
  void i18n.changeLanguage(language);
}

export default i18n;
