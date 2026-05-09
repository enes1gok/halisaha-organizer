import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { User } from '@supabase/supabase-js';
import { colors, spacing, typography } from '../../theme';
import { isEmailVerified } from '../../utils/emailVerification';
import { maskIban } from '../../utils/iban';
import type { Player } from '../../types/domain';

type Props = {
  configured: boolean;
  user: User | null | undefined;
  player: Player;
};

export function ProfileAccountSection({ configured, user, player }: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Hesap
      </Text>
      {configured && user ? (
        <Text
          style={isEmailVerified(user) ? styles.emailOk : styles.emailWarn}
          testID="profile:main:email-verification:status"
        >
          {isEmailVerified(user) ? 'E-posta doğrulandı' : 'E-posta henüz doğrulanmadı'}
        </Text>
      ) : null}
      {player.iban ? (
        <View style={styles.ibanBlock}>
          <Text style={styles.ibanLbl}>IBAN&apos;ım</Text>
          <Text style={styles.ibanVal}>{maskIban(player.iban)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emailOk: {
    ...typography.body,
    color: colors.accent,
  },
  emailWarn: {
    ...typography.body,
    color: colors.danger,
  },
  ibanBlock: {
    marginTop: spacing.xs,
    gap: 4,
  },
  ibanLbl: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ibanVal: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
});
