import * as Clipboard from 'expo-clipboard';
import React, { useCallback } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { colors, radius, spacing, typography } from '../theme';
import type { Match, Player } from '../types/domain';
import { formatMatchDateTimeWithWeekday } from '../utils/dates';
import { maskIban } from '../utils/iban';
import { countGoalkeepersAmongGoing, rosterMissingSlots } from '../utils/matchRoster';

type Props = {
  match: Match | null;
  goingCount: number;
  organizerName?: string;
  /** Kullanıcı bu maç için ödeme yaptıysa ana ekranda IBAN gösterilmez */
  userHasPaid?: boolean;
  getPlayer: (id: string) => Player | undefined;
  onOpenDetail: () => void;
};

export function HomeUpcomingHeroCard({
  match,
  goingCount,
  organizerName,
  userHasPaid,
  getPlayer,
  onOpenDetail,
}: Props) {
  const { label: ibanBtnLabel, runCopy: runIbanCopy, isCopied: ibanCopied } = useClipboardCopyFeedback({
    idleLabel: 'Kopyala',
  });
  const { label: organizerBtnLabel, runCopy: runOrganizerCopy, isCopied: organizerCopied } =
    useClipboardCopyFeedback({ idleLabel: 'Kopyala' });

  const onPressCopyIban = useCallback(() => {
    runIbanCopy(async () => {
      if (!match?.iban) return false;
      await Clipboard.setStringAsync(match.iban.replace(/\s/g, ''));
    });
  }, [runIbanCopy, match?.iban]);

  const onPressCopyOrganizer = useCallback(() => {
    const name = (organizerName ?? '').trim();
    if (!name) {
      Alert.alert('Kopyalanamadı', 'Organizatör adı bulunamadı.');
      return;
    }
    runOrganizerCopy(async () => {
      await Clipboard.setStringAsync(name);
    });
  }, [runOrganizerCopy, organizerName]);

  const copyRowProps =
    Platform.OS === 'android' ? ({ collapsable: false } as const) : {};

  if (!match) {
    return (
      <View style={styles.outer}>
        <View style={styles.card}>
          <View style={styles.emptyInner}>
            <Text style={[typography.body, styles.tabTitle]}>Önümüzdeki maç</Text>
            <Text style={[typography.subtitle, styles.placeholderBody, styles.placeholderTitle]}>
              Yaklaşan maç yok
            </Text>
            <Text style={[typography.body, styles.muted, styles.emptyHint]}>
              Katılım kodu ile maça katılabilir veya yeni maç oluşturabilirsiniz.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const missing = rosterMissingSlots(match, goingCount);
  const gkCount = countGoalkeepersAmongGoing(match, getPlayer);
  const gkMissing = gkCount === 0;

  const priceFormatted =
    (match.pricePerPerson ?? 0) > 0
      ? `Kişi başı ₺${match.pricePerPerson!.toLocaleString('tr-TR', {
          maximumFractionDigits: 2,
          minimumFractionDigits: Number.isInteger(match.pricePerPerson!) ? 0 : 2,
        })}`
      : null;

  const priceInHeader = priceFormatted ? (
    <Text style={[typography.body, styles.priceInHeader]}>{priceFormatted}</Text>
  ) : null;

  const ibanLine =
    userHasPaid ? null : match.iban ? (
      <View style={[styles.copyRow, styles.afterTitle]} {...copyRowProps}>
        <Text style={[typography.body, styles.ibanMasked]} numberOfLines={2}>
          {maskIban(match.iban)}
        </Text>
        <Pressable
          onPress={onPressCopyIban}
          style={({ pressed }) => [styles.copyBtn, pressed && styles.copyBtnPressed]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={ibanCopied ? 'Kopyalandı' : 'IBAN\'ı panoya kopyala'}
        >
          <Text
            style={[styles.copyBtnText, ibanCopied && styles.copyBtnTextCopied]}
            accessibilityLiveRegion="polite"
          >
            {ibanBtnLabel}
          </Text>
        </Pressable>
      </View>
    ) : (
      <Text style={[typography.body, styles.muted, styles.afterTitle, styles.ibanMissing]}>
        IBAN eklenmemiş
      </Text>
    );

  const organizerLine = (
    <View style={[styles.copyRow, styles.organizerSlot]} {...copyRowProps}>
      <Text style={[typography.subtitle, styles.orgName, styles.orgNameLg]} numberOfLines={2}>
        {organizerName ?? 'Organizatör'}
      </Text>
      <Pressable
        onPress={onPressCopyOrganizer}
        style={({ pressed }) => [styles.copyBtn, pressed && styles.copyBtnPressed]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={organizerCopied ? 'Kopyalandı' : 'Organizatör adını panoya kopyala'}
      >
        <Text
          style={[styles.copyBtnText, organizerCopied && styles.copyBtnTextCopied]}
          accessibilityLiveRegion="polite"
        >
          {organizerBtnLabel}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.outer}>
      <View style={styles.card}>
        <View style={styles.headerSection}>
          <Text style={[typography.body, styles.tabTitle]}>Önümüzdeki maç</Text>
          {ibanLine}
          {organizerLine}
          {priceInHeader}
        </View>

        <Pressable
          onPress={onOpenDetail}
          style={({ pressed }) => [styles.bodySection, pressed && styles.bodyPressed]}
          android_ripple={{ color: colors.accentMuted }}
        >
          <Text style={styles.venue} numberOfLines={2}>
            {match.venue}
          </Text>
          <Text style={[typography.body, styles.dateMuted]}>
            {formatMatchDateTimeWithWeekday(match.startsAt)}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[typography.body, styles.slotCount]}>
              {goingCount}/{match.maxPlayers} onaylı
            </Text>
          </View>

          {missing > 0 ? (
            <Text style={[typography.body, styles.warn]}>{missing} kişi eksik</Text>
          ) : null}

          {gkMissing ? (
            <Text style={[typography.body, styles.gkAlert]}>Kaleci eksiği — kaleci yok</Text>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 200,
  },
  emptyInner: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'stretch',
  },
  bodySection: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyHint: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  tabTitle: {
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textAlign: 'center',
    alignSelf: 'stretch',
    fontSize: 16,
  },
  placeholderBody: {
    color: colors.text,
    marginTop: 2,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  placeholderTitle: {
    fontSize: 19,
  },
  orgName: {
    color: colors.text,
    textAlign: 'left',
    flex: 1,
    minWidth: 0,
  },
  orgNameLg: {
    fontSize: 19,
  },
  afterTitle: {
    marginTop: spacing.sm,
  },
  priceInHeader: {
    ...typography.body,
    fontSize: 16,
    marginTop: spacing.sm,
    textAlign: 'left',
    alignSelf: 'stretch',
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    zIndex: 1,
  },
  organizerSlot: {
    marginTop: spacing.md,
  },
  ibanMasked: {
    color: colors.accent,
    textAlign: 'left',
    fontSize: 16,
    flex: 1,
    minWidth: 0,
  },
  copyBtn: {
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 106, 0.45)',
    backgroundColor: 'rgba(0, 210, 106, 0.14)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexShrink: 0,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBtnPressed: {
    opacity: 0.82,
    backgroundColor: 'rgba(0, 210, 106, 0.22)',
  },
  copyBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#8CF0C0',
  },
  copyBtnTextCopied: {
    color: colors.copyFeedbackLight,
  },
  ibanMissing: {
    textAlign: 'left',
  },
  muted: {
    color: colors.textMuted,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  bodyPressed: {
    opacity: 0.92,
  },
  venue: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  dateMuted: {
    ...typography.body,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  metaRow: {
    marginTop: spacing.md,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  slotCount: {
    ...typography.body,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  warn: {
    ...typography.body,
    fontSize: 16,
    color: colors.accent,
    marginTop: spacing.md,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  gkAlert: {
    ...typography.body,
    fontSize: 16,
    color: colors.position.GK,
    marginTop: spacing.sm,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
