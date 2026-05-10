import { createStackNavigator } from '@react-navigation/stack';
import React, { useMemo } from 'react';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useThemeColors } from '../theme/ThemeContext';
import { LicensesScreen } from '../screens/LicensesScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { getDefaultStackScreenOptions } from './defaultStackScreenOptions';
import type { ProfileStackParamList } from './types';

const Stack = createStackNavigator<ProfileStackParamList>();

export function ProfileStackNav() {
  const reduceMotion = useReduceMotion();
  const colors = useThemeColors();
  const screenOptions = useMemo(
    () => getDefaultStackScreenOptions(reduceMotion, colors),
    [colors, reduceMotion],
  );
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'İstatistiklerim' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ayarlar' }} />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Bildirimler' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: 'Gizlilik Politikasi' }}
      />
      <Stack.Screen name="TermsOfUse" component={TermsOfUseScreen} options={{ title: 'Kullanım Koşulları' }} />
      <Stack.Screen name="Licenses" component={LicensesScreen} options={{ title: 'Açık kaynak lisansları' }} />
    </Stack.Navigator>
  );
}
