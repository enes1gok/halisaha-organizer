import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
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
import { openGroupDetail, openMatchDetail } from './src/navigation/navigationActions';
import { colors } from './src/theme';
import { useAppStore } from './src/store/useAppStore';

function AppShell() {
  const { configured, loading } = useSupabaseAuth();

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

  if (configured && loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
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
