import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyStateHero } from './emptyIllustrations';
import { PressableScale } from './PressableScale';
import { rsvpStatusIcon, rsvpStatusLeftBorder } from './rsvpUserIndicator';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { letterSpacing, radius, shadows, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import type { Match, Player, RSVPStatus } from '../types/domain';
import { formatMatchDateTimeWithWeekday } from '../utils/dates';
import { maskIban } from '../utils/iban';
import { countGoalkeepersAmongGoing, rosterMissingSlots } from '../utils/matchRoster';
import { useUserFeedback } from '../utils/userFeedback';

type Props = {
  match: Match | null;
  goingCount: number;
  /** Kullanıcının katılım durumu; MatchCard ile aynı sol şerit ve ikon */
  userRsvp?: RSVPStatus | null;
  /** Kullanıcı bu maç için ödeme yaptıysa ana ekranda IBAN gösterilmez */
  userHasPaid?: boolean;
  getPlayer: (id: string) => Player | undefined;
  onOpenDetail: () => void;
};

export function HomeUpcomingHeroCard({
  match,
  goingCount,
  userRsvp,
  userHasPaid,
  getPlayer,
  onOpenDetail,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { showValidationToast } = useUserFeedback();
  const { label: ibanBtnLabel, runCopy: runIbanCopy, isCopied: ibanCopied } = useClipboardCopyFeedback({
    idleLabel: 'Kopyala',
  });
  const { label: nameBtnLabel, runCopy: runNameCopy, isCopied: nameCopied } = useClipboardCopyFeedback({
    idleLabel: 'Kopyala',
  });

  const onPressCopyIban = useCallback(() => {
    runIbanCopy(async () => {
      if (!match?.iban) return false;
      await Clipboard.setStringAsync(match.iban.replace(/\s/g, ''));
    });
  }, [runIbanCopy, match?.iban]);

  const onPressCopyIbanAccountName = useCallback(() => {
    const name = (match?.ibanAccountName ?? '').trim();
    if (!name) {
      showValidationToast('Kopyalanamadı', 'Alıcı adı bulunamadı.');
      return;
    }
    runNameCopy(async () => {
      await Clipboard.setStringAsync(name);
    });
  }, [runNameCopy, match?.ibanAccountName]);

  const copyRowProps =
    Platform.OS === 'android' ? ({ collapsable: false } as const) : {};

  if (!match) {
    return (
      <View style={styles.outer}>
        <View style={styles.card}>
          <View style={styles.emptyInner}>
            <EmptyStateHero variant="matches_upcoming" testID="home:upcoming:empty:hero" />
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

  const rsvpBorderExtra = userRsvp ? rsvpStatusLeftBorder(userRsvp, colors) : null;
  const rsvpIconSpec = userRsvp ? rsvpStatusIcon(userRsvp, colors) : null;

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
    userHasPaid ? null : match.paymentMethod === 'cash' ? (
      <Text style={[typography.body, styles.muted, styles.afterTitle, styles.ibanMissing]}>
        Ödeme nakit olarak sahada toplanacaktır.
      </Text>
    ) : match.paymentMethod === 'note_only' ? (
      <Text style={[typography.body, styles.muted, styles.afterTitle, styles.ibanMissing]}>
        {match.paymentNote ?? 'Ödeme notu eklenmemiş.'}
      </Text>
    ) : match.iban ? (
      <View style={styles.ibanPayBlock} {...copyRowProps}>
        <View style={[styles.copyRow, styles.afterTitle]}>
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
        {match.ibanAccountName?.trim() ? (
          <View style={[styles.copyRow, styles.nameRowAfterIban]}>
            <Text style={[typography.body, styles.ibanAccountNameText]} numberOfLines={2}>
              {match.ibanAccountName.trim()}
            </Text>
            <Pressable
              onPress={onPressCopyIbanAccountName}
              style={({ pressed }) => [styles.copyBtn, pressed && styles.copyBtnPressed]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={nameCopied ? 'Kopyalandı' : 'Alıcı adını panoya kopyala'}
            >
              <Text
                style={[styles.copyBtnText, nameCopied && styles.copyBtnTextCopied]}
                accessibilityLiveRegion="polite"
              >
                {nameBtnLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ) : (
      <Text style={[typography.body, styles.muted, styles.afterTitle, styles.ibanMissing]}>
        IBAN eklenmemiş
      </Text>
    );

  return (
    <View style={styles.outer}>
      <View style={[styles.card, rsvpBorderExtra]}>
        <View style={styles.headerSection}>
          <Text style={[typography.body, styles.tabTitle]}>Önümüzdeki maç</Text>
          {ibanLine}
          {priceInHeader}
        </View>

        <PressableScale
          onPress={onOpenDetail}
          style={styles.bodySection}
          android_ripple={{ color: colors.accentMuted }}
        >
          <View style={styles.venueRow}>
            {rsvpIconSpec ? (
              <View style={styles.rsvpIconWrap}>
                <Ionicons name={rsvpIconSpec.name} size={22} color={rsvpIconSpec.color} />
              </View>
            ) : null}
            <Text style={styles.venue} numberOfLines={2}>
              {match.venue}
            </Text>
          </View>
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
        </PressableScale>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    outer: {
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    card: {
      backgroundColor: t.colors.surfaceGlass,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      borderLeftWidth: 4,
      borderLeftColor: 'transparent',
      overflow: 'hidden',
      minHeight: 200,
      ...shadows.md,
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
      borderBottomColor: t.colors.glassBorder,
      backgroundColor: t.colors.surfaceSoft,
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
      color: t.colors.textMuted,
      marginBottom: spacing.sm,
      textAlign: 'center',
      alignSelf: 'stretch',
      fontSize: 16,
    },
    placeholderBody: {
      color: t.colors.text,
      marginTop: 2,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    placeholderTitle: {
      fontSize: 19,
    },
    ibanPayBlock: {
      alignSelf: 'stretch',
    },
    ibanAccountNameText: {
      color: t.colors.text,
      textAlign: 'left',
      flex: 1,
      minWidth: 0,
    },
    nameRowAfterIban: {
      marginTop: spacing.sm,
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
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: spacing.sm,
      zIndex: 1,
    },
    ibanMasked: {
      color: t.colors.accent,
      textAlign: 'left',
      fontSize: 16,
      flex: 1,
      minWidth: 0,
    },
    copyBtn: {
      borderWidth: 1,
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexShrink: 0,
      minWidth: 100,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copyBtnPressed: {
      opacity: 0.82,
      backgroundColor: t.colors.accentMuted,
    },
    copyBtnText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
      color: t.colors.accent,
    },
    copyBtnTextCopied: {
      color: t.colors.copyFeedbackLight,
    },
    ibanMissing: {
      textAlign: 'left',
    },
    venueRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: spacing.sm,
      alignSelf: 'stretch',
    },
    rsvpIconWrap: {
      marginTop: 4,
      justifyContent: 'center',
    },
    muted: {
      color: t.colors.textMuted,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    venue: {
      ...typography.headlineStrong,
      fontSize: 24,
      lineHeight: 30,
      color: t.colors.text,
      textAlign: 'center',
      alignSelf: 'stretch',
      letterSpacing: letterSpacing.wide,
    },
    dateMuted: {
      ...typography.body,
      fontSize: 16,
      color: t.colors.textMuted,
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
      color: t.colors.textMuted,
      textAlign: 'center',
    },
    warn: {
      ...typography.body,
      fontSize: 16,
      color: t.colors.accent,
      marginTop: spacing.md,
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    gkAlert: {
      ...typography.body,
      fontSize: 16,
      color: t.colors.position.GK,
      marginTop: spacing.sm,
      fontFamily: 'Inter_600SemiBold',
      textAlign: 'center',
      alignSelf: 'stretch',
    },
  }),
);
