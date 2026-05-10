import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BadgeTileVm } from '../../domain/badges';
import { radius, spacing, typography } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  badges: BadgeTileVm[];
};

export function ProfileBadgesModal({ visible, onClose, badges }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
      <View style={[styles.sheet, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Rozetler</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            testID="profile:badges:close"
          >
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {badges.map((b) => (
            <View
              key={b.id}
              style={[
                styles.row,
                { borderColor: colors.border },
                b.earned && { borderColor: colors.accent },
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{b.title}</Text>
                {b.earned ? (
                  <Ionicons name="ribbon" size={18} color={colors.accent} />
                ) : (
                  <Text style={[styles.pct, { color: colors.textMuted }]}>
                    %{Math.round(b.progress01 * 100)}
                  </Text>
                )}
              </View>
              <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{b.description}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '78%',
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      borderWidth: 1,
      paddingBottom: spacing.xl,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    sheetTitle: {
      ...typography.title,
      color: t.colors.text,
    },
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    row: {
      borderWidth: 1,
      borderRadius: radius.card,
      padding: spacing.md,
      gap: spacing.xs,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rowTitle: {
      ...typography.subtitle,
      flex: 1,
    },
    rowDesc: {
      ...typography.caption,
    },
    pct: {
      ...typography.micro,
    },
  }),
);
