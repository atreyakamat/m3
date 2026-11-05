import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, Language } from '@m3/shared';
import { changeLanguage } from '@/i18n';
import { workerApi } from '@/api';

const TOKEN_KEY = 'm3_token';
const USER_KEY = 'm3_user';
const LANG_KEY = 'm3_language';
const SELECTED_SITE_KEY = 'm3_contractor_selected_site';

interface SessionState {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  language: Language;
  selectedSiteCode: string | null;
  hydrate: () => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  setSelectedSiteCode: (siteCode: string | null) => Promise<void>;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
}

async function safeGet(store: 'secure' | 'async', key: string): Promise<string | null> {
  try {
    return store === 'secure' ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  token: null,
  user: null,
  language: 'en',
  selectedSiteCode: null,

  hydrate: async () => {
    const [token, userRaw, lang, siteCode] = await Promise.all([
      safeGet('secure', TOKEN_KEY),
      safeGet('async', USER_KEY),
      safeGet('async', LANG_KEY),
      safeGet('async', SELECTED_SITE_KEY),
    ]);
    const language = (lang as Language) ?? 'en';
    changeLanguage(language);
    const user = userRaw ? (JSON.parse(userRaw) as AuthUser) : null;
    if (user?.role === 'ADMIN') {
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
      } catch {
        /* ignore */
      }
      set({ ready: true, token: null, user: null, language, selectedSiteCode: null });
      return;
    }
    set({
      ready: true,
      token,
      user,
      language,
      selectedSiteCode: siteCode ?? null,
    });
  },

  setLanguage: async (language) => {
    changeLanguage(language);
    set({ language });
    try {
      await AsyncStorage.setItem(LANG_KEY, language);
    } catch {
      /* non-fatal */
    }
    const token = get().token;
    if (token) {
      void workerApi.updateLanguage(token, language).catch(() => {});
    }
  },

  setSelectedSiteCode: async (selectedSiteCode) => {
    set({ selectedSiteCode });
    try {
      if (selectedSiteCode) {
        await AsyncStorage.setItem(SELECTED_SITE_KEY, selectedSiteCode);
      } else {
        await AsyncStorage.removeItem(SELECTED_SITE_KEY);
      }
    } catch {
      /* non-fatal */
    }
  },

  signIn: async (token, user) => {
    if (user.role === 'ADMIN') {
      throw new Error('Admin accounts can only access the M3 web portal.');
    }
    set({ token, user });
    if (user.preferredLanguage) {
      await get().setLanguage(user.preferredLanguage);
    }
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* non-fatal; session still active in memory */
    }
  },

  signOut: async () => {
    set({ token: null, user: null, selectedSiteCode: null });
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      await AsyncStorage.removeItem(SELECTED_SITE_KEY);
    } catch {
      /* ignore */
    }
  },
}));

export { TOKEN_KEY, USER_KEY, LANG_KEY, SELECTED_SITE_KEY };
