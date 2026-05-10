import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import type { OnboardingStackParamList } from '../navigation/types';
import { spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useUserFeedback } from '../utils/userFeedback';
import { EmailPasswordFields } from './EmailPasswordFields';
import { useOnboardingAuthStyles } from './onboardingAuthStyles';

type Nav = StackNavigationProp<OnboardingStackParamList, 'SignUp'>;

export function SignUpScreen() {
  const styles = useOnboardingAuthStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { signUpWithEmail } = useSupabaseAuth();
  const { showValidationToast, showToast } = useUserFeedback();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      showValidationToast('Kayıt', 'Lütfen görünen adınızı girin.');
      return;
    }
    if (!email.trim() || !password) {
      showValidationToast('Kayıt', 'Lütfen e-posta ve şifre girin.');
      return;
    }
    setBusy(true);
    const { error, sessionCreated } = await signUpWithEmail(email, password, trimmedName);
    setBusy(false);
    if (error) {
      showToast({ title: 'Kayıt', message: error.message, variant: 'error' });
    } else if (sessionCreated) {
      // Oturum onAuthStateChange ile gelir; ek uyarı kullanıcıyı gereksiz yere durdurmasın.
    } else {
      navigation.replace('VerifyEmail', { email: email.trim() });
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
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={[styles.label, { marginTop: 0 }]}>Görünen ad</Text>
          <TextInput
            style={styles.input}
            placeholder="Ad Soyad veya kullanıcı adı"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={displayName}
            onChangeText={setDisplayName}
            editable={!busy}
            testID="onboarding:signup:displayname:input"
            accessibilityLabel="Görünen ad"
          />
          <EmailPasswordFields
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            busy={busy}
            emailTestID="onboarding:signup:email:input"
            passwordTestID="onboarding:signup:password:input"
            passwordVisibilityTestID="onboarding:password-visibility:signup"
          />

          <View style={styles.actions}>
            <PillButton
              title="Kayıt Ol"
              loading={busy}
              disabled={busy}
              onPress={handleSignUp}
              testID="onboarding:signup:submit:press"
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
