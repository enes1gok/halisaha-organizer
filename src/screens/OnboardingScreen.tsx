import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import type { OnboardingStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

type Nav = StackNavigationProp<OnboardingStackParamList, 'Onboarding'>;

export function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signUpWithEmail } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Giriş', 'Lütfen e-posta ve şifre girin.');
      return;
    }
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (error) Alert.alert('Giriş', error.message);
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Kayıt', 'Lütfen e-posta ve şifre girin.');
      return;
    }
    setBusy(true);
    const { error } = await signUpWithEmail(email, password);
    setBusy(false);
    if (error) {
      Alert.alert('Kayıt', error.message);
    } else {
      Alert.alert(
        'Kayıt',
        'Hesabınız oluşturuldu. E-posta doğrulaması açıksa gelen kutunuzu kontrol edin.',
      );
    }
  };

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
        <View style={styles.hero}>
          <Text style={styles.brand}>Halısaha</Text>
          <Text style={styles.title}>Maçlarını organize et</Text>
          <Text style={styles.subtitle}>
            Maç oluştur, arkadaşlarını davet et, kadroyu kur ve skorları kaydet. Başlamak için
            hesabınla giriş yap veya yeni bir hesap oluştur.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>E-posta</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@eposta.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            testID="onboarding:email:input"
            accessibilityLabel="E-posta"
          />

          <Text style={styles.label}>Şifre</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            testID="onboarding:password:input"
            accessibilityLabel="Şifre"
          />

          <View style={styles.actions}>
            <PillButton
              title="Giriş Yap"
              loading={busy}
              disabled={busy}
              onPress={handleSignIn}
              testID="onboarding:signin:press"
              accessibilityLabel="Giriş yap"
            />
            <PillButton
              title="Kayıt Ol"
              variant="ghost"
              loading={busy}
              disabled={busy}
              onPress={handleSignUp}
              testID="onboarding:signup:press"
              accessibilityLabel="Kayıt ol"
            />

            <Text style={styles.consent}>
              <Text>{'"Kayıt Ol"a basarak '}</Text>
              <Text
                style={styles.consentLink}
                onPress={() => navigation.navigate('PrivacyPolicy')}
                accessibilityRole="link"
                accessibilityLabel="Gizlilik politikasını aç"
                testID="onboarding:privacy-link:press"
              >
                gizlilik politikası
              </Text>
              <Text>{' ve '}</Text>
              <Text
                style={styles.consentLink}
                onPress={() => navigation.navigate('TermsOfUse')}
                accessibilityRole="link"
                accessibilityLabel="Kullanım koşullarını aç"
                testID="onboarding:terms-link:press"
              >
                kullanım koşulları
              </Text>
              <Text>nı kabul etmiş olursunuz.</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  brand: {
    ...typography.micro,
    color: colors.accent,
    letterSpacing: 1,
  },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 28,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    backgroundColor: colors.background,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  consent: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  consentLink: {
    color: '#7E8F86',
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
  },
});
