import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WelcomePitchBackdrop } from '../components/onboarding/WelcomePitchBackdrop';
import { PillButton } from '../components/PillButton';
import { useReduceMotion } from '../hooks/useReduceMotion';
import type { OnboardingStackParamList } from '../navigation/types';
import { spacing } from '../theme';
import { useOnboardingAuthStyles } from './onboardingAuthStyles';

type Nav = StackNavigationProp<OnboardingStackParamList, 'AuthWelcome'>;

export function AuthWelcomeScreen() {
  const styles = useOnboardingAuthStyles();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          <WelcomePitchBackdrop reduceMotion={reduceMotion} />
          <View style={styles.heroText}>
            <Text style={styles.brand}>Halısaha</Text>
            <Text style={styles.title}>Maçlarını organize et</Text>
            <Text style={styles.subtitle}>
              Maç oluştur, arkadaşlarını davet et, kadroyu kur ve skorları kaydet. Devam etmek için
              yeni hesap oluştur veya mevcut hesabınla giriş yap.
            </Text>
          </View>
        </View>

        <View style={localStyles.ctaBlock}>
          <PillButton
            title="Kayıt Ol"
            onPress={() => navigation.navigate('SignUp')}
            testID="onboarding:welcome:signup:press"
            accessibilityLabel="Kayıt ol"
          />
          <PillButton
            title="Giriş Yap"
            variant="ghost"
            onPress={() => navigation.navigate('SignIn', {})}
            testID="onboarding:welcome:signin:press"
            accessibilityLabel="Giriş yap"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  ctaBlock: {
    gap: spacing.sm,
  },
});
