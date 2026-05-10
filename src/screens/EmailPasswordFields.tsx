import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import { onboardingAuthStyles as styles } from './onboardingAuthStyles';

type Props = {
  email: string;
  password: string;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  busy: boolean;
  emailTestID: string;
  passwordTestID: string;
  /** Defaults to onboarding:password-visibility:toggle */
  passwordVisibilityTestID?: string;
};

export function EmailPasswordFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  busy,
  emailTestID,
  passwordTestID,
  passwordVisibilityTestID = 'onboarding:password-visibility:toggle',
}: Props) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <>
      <Text style={styles.label}>E-posta</Text>
      <TextInput
        style={styles.input}
        placeholder="ornek@eposta.com"
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={onEmailChange}
        editable={!busy}
        testID={emailTestID}
        accessibilityLabel="E-posta"
      />

      <Text style={styles.label}>Şifre</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInputFlex}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!passwordVisible}
          value={password}
          onChangeText={onPasswordChange}
          editable={!busy}
          testID={passwordTestID}
          accessibilityLabel="Şifre"
        />
        <Pressable
          style={styles.passwordToggle}
          onPress={() => setPasswordVisible((v) => !v)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={passwordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          accessibilityState={{ selected: passwordVisible }}
          testID={passwordVisibilityTestID}
          hitSlop={4}
        >
          <Ionicons
            name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
    </>
  );
}
