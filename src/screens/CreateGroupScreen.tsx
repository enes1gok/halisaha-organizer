import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useGroupsStore } from '../store';
import { shouldRetry } from '../services/supabase/errors';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';
import { useUserFeedback } from '../utils/userFeedback';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'CreateGroup'>;

const GROUP_NAME_MIN = 2;
const GROUP_NAME_MAX = 80;

export function CreateGroupScreen() {
  const navigation = useNavigation<Nav>();
  const { showToast, showValidationToast, showApiErrorToast } = useUserFeedback();
  const createGroup = useGroupsStore((s) => s.createGroup);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const runCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < GROUP_NAME_MIN) {
      showValidationToast('Eksik bilgi', `Grup adı en az ${GROUP_NAME_MIN} karakter olmalı.`);
      return;
    }
    if (trimmed.length > GROUP_NAME_MAX) {
      showValidationToast('Eksik bilgi', `Grup adı en fazla ${GROUP_NAME_MAX} karakter olabilir.`);
      return;
    }

    setSubmitting(true);
    try {
      const { group, hydrateFailed } = await createGroup(trimmed);
      if (hydrateFailed) {
        showToast({
          title: 'Grup oluşturuldu',
          message: `Katılım kodu: ${group.joinCode}\nListe yenilenemedi. Gruplar sekmesinde aşağı çekerek yenileyin.`,
          variant: 'warning',
          durationMs: 6000,
        });
      } else {
        showToast({
          title: 'Grup oluşturuldu',
          message: `Katılım kodu: ${group.joinCode}`,
        });
      }
      navigation.replace('GroupDetail', { groupId: group.id });
    } catch (e) {
      const retryable = shouldRetry(e);
      showApiErrorToast(e, {
        uiOperation: 'CreateGroupScreen:createGroup',
        fallbackMessage: 'Grup oluşturulamadı.',
        mapOperation: 'createGroupRemote',
        toastTitle: 'Grup oluşturulamadı',
        ...(retryable ? { retry: { onPress: () => void runCreate() } } : {}),
      });
    } finally {
      setSubmitting(false);
    }
  }, [createGroup, name, navigation, showApiErrorToast, showToast, showValidationToast]);

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Grup adi</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Orn. Cuma Aksamcilar"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        maxLength={GROUP_NAME_MAX}
        editable={!submitting}
        testID="groups:create:name"
        accessibilityLabel="Grup adi"
      />
      <PillButton
        title="Olustur"
        onPress={() => void runCreate()}
        loading={submitting}
        disabled={submitting}
        testID="groups:create:submit"
        accessibilityLabel="Grup olustur"
        accessibilityState={{ disabled: submitting }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm },
  label: { ...typography.caption, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
