import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme';
import { useTheme } from '../theme/ThemeContext';

function initialsFromName(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0] + p[p.length - 1]![0]).toUpperCase();
}

type Props = {
  name: string;
  uri?: string;
  size?: number;
  showPaid?: boolean;
};

export function PlayerAvatar({ name, uri, size = 40, showPaid }: Props) {
  const { colors } = useTheme();
  const initials = useMemo(() => initialsFromName(name), [name]);
  const s = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, s]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[s, { backgroundColor: colors.surface }]}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[s, styles.fallback, { backgroundColor: colors.border }]}>
          <Text style={[typography.caption, styles.initials, { color: colors.text }]}>{initials}</Text>
        </View>
      )}
      {showPaid ? (
        <View
          style={[styles.paidDot, { backgroundColor: colors.accent, borderColor: colors.background }]}
        >
          <Text style={styles.check}>✓</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
  paidDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  check: {
    color: '#0A0A0A',
    fontSize: 10,
    fontWeight: '900',
  },
});
