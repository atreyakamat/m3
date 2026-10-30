import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Language } from '@m3/shared';
import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  mr: { translation: mr },
} as const;

let initialised = false;

export function initI18n(language: Language = 'en'): typeof i18n {
  if (!initialised) {
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
  void i18n.changeLanguage(language);
}

export default i18n;
