import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import type { OnboardingStackParamList } from '../navigation/types';
import { spacing } from '../theme';
import { EmailPasswordFields } from './EmailPasswordFields';
import { onboardingAuthStyles as styles } from './onboardingAuthStyles';

type Nav = StackNavigationProp<OnboardingStackParamList, 'SignUp'>;

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { signUpWithEmail } = useSupabaseAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <EmailPasswordFields
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            busy={busy}
            emailTestID="onboarding:signup:email:input"
            passwordTestID="onboarding:signup:password:input"
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
