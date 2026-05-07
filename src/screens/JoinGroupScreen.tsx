import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useAppStore } from '../store/useAppStore';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<GroupsStackParamList, 'JoinGroup'>;

export function JoinGroupScreen() {
  const navigation = useNavigation<Nav>();
  const joinGroup = useAppStore((s) => s.joinGroup);
  const [code, setCode] = useState('');

  const onJoin = async () => {
    if (!code.trim()) {
      Alert.alert('Eksik bilgi', 'Katilim kodunu gir.');
      return;
    }
    try {
      const group = await joinGroup(code);
      if (!group) {
        Alert.alert('Grup bulunamadi', 'Kodla eslesen aktif bir grup bulunamadi.');
        return;
      }
      navigation.replace('GroupDetail', { groupId: group.id });
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Gruba katilinamadi.');
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
