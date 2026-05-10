import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { spacing, typography } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useOnboardingAuthStyles } from './onboardingAuthStyles';
import { useUserFeedback } from '../utils/userFeedback';

export function SetNewPasswordScreen() {
  const styles = useOnboardingAuthStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { completePasswordRecovery, signOut } = useSupabaseAuth();
  const { showValidationToast, showToast } = useUserFeedback();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const p = password.trim();
    const c = confirm.trim();
    if (!p || !c) {
      showValidationToast('Şifre', 'Lütfen yeni şifrenizi iki kez girin.');
      return;
    }
    if (p !== c) {
      showValidationToast('Şifre', 'Şifreler eşleşmiyor.');
      return;
    }
    setBusy(true);
    const { error } = await completePasswordRecovery(p);
    setBusy(false);
    if (error) {
      showToast({ title: 'Şifre', message: error.message, variant: 'error' });
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
          <Text style={[typography.subtitle, { color: colors.text, marginBottom: spacing.sm }]}>
            Yeni şifre belirleyin
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
            E-postadaki bağlantıyla geldiniz. Devam etmek için güçlü bir şifre seçin.
          </Text>

          <Text style={[styles.label, { marginTop: 0 }]}>Yeni şifre</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInputFlex}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              testID="auth:set-password:new:input"
              accessibilityLabel="Yeni şifre"
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setPasswordVisible((v) => !v)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Yeni şifreyi gizle' : 'Yeni şifreyi göster'}
              accessibilityState={{ selected: passwordVisible }}
              testID="onboarding:password-visibility:set-password-new"
              hitSlop={4}
            >
              <Ionicons
                name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <Text style={styles.label}>Şifre tekrar</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInputFlex}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!confirmVisible}
              value={confirm}
              onChangeText={setConfirm}
              editable={!busy}
              testID="auth:set-password:confirm:input"
              accessibilityLabel="Şifre tekrar"
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setConfirmVisible((v) => !v)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={confirmVisible ? 'Şifre tekrarı gizle' : 'Şifre tekrarı göster'}
              accessibilityState={{ selected: confirmVisible }}
              testID="onboarding:password-visibility:set-password-confirm"
              hitSlop={4}
            >
              <Ionicons
                name={confirmVisible ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textMuted}
              />
            </Pressable>
          </View>

          <View style={styles.actions}>
            <PillButton
              title="Şifreyi güncelle"
              loading={busy}
              disabled={busy}
              onPress={handleSubmit}
              testID="auth:set-password:submit:press"
              accessibilityLabel="Şifreyi güncelle"
            />
          </View>

          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Çıkış yap ve giriş ekranına dön"
            testID="auth:set-password:signout:press"
          >
            <Text style={styles.footerLink}>
              <Text style={styles.footerLinkAccent}>Çıkış yap</Text>
              {' — giriş ekranına dön'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
