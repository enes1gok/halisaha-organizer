import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useGroupsStore } from '../store';
import { colors, spacing, typography } from '../theme';
import type { GroupsStackParamList } from '../navigation/types';

type Nav = StackNavigationProp<GroupsStackParamList, 'CreateGroup'>;

export function CreateGroupScreen() {
  const navigation = useNavigation<Nav>();
  const createGroup = useGroupsStore((s) => s.createGroup);
  const [name, setName] = useState('');

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Eksik bilgi', 'Grup adini gir.');
      return;
    }
    try {
      const group = await createGroup(name.trim());
      Alert.alert('Grup olusturuldu', `Katilim kodu: ${group.joinCode}`);
      navigation.replace('GroupDetail', { groupId: group.id });
    } catch (error) {
      Alert.alert('Hata', error instanceof Error ? error.message : 'Grup olusturulamadi.');
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.label}>Grup adi</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Orn. Cuma Aksamcilar"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="groups:create:name"
        accessibilityLabel="Grup adi"
      />
      <PillButton title="Olustur" onPress={() => void onCreate()} testID="groups:create:submit" />
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
