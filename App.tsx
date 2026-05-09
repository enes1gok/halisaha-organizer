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
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SupabaseAuthProvider, useSupabaseAuth } from './src/context/SupabaseAuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingNavigator } from './src/navigation/OnboardingStackNav';
import { openGroupDetail, openMatchDetail } from './src/navigation/navigationActions';
import { startContextAwareNotificationSync } from './src/services/notifications';
import { colors } from './src/theme';
import { useAppStore } from './src/store';

function AppShell() {
  const { configured, loading, session } = useSupabaseAuth();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        matchId?: string;
        groupId?: string;
      };
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
    if (!configured || !session) return;
    const stopSync = startContextAwareNotificationSync();
    return () => stopSync();
  }, [configured, session]);

  if (configured && loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (configured && !session) {
    return (
      <>
        <OnboardingNavigator />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <>
      <AppNavigator />
      <StatusBar style="light" />
    </>
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
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <SupabaseAuthProvider>
            <AppShell />
          </SupabaseAuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
