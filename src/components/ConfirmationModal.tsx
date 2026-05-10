import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { PillButton } from './PillButton';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** İkinci satır: uyarı ikonu + vurgulu metin (ör. geri alınamaz işlemler). */
  destructiveHint?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export function ConfirmationModal({
  visible,
  title,
  message,
  destructiveHint,
  confirmLabel,
  cancelLabel = 'Vazgeç',
  onConfirm,
  onCancel,
  danger,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={[typography.subtitle, styles.title]}>{title}</Text>
          <Text style={[typography.body, styles.msg]}>{message}</Text>
          {destructiveHint ? (
            <View
              style={styles.destructiveRow}
              accessibilityRole="text"
              accessibilityLabel={destructiveHint}
            >
              <Ionicons name="warning" size={20} color={colors.danger} accessibilityElementsHidden />
              <Text style={styles.destructiveHint}>{destructiveHint}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <PillButton title={cancelLabel} variant="ghost" onPress={onCancel} style={styles.flex} />
            <PillButton
              title={confirmLabel}
              variant={danger ? 'danger' : 'accent'}
              onPress={() => {
                onConfirm();
              }}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: spacing.md,
    },
    title: {
      color: t.colors.text,
    },
    msg: {
      color: t.colors.textMuted,
    },
    destructiveRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 77, 77, 0.35)',
      backgroundColor: 'rgba(255, 77, 77, 0.08)',
    },
    destructiveHint: {
      ...typography.body,
      flex: 1,
      color: t.colors.danger,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    flex: {
      flex: 1,
    },
  }),
);
