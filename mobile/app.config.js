const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'AO Chats';
const IS_PRODUCTION =
  process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: APP_NAME,
  slug: 'ao-chats',
  version: '2.0.1',
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
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'AO Chats needs photo access so you can share images and set your profile photo.',
      NSPhotoLibraryAddUsageDescription:
        'AO Chats needs permission to save media you choose to keep.',
      // Microphone not used — do not declare NSMicrophoneUsageDescription
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyTracking: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563EB',
    },
    package: 'com.aochats.app',
    versionCode: 5,
    // Do not allow cloud backup of local chat/auth caches
    allowBackup: false,
    // Production talks HTTPS only (api.aochats.chat)
    usesCleartextTraffic: false,
    // Resize window when keyboard opens so composer stays visible above it
    softwareKeyboardLayoutMode: 'resize',
    /**
     * Strip high-risk / unused permissions that Expo plugins merge in.
     * Chat playback does not need the microphone; we never use camera or SMS.
     * This reduces Play Protect "personal information" install warnings for sideloaded APKs.
     */
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
      'android.permission.READ_SMS',
      'android.permission.RECEIVE_SMS',
      'android.permission.SEND_SMS',
      'android.permission.READ_CALL_LOG',
      'android.permission.READ_PHONE_STATE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_MEDIA_LOCATION',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_CONTACTS',
      'android.permission.WRITE_CONTACTS',
      'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
      'android.permission.REQUEST_INSTALL_PACKAGES',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
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
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-asset',
    'expo-sqlite',
    [
      'expo-notifications',
      {
        // Keep notification permission; do not enable remote listening of other apps
        mode: 'production',
      },
    ],
    [
      'expo-audio',
      {
        // Playback-only (chat sounds / media). No microphone recording.
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'AO Chats needs photo access so you can share images and set your profile photo.',
        cameraPermission: false,
      },
    ],
    [
      'expo-media-library',
      {
        photosPermission: 'AO Chats needs photo access to show recent media for sharing.',
        savePhotosPermission: 'AO Chats needs permission to save media you choose to keep.',
        isAccessMediaLocationEnabled: false,
        granularPermissions: ['photo', 'video'],
      },
    ],
    'expo-video',
    'expo-sharing',
  ],
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
    privacyPolicyUrl: 'https://www.aochats.chat/privacy',
    eas: {
      ...config.extra?.eas,
      projectId: process.env.EAS_PROJECT_ID || '076c3503-03fd-484e-8c0e-ed618f4d5934',
    },
  },
  owner: 'ochobek',
});
