import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useGroupsStore } from '../store';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';
import { useUserFeedback } from '../utils/userFeedback';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'JoinGroup'>;

export function JoinGroupScreen() {
  const navigation = useNavigation<Nav>();
  const joinGroup = useGroupsStore((s) => s.joinGroup);
  const { showValidationToast, showToast, showApiErrorToast } = useUserFeedback();
  const [code, setCode] = useState('');

  const onJoin = async () => {
    if (!code.trim()) {
      showValidationToast('Eksik bilgi', 'Katilim kodunu gir.');
      return;
    }
    try {
      const group = await joinGroup(code);
      if (!group) {
        showToast({
          title: 'Grup bulunamadi',
          message: 'Kodla eslesen aktif bir grup bulunamadi.',
          variant: 'warning',
        });
        return;
      }
      navigation.replace('GroupDetail', { groupId: group.id });
    } catch (error) {
      showApiErrorToast(error, {
        uiOperation: 'JoinGroupScreen:join',
        fallbackMessage: 'Gruba katilinamadi.',
        mapOperation: 'joinGroupRemote',
      });
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Katilim kodu</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Orn. GRP123"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        style={styles.input}
        testID="groups:join:code"
        accessibilityLabel="Grup katilim kodu"
      />
      <PillButton title="Gruba Katil" onPress={() => void onJoin()} testID="groups:join:submit" />
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
