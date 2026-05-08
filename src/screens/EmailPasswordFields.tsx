import React from 'react';
import { Text, TextInput } from 'react-native';
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
};

export function EmailPasswordFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  busy,
  emailTestID,
  passwordTestID,
}: Props) {
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
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={onPasswordChange}
        editable={!busy}
        testID={passwordTestID}
        accessibilityLabel="Şifre"
      />
    </>
  );
}
