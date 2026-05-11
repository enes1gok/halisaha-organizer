import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Appearance,
  AppState,
  Image,
  Text,
  TextInput,
  View,
  type AppStateStatus,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SupabaseAuthProvider, useSupabaseAuth } from './src/context/SupabaseAuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { AppLoadingScreen } from './src/components/AppLoadingScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingStackNav';
import { SetNewPasswordScreen } from './src/screens/SetNewPasswordScreen';
import { openGroupDetail, openMatchDetail, openProfileMain } from './src/navigation/navigationActions';
import { drainPendingInAppDeliveries, startContextAwareNotificationSync } from './src/services/notifications';
import { registerBackgroundSyncTask, unregisterBackgroundSyncTask } from './src/services/sync/backgroundTask';
import { runRemoteCatchUp } from './src/services/sync/remoteCatchUp';
import { palettes } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useAppStore } from './src/store';

/**
 * Sistem yazı ölçeği çarpanı için global tavan. Kullanıcı erişilebilirlik amacıyla
 * sistem yazısını büyütebilir, ancak 1.6x'in üstünde layout (özellikle 44 yükseklik
 * altındaki kontroller ve sabit pitch slot'ları) bozulur. Bu yüzden hem `<Text>`
 * hem `<TextInput>` için tek noktada tavan koyuyoruz; ekran/bileşen düzeyinde
 * adaptif düzen için ayrıca `useFontScale` hook'u kullanılır.
 */
const FONT_SCALE_CAP = 1.6;
const TextWithDefaults = Text as unknown as { defaultProps?: { maxFontSizeMultiplier?: number } };
TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
TextWithDefaults.defaultProps.maxFontSizeMultiplier = FONT_SCALE_CAP;
const TextInputWithDefaults = TextInput as unknown as {
  defaultProps?: { maxFontSizeMultiplier?: number };
};
TextInputWithDefaults.defaultProps = TextInputWithDefaults.defaultProps ?? {};
TextInputWithDefaults.defaultProps.maxFontSizeMultiplier = FONT_SCALE_CAP;

function bootstrapPalette() {
  const scheme = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  return palettes[scheme];
}

function AppShell() {
  const { configured, loading, session, needsPasswordRecovery } = useSupabaseAuth();
  const { scheme, colors } = useTheme();
  const statusBarStyle = scheme === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        matchId?: string;
        groupId?: string;
        target?: string;
      };
      if (data.target === 'profile') {
        openProfileMain();
        return;
      }
      if (data.matchId) {
        openMatchDetail(data.matchId);
        return;
      }
      if (data.groupId) {
        openGroupDetail(data.groupId);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!configured || !session || needsPasswordRecovery) return;
    let previousAppState: AppStateStatus = AppState.currentState;
    const stopSync = startContextAwareNotificationSync();
    const runForegroundSync = async () => {
      try {
        await runRemoteCatchUp({ reason: 'foreground' });
      } catch (error) {
        console.warn('Foreground veri senkronu başarısız', error);
      }
      try {
        await drainPendingInAppDeliveries();
      } catch (error) {
        console.warn('In-app bildirim yakalama başarısız', error);
      }
    };

    void registerBackgroundSyncTask().catch((error) => {
      console.warn('Arka plan senkron görevi kaydedilemedi', error);
    });
    void runForegroundSync();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const wasBackground = previousAppState === 'background' || previousAppState === 'inactive';
      previousAppState = nextState;
      if (nextState === 'active' && wasBackground) {
        void runForegroundSync();
      }
    });

    return () => {
      appStateSub.remove();
      stopSync();
      void unregisterBackgroundSyncTask().catch((error) => {
        console.warn('Arka plan senkron görevi kapatılamadı', error);
      });
    };
  }, [configured, session, needsPasswordRecovery]);

  if (configured && loading) {
    return (
      <>
        <AppLoadingScreen message="Oturum kontrol ediliyor…" />
        <StatusBar style={statusBarStyle} />
      </>
    );
  }

  if (configured && !session) {
    return (
      <>
        <OnboardingNavigator />
        <StatusBar style={statusBarStyle} />
      </>
    );
  }

  if (configured && session && needsPasswordRecovery) {
    return (
      <>
        <SetNewPasswordScreen />
        <StatusBar style={statusBarStyle} />
      </>
    );
  }

  return (
    <>
      <AppNavigator />
      <StatusBar style={statusBarStyle} />
    </>
  );
}

function AppRoot() {
  const { colors } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ToastProvider>
            <SupabaseAuthProvider>
              <AppShell />
            </SupabaseAuthProvider>
          </ToastProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  if (!fontsLoaded || !hydrated) {
    const boot = bootstrapPalette();
    return (
      <View style={{ flex: 1, backgroundColor: boot.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Image
          source={require('./assets/splash-icon.png')}
          style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 16 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 22, fontWeight: '700', color: boot.text, letterSpacing: 0.5, marginBottom: 4 }}>
          Halısaha
        </Text>
        <Text style={{ fontSize: 13, color: boot.textMuted, marginBottom: 32 }}>
          Maç Organize Et
        </Text>
        <ActivityIndicator color={boot.accent} size="large" />
        <Text style={{ fontSize: 15, color: boot.textMuted, marginTop: 12 }}>
          Yükleniyor…
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}
