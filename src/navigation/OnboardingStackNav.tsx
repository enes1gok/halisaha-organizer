import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { AuthWelcomeScreen } from '../screens/AuthWelcomeScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
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
      <Stack.Navigator
        initialRouteName="AuthWelcome"
        screenOptions={defaultStackScreenOptions}
      >
        <Stack.Screen
          name="AuthWelcome"
          component={AuthWelcomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SignIn"
          component={SignInScreen}
          options={{ title: 'Giriş Yap' }}
        />
        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          options={{ title: 'Kayıt Ol' }}
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
