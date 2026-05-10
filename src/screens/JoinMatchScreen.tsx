import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { colors, spacing, typography } from '../theme';
import { useMatchesStore } from '../store';
import { isAppError } from '../services/supabase/errors';
import type { HomeStackParamList } from '../navigation/types';
import { useUserFeedback } from '../utils/userFeedback';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'JoinMatch'>;

export function JoinMatchScreen() {
  const navigation = useNavigation<Nav>();
  const joinMatchByJoinCode = useMatchesStore((s) => s.joinMatchByJoinCode);
  const { showValidationToast, showToast, showUserFacingError } = useUserFeedback();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      showValidationToast('Eksik bilgi', 'Katılım kodunu girin.');
      return;
    }
    setBusy(true);
    try {
      const m = await joinMatchByJoinCode(trimmed);
      if (!m) {
        showToast({
          title: 'Bulunamadı',
          message: 'Bu koda ait yaklaşan bir maç yok.',
          variant: 'warning',
        });
        return;
      }
      navigation.replace('MatchDetail', { matchId: m.id });
    } catch (e) {
      if (isAppError(e) && e.code === 'NOT_FOUND') {
        showToast({
          title: 'Bulunamadı',
          message: 'Bu koda ait yaklaşan bir maç bulunamadı.',
          variant: 'warning',
        });
        return;
      }
      showUserFacingError(e, {
        uiOperation: 'JoinMatchScreen.submit',
        fallbackMessage: 'Katılım başarısız.',
        mapOperation: 'joinMatchByJoinCode',
      });
    } finally {
      setBusy(false);
    }
  }, [code, joinMatchByJoinCode, navigation, showToast, showUserFacingError, showValidationToast]);

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
