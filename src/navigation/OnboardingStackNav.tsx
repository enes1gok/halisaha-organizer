import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { colors } from '../theme';
import { defaultStackScreenOptions } from './defaultStackScreenOptions';
import type { OnboardingStackParamList } from './types';

const Stack = createStackNavigator<OnboardingStackParamList>();

const OnboardingTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

export function OnboardingNavigator() {
  return (
    <NavigationContainer theme={OnboardingTheme}>
      <Stack.Navigator screenOptions={defaultStackScreenOptions}>
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{ title: 'Gizlilik Politikası' }}
        />
        <Stack.Screen
          name="TermsOfUse"
          component={TermsOfUseScreen}
          options={{ title: 'Kullanım Koşulları' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
