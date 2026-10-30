import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser, Language } from '@m3/shared';
import { changeLanguage } from '@/i18n';

const TOKEN_KEY = 'm3_token';
const USER_KEY = 'm3_user';
const LANG_KEY = 'm3_language';

interface SessionState {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  language: Language;
  hydrate: () => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
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

  hydrate: async () => {
    const [token, userRaw, lang] = await Promise.all([
      safeGet('secure', TOKEN_KEY),
      safeGet('async', USER_KEY),
      safeGet('async', LANG_KEY),
    ]);
    const language = (lang as Language) ?? 'en';
    changeLanguage(language);
    set({
      ready: true,
      token,
      user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
      language,
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
  },

  signIn: async (token, user) => {
    set({ token, user });
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* non-fatal; session still active in memory */
    }
  },

  signOut: async () => {
    set({ token: null, user: null });
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  },
}));

export { TOKEN_KEY, USER_KEY, LANG_KEY };
