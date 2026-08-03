import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
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
  const { initializeAuth } = useAuthStore();
  const { isLoaded, loadSettings, theme } = useSettingsStore();

  useEffect(() => {
    loadSettings();
    initializeAuth();
  }, []);

  if (!isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(auth)/register" />
              <Stack.Screen name="(auth)/verify-email" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="(auth)/forgot-password" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="profile/edit" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="settings/blocked" options={{ animation: 'slide_from_right' }} />
            </Stack>
          </AuthGuard>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );}
