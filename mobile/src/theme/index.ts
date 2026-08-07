export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSecondary: '#F9FAFB',
    primary: '#2563EB',
    primaryLight: '#3B82F6',
    accent: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    text: '#1F2937',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    bubbleSent: '#2563EB',
    bubbleReceived: '#F3F4F6',
    bubbleSentText: '#FFFFFF',
    bubbleReceivedText: '#1F2937',
    online: '#10B981',
    shadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    inputBackground: '#F9FAFB',
    tabBar: '#FFFFFF',
    headerBackground: '#FFFFFF',
    draftText: '#6366F1',
  },
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    accent: '#60A5FA',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    border: '#334155',
    borderLight: '#1E293B',
    bubbleSent: '#2563EB',
    bubbleReceived: '#334155',
    bubbleSentText: '#FFFFFF',
    bubbleReceivedText: '#F1F5F9',
    online: '#34D399',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    inputBackground: '#1E293B',
    tabBar: '#1E293B',
    headerBackground: '#1E293B',
    draftText: '#A5B4FC',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  small: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, title: 28 },
  medium: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 26, title: 32 },
  large: { xs: 13, sm: 15, md: 17, lg: 20, xl: 24, xxl: 28, title: 36 },
};

export type ThemeMode = 'light' | 'dark';
export type FontSizeMode = 'small' | 'medium' | 'large';
export type Language = 'en' | 'sw';

export const AvatarColors: Record<string, string> = {
  'avatar-1': '#EF4444', 'avatar-2': '#F97316', 'avatar-3': '#EAB308',
  'avatar-4': '#22C55E', 'avatar-5': '#14B8A6', 'avatar-6': '#06B6D4',
  'avatar-7': '#3B82F6', 'avatar-8': '#6366F1', 'avatar-9': '#8B5CF6',
  'avatar-10': '#A855F7', 'avatar-11': '#EC4899', 'avatar-12': '#F43F5E',
  'avatar-13': '#64748B', 'avatar-14': '#78716C', 'avatar-15': '#059669',
  'avatar-16': '#DC2626', 'avatar-17': '#D97706', 'avatar-18': '#65A30D',
  'avatar-19': '#0891B2', 'avatar-20': '#7C3AED', 'avatar-21': '#BE185D',
  'avatar-22': '#4338CA', 'avatar-23': '#0D9488', 'avatar-24': '#CA8A04',
  'avatar-25': '#9333EA', 'avatar-26': '#374151', 'avatar-27': '#6B7280',
  'avatar-28': '#9CA3AF', 'avatar-29': '#D1D5DB', 'avatar-30': '#2563EB',
};

export const AvatarEmojis: Record<string, string> = {
  'avatar-1': '🦁', 'avatar-2': '🐯', 'avatar-3': '🐻', 'avatar-4': '🦊', 'avatar-5': '🐼',
  'avatar-6': '🌸', 'avatar-7': '🌿', 'avatar-8': '🌊', 'avatar-9': '🌅', 'avatar-10': '🏔️',
  'avatar-11': '💻', 'avatar-12': '📱', 'avatar-13': '⚡', 'avatar-14': '🔬', 'avatar-15': '🚀',
  'avatar-16': '⚽', 'avatar-17': '🏀', 'avatar-18': '🎾', 'avatar-19': '🏃', 'avatar-20': '🏆',
  'avatar-21': '📚', 'avatar-22': '🎓', 'avatar-23': '✏️', 'avatar-24': '📝', 'avatar-25': '🏫',
  'avatar-26': '⭐', 'avatar-27': '💎', 'avatar-28': '🎯', 'avatar-29': '🔷', 'avatar-30': '💠',
};
