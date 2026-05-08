import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useGroupsStore } from '../store';
import { shouldRetry, toUserMessage } from '../services/supabase/errors';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<GroupsStackParamList, 'CreateGroup'>;

const GROUP_NAME_MIN = 2;
const GROUP_NAME_MAX = 80;

export function CreateGroupScreen() {
  const navigation = useNavigation<Nav>();
  const createGroup = useGroupsStore((s) => s.createGroup);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const runCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < GROUP_NAME_MIN) {
      Alert.alert('Eksik bilgi', `Grup adı en az ${GROUP_NAME_MIN} karakter olmalı.`);
      return;
    }
    if (trimmed.length > GROUP_NAME_MAX) {
      Alert.alert('Eksik bilgi', `Grup adı en fazla ${GROUP_NAME_MAX} karakter olabilir.`);
      return;
    }

    setSubmitting(true);
    try {
      const { group, hydrateFailed } = await createGroup(trimmed);
      const goDetail = () => navigation.replace('GroupDetail', { groupId: group.id });
      if (hydrateFailed) {
        Alert.alert(
          'Grup oluşturuldu',
          `Katılım kodu: ${group.joinCode}\n\nListe yenilenemedi. Gruplar sekmesinde aşağı çekerek yenileyin.`,
          [{ text: 'Tamam', onPress: goDetail }],
        );
      } else {
        Alert.alert('Grup oluşturuldu', `Katılım kodu: ${group.joinCode}`, [{ text: 'Tamam', onPress: goDetail }]);
      }
    } catch (e) {
      const msg = toUserMessage(e, 'Grup oluşturulamadı.');
      const retryable = shouldRetry(e);
      Alert.alert('Grup oluşturulamadı', msg, [
        ...(retryable
          ? [
              { text: 'İptal', style: 'cancel' as const },
              { text: 'Tekrar dene', onPress: () => void runCreate() },
            ]
          : [{ text: 'Tamam', style: 'cancel' as const }]),
      ]);
    } finally {
      setSubmitting(false);
    }
  }, [createGroup, name, navigation]);

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
