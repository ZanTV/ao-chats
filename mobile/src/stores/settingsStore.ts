import { create } from 'zustand';
import { getSetting, setSetting } from '../services/storage';
import { Colors, FontSize, ThemeMode, FontSizeMode, Language } from '../theme';
import { en, sw, Translations } from '../localization';

interface SettingsState {
  theme: ThemeMode;
  fontSize: FontSizeMode;
  language: Language;
  colors: typeof Colors.light;
  fonts: typeof FontSize.medium;
  t: Translations;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setFontSize: (size: FontSizeMode) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'light',
  fontSize: 'medium',
  language: 'en',
  colors: Colors.light,
  fonts: FontSize.medium,
  t: en,
  isLoaded: false,

  loadSettings: async () => {
    const theme = await getSetting<ThemeMode>('theme', 'light');
    const fontSize = await getSetting<FontSizeMode>('fontSize', 'medium');
    const language = await getSetting<Language>('language', 'en');
    set({
      theme,
      fontSize,
      language,
      colors: Colors[theme],
      fonts: FontSize[fontSize],
      t: language === 'sw' ? sw : en,
      isLoaded: true,
    });
  },

  setTheme: async (theme) => {
    await setSetting('theme', theme);
    set({ theme, colors: Colors[theme] });
  },

  setFontSize: async (fontSize) => {
    await setSetting('fontSize', fontSize);
    set({ fontSize, fonts: FontSize[fontSize] });
  },

  setLanguage: async (language) => {
    await setSetting('language', language);
    set({ language, t: language === 'sw' ? sw : en });
  },
}));
