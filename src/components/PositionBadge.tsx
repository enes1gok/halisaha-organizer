import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Position } from '../types/domain';
import { colors, radius, typography } from '../theme';

const LABELS: Record<Position, string> = {
  GK: 'KL',
  DEF: 'DF',
  MID: 'OS',
  FWD: 'SF',
};

export function PositionBadge({ position }: { position: Position }) {
  return (
    <View style={[styles.wrap, { backgroundColor: colors.position[position] + '33' }]}>
      <Text style={[styles.txt, { color: colors.position[position] }]}>
        {LABELS[position]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  txt: {
    ...typography.micro,
    fontWeight: '700',
  },
});
