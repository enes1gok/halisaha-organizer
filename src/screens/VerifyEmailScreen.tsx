import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { colors, spacing, typography } from '../theme';
import { onboardingAuthStyles as styles } from './onboardingAuthStyles';

type Nav = StackNavigationProp<OnboardingStackParamList, 'VerifyEmail'>;
type VerifyRoute = RouteProp<OnboardingStackParamList, 'VerifyEmail'>;

const RESEND_COOLDOWN_SEC = 45;

export function VerifyEmailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<VerifyRoute>();
  const insets = useSafeAreaInsets();
  const { resendSignupConfirmationEmail } = useSupabaseAuth();
  const email = route.params.email;

  const [resendBusy, setResendBusy] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const startCooldown = useCallback(() => {
    setCooldownSec(RESEND_COOLDOWN_SEC);
  }, []);

  const handleResend = async () => {
    if (cooldownSec > 0) return;
    setResendBusy(true);
    const { error } = await resendSignupConfirmationEmail(email);
    setResendBusy(false);
    if (error) {
      Alert.alert('E-posta', error.message);
      return;
    }
    startCooldown();
    Alert.alert('E-posta', 'Doğrulama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.');
  };

  const openMailApp = async () => {
    const url = `mailto:${encodeURIComponent(email)}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {
      /* ignore */
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
          <Text style={styles.subtitle}>
            Hesabınız oluşturuldu. Giriş yapabilmek için gelen kutunuzdaki doğrulama bağlantısına
            tıklayın. Bağlantı uygulamayı açtığında oturumunuz açılır.
          </Text>

          <Text style={styles.label}>E-posta</Text>
          <Text
            style={emailText}
            selectable
            testID="onboarding:verify-email:address"
            accessibilityLabel={`Doğrulanacak e-posta ${email}`}
          >
            {email}
          </Text>

          <View style={styles.actions}>
            <PillButton
              title={
                cooldownSec > 0
                  ? `Yeniden gönder (${cooldownSec} sn)`
                  : 'Doğrulama e-postasını yeniden gönder'
              }
              loading={resendBusy}
              disabled={resendBusy || cooldownSec > 0}
              onPress={() => void handleResend()}
              testID="onboarding:verify-email:resend:press"
              accessibilityLabel="Doğrulama e-postasını yeniden gönder"
            />
            <PillButton
              title="Giriş yap"
              variant="ghost"
              onPress={() => navigation.navigate('SignIn', { prefilledEmail: email })}
              testID="onboarding:verify-email:goto-signin:press"
              accessibilityLabel="Giriş yap sayfasına git"
            />
            <Pressable
              onPress={() => void openMailApp()}
              accessibilityRole="button"
              accessibilityLabel="E-posta uygulamasını aç"
              testID="onboarding:verify-email:open-mail:press"
              style={mailLink}
            >
              <Text style={styles.footerLinkAccent}>E-posta uygulamasını aç</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const emailText = {
  ...typography.body,
  color: colors.text,
  fontFamily: 'Inter_600SemiBold' as const,
};

const mailLink = {
  minHeight: 44,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  paddingVertical: spacing.xs,
};
