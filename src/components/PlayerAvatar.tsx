import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme';

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
  const initials = useMemo(() => initialsFromName(name), [name]);
  const s = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, s]}>
      {uri ? (
        <Image source={{ uri }} style={[s, styles.img]} />
      ) : (
        <View style={[s, styles.fallback]}>
          <Text style={[typography.caption, styles.initials]}>{initials}</Text>
        </View>
      )}
      {showPaid ? (
        <View style={styles.paidDot}>
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
  img: {
    backgroundColor: colors.surface,
  },
  fallback: {
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.text,
    fontWeight: '700',
  },
  paidDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  check: {
    color: '#0A0A0A',
    fontSize: 10,
    fontWeight: '900',
  },
});
