import { create } from 'zustand';
import { getSetting, setSetting } from '../services/storage';
import { Colors, FontSize, ThemeMode, FontSizeMode, Language } from '../theme';
import { en, sw, Translations } from '../localization';

interface SettingsState {
  theme: ThemeMode;
  fontSize: FontSizeMode;
  language: Language;
  chatSound: boolean;
  chatVibration: boolean;
  notificationSound: boolean;
  notificationVibration: boolean;
  colors: typeof Colors.light;
  fonts: typeof FontSize.medium;
  t: Translations;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setFontSize: (size: FontSizeMode) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  setChatSound: (enabled: boolean) => Promise<void>;
  setChatVibration: (enabled: boolean) => Promise<void>;
  setNotificationSound: (enabled: boolean) => Promise<void>;
  setNotificationVibration: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'light',
  fontSize: 'medium',
  language: 'en',
  chatSound: true,
  chatVibration: true,
  notificationSound: true,
  notificationVibration: true,
  colors: Colors.light,
  fonts: FontSize.medium,
  t: en,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const theme = await getSetting<ThemeMode>('theme', 'light');
      const fontSize = await getSetting<FontSizeMode>('fontSize', 'medium');
      const language = await getSetting<Language>('language', 'en');
      const chatSound = await getSetting<boolean>('chatSound', true);
      const chatVibration = await getSetting<boolean>('chatVibration', true);
      const notificationSound = await getSetting<boolean>('notificationSound', true);
      const notificationVibration = await getSetting<boolean>('notificationVibration', true);
      set({
        theme,
        fontSize,
        language,
        chatSound,
        chatVibration,
        notificationSound,
        notificationVibration,
        colors: Colors[theme],
        fonts: FontSize[fontSize],
        t: language === 'sw' ? sw : en,
        isLoaded: true,
      });
    } catch {
      set({
        theme: 'light',
        fontSize: 'medium',
        language: 'en',
        chatSound: true,
        chatVibration: true,
        notificationSound: true,
        notificationVibration: true,
        colors: Colors.light,
        fonts: FontSize.medium,
        t: en,
        isLoaded: true,
      });
    }
  },

  setTheme: async (theme) => {
    try {
      await setSetting('theme', theme);
    } catch {
      // keep UI change even if persistence fails
    }
    set({ theme, colors: Colors[theme] });
  },

  setFontSize: async (fontSize) => {
    try {
      await setSetting('fontSize', fontSize);
    } catch {
      // keep UI change
    }
    set({ fontSize, fonts: FontSize[fontSize] });
  },

  setLanguage: async (language) => {
    try {
      await setSetting('language', language);
    } catch {
      // keep UI change
    }
    set({ language, t: language === 'sw' ? sw : en });
  },

  setChatSound: async (chatSound) => {
    try {
      await setSetting('chatSound', chatSound);
    } catch {
      // keep UI change
    }
    set({ chatSound });
  },

  setChatVibration: async (chatVibration) => {
    try {
      await setSetting('chatVibration', chatVibration);
    } catch {
      // keep UI change
    }
    set({ chatVibration });
  },

  setNotificationSound: async (notificationSound) => {
    try {
      await setSetting('notificationSound', notificationSound);
    } catch {
      // keep UI change
    }
    set({ notificationSound });
  },

  setNotificationVibration: async (notificationVibration) => {
    try {
      await setSetting('notificationVibration', notificationVibration);
    } catch {
      // keep UI change
    }
    set({ notificationVibration });
  },
}));
