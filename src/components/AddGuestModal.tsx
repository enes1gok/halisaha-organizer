import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import type { Position } from '../types/domain';
import { useMatchesStore } from '../store';
import { useUserFeedback } from '../utils/userFeedback';

const POSITIONS: { key: Position; label: string }[] = [
  { key: 'GK', label: 'KL' },
  { key: 'DEF', label: 'DF' },
  { key: 'MID', label: 'OS' },
  { key: 'FWD', label: 'SF' },
];

type Props = {
  visible: boolean;
  matchId: string;
  onClose: () => void;
  onAdded: () => void;
};

export function AddGuestModal({ visible, matchId, onClose, onAdded }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const addGuestAttendee = useMatchesStore((s) => s.addGuestAttendee);
  const { showApiErrorToast, showValidationToast } = useUserFeedback();

  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('MID');
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setName('');
    setPosition('MID');
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleAdd = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      showValidationToast('İsim gerekli', 'Lütfen oyuncunun adını girin.');
      return;
    }
    setLoading(true);
    try {
      await addGuestAttendee(matchId, trimmed, position);
      reset();
      onAdded();
    } catch (error) {
      showApiErrorToast(error, {
        uiOperation: 'addGuestAttendee',
        fallbackMessage: 'Misafir oyuncu eklenemedi.',
      });
    } finally {
      setLoading(false);
    }
  }, [name, position, matchId, addGuestAttendee, showApiErrorToast, showValidationToast, reset, onAdded]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Misafir Oyuncu Ekle</Text>
          <Text style={styles.subtitle}>Uygulamayı yüklememiş katılımcı</Text>

          <TextInput
            style={styles.input}
            placeholder="İsim Soyisim"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={64}
            returnKeyType="done"
            onSubmitEditing={handleAdd}
            editable={!loading}
            testID="addGuest:name:input"
          />

          <Text style={styles.positionLabel}>Pozisyon</Text>
          <View style={styles.positionRow}>
            {POSITIONS.map(({ key, label }) => (
              <Pressable
                key={key}
                style={[
                  styles.positionPill,
                  position === key && { backgroundColor: colors.accent },
                ]}
                onPress={() => setPosition(key)}
                disabled={loading}
                testID={`addGuest:position:${key}`}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text
                  style={[
                    styles.positionPillText,
                    position === key && { color: colors.background },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
              testID="addGuest:cancel:press"
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Vazgeç</Text>
            </Pressable>

            <Pressable
              style={[
                styles.addBtn,
                { backgroundColor: colors.accent },
                (loading || name.trim().length < 1) && styles.addBtnDisabled,
              ]}
              onPress={handleAdd}
              disabled={loading || name.trim().length < 1}
              testID="addGuest:confirm:press"
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={[styles.addBtnText, { color: colors.background }]}>Ekle</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    card: {
      width: '100%',
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      padding: spacing.lg,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
    },
    title: {
      ...typography.title,
      color: t.colors.text,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginBottom: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
      color: t.colors.text,
      backgroundColor: t.colors.background,
      minHeight: 44,
      marginBottom: spacing.md,
    },
    positionLabel: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginBottom: spacing.xs,
    },
    positionRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    positionPill: {
      flex: 1,
      minHeight: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    positionPillText: {
      ...typography.caption,
      color: t.colors.text,
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    cancelBtn: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cancelText: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    addBtn: {
      flex: 2,
      minHeight: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addBtnDisabled: {
      opacity: 0.4,
    },
    addBtnText: {
      ...typography.body,
      fontWeight: '600',
    },
  }),
);
