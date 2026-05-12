import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlayerAvatar } from './PlayerAvatar';
import { colors, radius, shadows, spacing, typography } from '../theme';
import type { Match, Player } from '../types/domain';
import { getMatchContribution } from '../utils/matchPlayerContribution';

type MotmEntry = { id: string; p: Player };

type Props = {
  match: Match;
  choices: MotmEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function MotmSelectorSection({ match, choices, selectedId, onSelect }: Props) {
  return (
    <View style={styles.container}>
      {choices.map(({ id, p }) => {
        const { goals, assists } = getMatchContribution(match, id);
        const parts: string[] = [];
        if (goals > 0) parts.push(`Gol ×${goals}`);
        if (assists > 0) parts.push(`Asist ×${assists}`);
        const on = selectedId === id;
        return (
          <Pressable
            key={`motm-${id}`}
            style={[styles.row, on && styles.rowOn]}
            onPress={() => onSelect(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Maçın adamı ${p.name}`}
            testID={`ratings:motm:${id}`}
          >
            <PlayerAvatar name={p.name} uri={p.photoUri} size={36} />
            <View style={styles.meta}>
              <Text style={styles.name}>{p.name}</Text>
              {parts.length > 0 ? (
                <Text style={styles.micro}>{parts.join(' · ')}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  rowOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  meta: { flex: 1, minWidth: 0 },
  name: { ...typography.body, color: colors.text, flexShrink: 1 },
  micro: { ...typography.micro, color: colors.textMuted },
});
