import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import type { OnboardingStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';
import { EmailPasswordFields } from './EmailPasswordFields';
import { onboardingAuthStyles as styles } from './onboardingAuthStyles';

type Nav = StackNavigationProp<OnboardingStackParamList, 'SignUp'>;

export function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { signUpWithEmail } = useSupabaseAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      Alert.alert('Kayıt', 'Lütfen isim ve soyisim girin.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Kayıt', 'Lütfen e-posta ve şifre girin.');
      return;
    }
    const displayName = `${fn} ${ln}`;
    setBusy(true);
    const { error, sessionCreated } = await signUpWithEmail(email, password, displayName);
    setBusy(false);
    if (error) {
      Alert.alert('Kayıt', error.message);
    } else if (sessionCreated) {
      Alert.alert('Kayıt', 'Hesabınız hazır. Hoş geldiniz!');
    } else {
      Alert.alert(
        'Kayıt',
        'Hesabınız oluşturuldu. E-postanızdaki doğrulama bağlantısına tıklayarak giriş yapabilirsiniz.',
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
          <Text style={[styles.label, { marginTop: 0 }]}>İsim</Text>
          <TextInput
            style={styles.input}
            placeholder="Adınız"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={firstName}
            onChangeText={setFirstName}
            editable={!busy}
            testID="onboarding:signup:firstname:input"
            accessibilityLabel="İsim"
          />
          <Text style={styles.label}>Soyisim</Text>
          <TextInput
            style={styles.input}
            placeholder="Soyadınız"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={lastName}
            onChangeText={setLastName}
            editable={!busy}
            testID="onboarding:signup:lastname:input"
            accessibilityLabel="Soyisim"
          />
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
