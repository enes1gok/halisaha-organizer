import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useMemo } from 'react';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { useAppIntroCompletion } from '../hooks/useAppIntroCompletion';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { AuthWelcomeScreen } from '../screens/AuthWelcomeScreen';
import { AppIntroScreen } from '../screens/AppIntroScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { useTheme, useThemeColors } from '../theme/ThemeContext';
import { getDefaultStackScreenOptions } from './defaultStackScreenOptions';
import type { OnboardingStackParamList } from './types';

const Stack = createStackNavigator<OnboardingStackParamList>();

function buildOnboardingNavTheme(scheme: 'light' | 'dark', c: ReturnType<typeof useThemeColors>): NavTheme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: c.background,
      card: c.background,
      primary: c.accent,
      text: c.text,
      border: c.border,
    },
  };
}

export function OnboardingNavigator() {
  const reduceMotion = useReduceMotion();
  const { scheme, colors } = useTheme();
  const { status, markCompleted } = useAppIntroCompletion();

  const onboardingTheme = useMemo(() => buildOnboardingNavTheme(scheme, colors), [scheme, colors]);
  const screenOptions = useMemo(
    () => getDefaultStackScreenOptions(reduceMotion, colors),
    [colors, reduceMotion],
  );

  if (status === 'loading') {
    return <AppLoadingScreen message="Hazırlanıyor…" />;
  }

  if (status === 'needs_intro') {
    return <AppIntroScreen onComplete={markCompleted} />;
  }

  return (
    <NavigationContainer theme={onboardingTheme}>
      <Stack.Navigator initialRouteName="AuthWelcome" screenOptions={screenOptions}>
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
          name="VerifyEmail"
          component={VerifyEmailScreen}
          options={{ title: 'E-posta doğrulama' }}
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
