import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { colors, spacing, typography } from '../theme';
import { useAppStore } from '../store/useAppStore';
import type { HomeStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<HomeStackParamList, 'JoinMatch'>;

export function JoinMatchScreen() {
  const navigation = useNavigation<Nav>();
  const joinMatchByJoinCode = useAppStore((s) => s.joinMatchByJoinCode);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert('Eksik bilgi', 'Katılım kodunu girin.');
      return;
    }
    setBusy(true);
    try {
      const m = joinMatchByJoinCode(trimmed);
      if (!m) {
        Alert.alert('Bulunamadı', 'Bu koda ait yaklaşan bir maç yok.');
        return;
      }
      navigation.replace('MatchDetail', { matchId: m.id });
    } finally {
      setBusy(false);
    }
  }, [code, joinMatchByJoinCode, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[typography.body, styles.intro]}>
        Organizatörün paylaştığı katılım kodunu girin (ör. HS-KDK1).
      </Text>
      <Text style={[typography.caption, styles.label]}>Katılım kodu</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="HS-XXXX"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.input}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <PillButton title="Katıl" onPress={onSubmit} loading={busy} disabled={busy} />
      <View style={styles.spacer} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  intro: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.md,
  },
});
