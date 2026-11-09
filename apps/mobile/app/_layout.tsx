import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { persister, queryClient } from '@/lib/queries';
import { startOutbox } from '@/lib/outbox';
import { prefs } from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import { configureGoogle } from '@/lib/auth';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShareIntentProvider options={{ resetOnBackground: true }}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v1' }}
            onSuccess={() => SplashScreen.hideAsync().catch(() => undefined)}
          >
            <Shell />
          </PersistQueryClientProvider>
        </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { c, dark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { hasShareIntent } = useShareIntentContext();

  useEffect(() => {
    configureGoogle();
    const stop = startOutbox(() => {
      void queryClient.invalidateQueries();
    });
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => undefined), 1500);
    return () => {
      stop();
      clearTimeout(t);
    };
  }, []);

  // Something was shared into Tabby from another app.
  useEffect(() => {
    if (hasShareIntent && segments[0] !== 'share') router.push('/share');
  }, [hasShareIntent, segments, router]);

  // First launch: show onboarding, unless we arrived through a shared link or share sheet.
  useEffect(() => {
    const first = segments[0];
    if (!prefs.onboarded() && !hasShareIntent && first !== 'onboarding' && first !== 'b' && first !== 't') {
      router.replace('/onboarding');
    }
  }, [segments, hasShareIntent, router]);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.ink,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Tabby' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="new" options={{ title: 'New bill', presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan a receipt', headerShown: false }} />
        <Stack.Screen name="import" options={{ title: 'Paste order text' }} />
        <Stack.Screen name="share" options={{ title: 'Shared to Tabby' }} />
        <Stack.Screen name="review" options={{ title: 'Check the bill' }} />
        <Stack.Screen name="currency" options={{ title: 'Currency', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="trip-new" options={{ title: 'New trip', presentation: 'modal' }} />
        <Stack.Screen name="b/[slug]" options={{ title: 'Bill' }} />
        <Stack.Screen name="t/[slug]" options={{ title: 'Trip' }} />
      </Stack>
    </>
  );
}
