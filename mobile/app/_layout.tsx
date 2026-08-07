import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState, useCallback } from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useNotificationStore } from '../src/stores/notificationStore';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { NotificationPanel } from '../src/components/NotificationPanel';
import { GlobalRealtimeListeners } from '../src/components/GlobalRealtimeListeners';
import { hydrateLocalCache } from '../src/cache';
import { initializePushNotifications, unregisterPushNotifications } from '../src/services/pushService';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();

  if (isLoading) return <LoadingScreen />;

  const inAuthGroup = segments[0] === '(auth)';

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isAuthenticated && inAuthGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { initializeAuth, isAuthenticated, isLoading } = useAuthStore();
  const { isLoaded, loadSettings, theme } = useSettingsStore();
  const initializeNotifications = useNotificationStore((s) => s.initialize);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await hydrateLocalCache();
      } catch {
        // cache optional at startup
      }
      if (cancelled) return;
      try {
        await Promise.all([loadSettings(), initializeAuth()]);
      } catch {
        // still allow app to open
      }
      if (!cancelled) setAppReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cleanupPush: (() => void) | undefined;
    const cleanupNotifications = initializeNotifications();
    initializePushNotifications().then((cleanup) => {
      cleanupPush = cleanup;
    });
    return () => {
      cleanupNotifications();
      cleanupPush?.();
    };
  }, [isAuthenticated, initializeNotifications]);

  useEffect(() => {
    if (isAuthenticated) return;
    unregisterPushNotifications().catch(() => {});
  }, [isAuthenticated]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady && isLoaded && !isLoading) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady, isLoaded, isLoading]);

  useEffect(() => {
    if (appReady && isLoaded && !isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady, isLoaded, isLoading]);

  if (!isLoaded || !appReady) {
    return <LoadingScreen onLayout={onLayoutRootView} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <GlobalRealtimeListeners />
          <NotificationPanel />
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(auth)/verify-email" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="(auth)/forgot-password" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="starred" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="settings/blocked" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthGuard>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
