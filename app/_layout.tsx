import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useCallback } from 'react';
import { StatusBar, View, ActivityIndicator, AppState as RNAppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '@/lib/store';
import { useAuth } from '@/lib/useAuth';
import { useTheme } from '@/lib/useTheme';
import { colors } from '@/constants/theme';
import '@/lib/i18n';
import { loadSavedLanguage } from '@/lib/i18n';
import SyncConflictModal from '@/components/SyncConflictModal';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const CustomDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.dark.bg,
    card: colors.dark.bgElevated,
    text: colors.dark.text,
    border: colors.dark.border,
    primary: colors.accent,
  },
};

const CustomLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.light.bg,
    card: colors.light.bgElevated,
    text: colors.light.text,
    border: colors.light.border,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const loadData = useAppStore((s) => s.loadData);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      loadData().then(() => {
        useAppStore.getState().fetchServerTime();
      });
      loadSavedLanguage();
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const { isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { isLoaded, hasCompletedOnboarding } = useAppStore();
  const { user, loading: authLoading, signOut } = useAuth();
  const isSyncConflict = useAppStore(s => s.isSyncConflict);
  const isCheckingSync = useAppStore(s => s.isCheckingSync);
  const isResettingPassword = useAppStore(s => s.isResettingPassword);
  const prevUserId = useRef<string | null>(null);

  // Navigation guard: block routing while sync check, conflict modal, or password reset is active
  useEffect(() => {
    if (!isLoaded || authLoading) return;
    if (isCheckingSync || isSyncConflict || isResettingPassword) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inAuth = segments[0] === '(auth)';

    if (!hasCompletedOnboarding && !inOnboarding) {
      router.replace('/onboarding');
    } else if (hasCompletedOnboarding && !user && !inAuth) {
      // Auth required: no guest access
      router.replace('/(auth)/login');
    } else if (hasCompletedOnboarding && user && inAuth) {
      router.replace('/(tabs)');
    } else if (hasCompletedOnboarding && inOnboarding) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    }
  }, [isLoaded, authLoading, hasCompletedOnboarding, segments, user, isCheckingSync, isSyncConflict, isResettingPassword]);

  // Reset store data on sign out
  useEffect(() => {
    if (!user && prevUserId.current) {
      useAppStore.getState().resetUserData();
      prevUserId.current = null;
    }
  }, [user]);

  // Login interceptor: check for sync conflict before any cloud sync
  useEffect(() => {
    if (!user || !isLoaded) {
      prevUserId.current = null;
      return;
    }
    if (isResettingPassword) return;
    if (prevUserId.current === user.id) return;
    prevUserId.current = user.id;

    const store = useAppStore.getState();
    (async () => {
      const hasConflict = await store.checkSyncConflict(user.id);
      if (prevUserId.current !== user.id) return;
      if (!hasConflict) {
        // After sign-out, hydrate the next account before pushing preferences.
        if (useAppStore.getState().needsCloudHydration) {
          const hydrated = await store.loadFromCloud(user.id);
          if (!hydrated) {
            prevUserId.current = null;
            return;
          }
          if (prevUserId.current !== user.id) return;
          useAppStore.setState({ needsCloudHydration: false });
          await store.saveData();
        }
        await store.syncToCloud(user.id);
        if (prevUserId.current !== user.id) return;
        if (useAppStore.getState().swipeQueue.length === 0) {
          await store.loadFromCloud(user.id);
        }
      }
    })();
  }, [user, isLoaded, isResettingPassword]);

  const handleConflictCancel = useCallback(async () => {
    await signOut();
    prevUserId.current = null;
  }, [signOut]);

  const handleConflictUseCloud = useCallback(() => {
    if (user) {
      const store = useAppStore.getState();
      store.syncToCloud(user.id);
    }
  }, [user]);

  // AppState listener: skip sync if conflict is active
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      const store = useAppStore.getState();
      if (store.isSyncConflict || store.isCheckingSync || store.isResettingPassword || store.needsCloudHydration) return;
      if (state === 'background' || state === 'inactive') {
        if (user) {
          store.syncToCloud(user.id);
        } else {
          store.flushSwipeQueue();
        }
      }
      if (state === 'active') {
        store.refillEnergy();
        store.fetchServerTime();
        if (user) {
          store.syncToCloud(user.id).then(() => {
            if (useAppStore.getState().swipeQueue.length === 0) {
              store.loadFromCloud(user.id);
            }
          });
        }
      }
    };
    const sub = RNAppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [user]);

  if (!isLoaded || isCheckingSync) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? colors.dark.bg : colors.light.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ThemeProvider value={isDark ? CustomDark : CustomLight}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="term/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
        <SyncConflictModal
          visible={isSyncConflict}
          onCancel={handleConflictCancel}
          onUseCloud={handleConflictUseCloud}
        />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
