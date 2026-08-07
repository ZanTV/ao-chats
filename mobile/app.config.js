const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'AO Chats';
const IS_PRODUCTION =
  process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: APP_NAME,
  slug: 'ao-chats',
  version: '2.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'aochats',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#2563EB',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.aochats.app',
    associatedDomains: ['applinks:www.aochats.chat', 'applinks:aochats.chat'],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563EB',
    },
    package: 'com.aochats.app',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'www.aochats.chat', pathPrefix: '/' },
          { scheme: 'https', host: 'aochats.chat', pathPrefix: '/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-asset', 'expo-sqlite', 'expo-notifications', 'expo-audio'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    appName: APP_NAME,
    appUrl: process.env.EXPO_PUBLIC_APP_URL || (IS_PRODUCTION ? undefined : 'http://localhost:8081'),
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL ||
      (IS_PRODUCTION ? undefined : 'http://localhost:3001/api'),
    socketUrl:
      process.env.EXPO_PUBLIC_SOCKET_URL ||
      (IS_PRODUCTION ? undefined : 'http://localhost:3001'),
    storageUrl:
      process.env.EXPO_PUBLIC_STORAGE_URL ||
      (IS_PRODUCTION ? undefined : process.env.EXPO_PUBLIC_APP_URL || 'http://localhost:8081'),
    env: process.env.EXPO_PUBLIC_ENV || (IS_PRODUCTION ? 'production' : 'development'),
    eas: {
      ...config.extra?.eas,
      projectId: process.env.EAS_PROJECT_ID || '076c3503-03fd-484e-8c0e-ed618f4d5934',
    },
  },
  owner: 'ochobek',
});
