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
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SupabaseAuthProvider, useSupabaseAuth } from './src/context/SupabaseAuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingStackNav';
import { SetNewPasswordScreen } from './src/screens/SetNewPasswordScreen';
import { openGroupDetail, openMatchDetail, openProfileMain } from './src/navigation/navigationActions';
import { startContextAwareNotificationSync } from './src/services/notifications';
import { darkColors } from './src/theme';
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
    const stopSync = startContextAwareNotificationSync();
    return () => stopSync();
  }, [configured, session, needsPasswordRecovery]);

  if (configured && loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
        <StatusBar style={statusBarStyle} />
      </View>
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
    return (
      <View style={{ flex: 1, backgroundColor: darkColors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={darkColors.accent} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}
