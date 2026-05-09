import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import type { OnboardingStackParamList } from '../navigation/types';
import { spacing } from '../theme';
import { isEmailNotConfirmedSignInError } from '../utils/emailVerification';
import { EmailPasswordFields } from './EmailPasswordFields';
import { onboardingAuthStyles as styles } from './onboardingAuthStyles';

type Nav = StackNavigationProp<OnboardingStackParamList, 'SignIn'>;
type SignInRoute = RouteProp<OnboardingStackParamList, 'SignIn'>;

export function SignInScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<SignInRoute>();
  const insets = useSafeAreaInsets();
  const { signInWithEmail, resendSignupConfirmationEmail } = useSupabaseAuth();

  const [email, setEmail] = useState(() => route.params?.prefilledEmail?.trim() ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = route.params?.prefilledEmail?.trim();
    if (p) setEmail(p);
  }, [route.params?.prefilledEmail]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Giriş', 'Lütfen e-posta ve şifre girin.');
      return;
    }
    setBusy(true);
    const { error } = await signInWithEmail(email, password);
    setBusy(false);
    if (!error) return;

    if (isEmailNotConfirmedSignInError(error.message)) {
      const trimmed = email.trim();
      Alert.alert(
        'Giriş',
        'Bu e-posta adresi henüz doğrulanmamış. Gelen kutunuzdaki bağlantıya tıklayın veya doğrulama e-postasını yeniden isteyin.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Doğrulama adımlarına git',
            onPress: () => navigation.navigate('VerifyEmail', { email: trimmed }),
          },
          {
            text: 'Tekrar gönder',
            onPress: () => {
              void (async () => {
                const { error: resendErr } = await resendSignupConfirmationEmail(trimmed);
                if (resendErr) {
                  Alert.alert('E-posta', resendErr.message);
                } else {
                  Alert.alert(
                    'E-posta',
                    'Doğrulama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.',
                  );
                }
              })();
            },
          },
        ],
      );
      return;
    }

    Alert.alert('Giriş', error.message);
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
            emailTestID="onboarding:signin:email:input"
            passwordTestID="onboarding:signin:password:input"
          />

          <View style={styles.actions}>
            <PillButton
              title="Giriş Yap"
              loading={busy}
              disabled={busy}
              onPress={handleSignIn}
              testID="onboarding:signin:submit:press"
              accessibilityLabel="Giriş yap"
            />
          </View>

          <Pressable
            onPress={() => navigation.navigate('SignUp')}
            accessibilityRole="button"
            accessibilityLabel="Kayıt ol sayfasına git"
            testID="onboarding:signin:goto-signup:press"
          >
            <Text style={styles.footerLink}>
              Hesabın yok mu?{' '}
              <Text style={styles.footerLinkAccent}>Kayıt ol</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
