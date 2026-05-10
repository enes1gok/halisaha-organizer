import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppIntroCompletion } from '../hooks/useAppIntroCompletion';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { AuthWelcomeScreen } from '../screens/AuthWelcomeScreen';
import { AppIntroScreen } from '../screens/AppIntroScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { colors } from '../theme';
import { getDefaultStackScreenOptions } from './defaultStackScreenOptions';
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
  const reduceMotion = useReduceMotion();
  const { status, markCompleted } = useAppIntroCompletion();

  if (status === 'loading') {
    return (
      <View style={gateStyles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (status === 'needs_intro') {
    return <AppIntroScreen onComplete={markCompleted} />;
  }

  return (
    <NavigationContainer theme={OnboardingTheme}>
      <Stack.Navigator
        initialRouteName="AuthWelcome"
        screenOptions={getDefaultStackScreenOptions(reduceMotion)}
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

const gateStyles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
