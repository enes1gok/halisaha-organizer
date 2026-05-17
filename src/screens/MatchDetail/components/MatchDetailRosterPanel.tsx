import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PillButton } from '../../../components/PillButton';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { PositionBadge } from '../../../components/PositionBadge';
import type { Attendee, GuestAttendee, Match, Player } from '../../../types/domain';
import type { EffectiveStatus } from '../../../utils/matchEffectiveStatus';
import { makeStyles, useTheme } from '../../../theme/ThemeContext';
import { spacing, typography } from '../../../theme';
import { StyleSheet } from 'react-native';
import { maskIban } from '../../../utils/iban';
import { useMatchDetailStyles } from '../matchDetailStyles';

type Props = {
  match: Match;
  attendeesSorted: { a: Attendee; p: Player }[];
  motmWinnerIds: Set<string>;
  ratingByPid: Map<string, { avg: number | null; votes_count: number }>;
  isOrganizer: boolean;
  canAddGuest: boolean;
  userId: string | null | undefined;
  ibanCopyLabel: string;
  ibanCopied: boolean;
  onPressCopyIban: () => void;
  onPressEditPaid: (playerId: string, playerName: string, nextPaid: boolean) => void;
  onPressEditGuestPaid: (guestId: string, guestName: string, nextPaid: boolean) => void;
  onAddGuest: () => void;
  onRemoveGuest: (guestId: string, name: string) => void;
  effectiveStatus: EffectiveStatus;
  organizerName: string;
};

export function MatchDetailRosterPanel({
  match,
  attendeesSorted,
  motmWinnerIds,
  ratingByPid,
  isOrganizer,
  canAddGuest,
  userId,
  ibanCopyLabel,
  ibanCopied,
  onPressCopyIban,
  onPressEditPaid,
  onPressEditGuestPaid,
  onAddGuest,
  onRemoveGuest,
  effectiveStatus,
  organizerName,
}: Props) {
  const { colors } = useTheme();
  const styles = useMatchDetailStyles();
  const guestStyles = useGuestStyles();
  const guestAttendees: GuestAttendee[] = match.guestAttendees ?? [];

  const showPrice = (match.pricePerPerson ?? 0) > 0;
  const isIban = match.paymentMethod === 'iban' && Boolean(match.iban);
  const isCash = match.paymentMethod === 'cash';
  const isNoteOnly = match.paymentMethod === 'note_only';
  const showPaymentSection = isIban || isCash || isNoteOnly;

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organizatör</Text>
        <Text style={styles.body}>{organizerName}</Text>
      </View>

      {showPaymentSection && effectiveStatus === 'upcoming' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme bilgisi</Text>
          {showPrice ? <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text> : null}
          {isIban ? (
            <>
              {match.ibanAccountName ? (
                <Text style={styles.body}>{match.ibanAccountName}</Text>
              ) : null}
              <Text style={styles.iban}>{maskIban(match.iban ?? '')}</Text>
              <PillButton
                title={ibanCopyLabel}
                onPress={onPressCopyIban}
                style={styles.mt}
                titleColor={ibanCopied ? colors.copyFeedbackLight : undefined}
                accessibilityLabel={ibanCopied ? 'Kopyalandı' : "IBAN'ı panoya kopyala"}
              />
            </>
          ) : null}
          {isCash ? (
            <Text style={styles.muted}>Ödeme nakit olarak sahada toplanacaktır.</Text>
          ) : null}
          {isNoteOnly ? (
            <Text style={styles.body}>{match.paymentNote ?? 'Not eklenmemiş.'}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oyuncular</Text>
        {attendeesSorted.map(({ a, p }) => {
          const inMatchLineup =
            match.teamAIds.includes(a.playerId) || match.teamBIds.includes(a.playerId);
          const rr = inMatchLineup ? ratingByPid.get(a.playerId) : undefined;
          const showPaidToggle = isIban && effectiveStatus === 'upcoming' && (isOrganizer || p!.id === userId);

          return (
            <View key={a.playerId} style={styles.playerRow}>
              <PlayerAvatar
                name={p!.name}
                uri={p!.photoUri}
                showPaid={isIban ? a.paid : undefined}
              />
              <View style={styles.playerMeta}>
                <Text style={styles.playerName}>{p!.name}</Text>
                <View style={styles.badgesRow}>
                  <PositionBadge position={p!.position} />
                  {match.status === 'finished' && inMatchLineup && motmWinnerIds.has(a.playerId) ? (
                    <View style={styles.motmBadge}>
                      <Text style={styles.motmBadgeTxt}>Maçın adamı</Text>
                    </View>
                  ) : null}
                </View>
                {match.status === 'finished' && inMatchLineup ? (
                  <Text style={styles.micro}>
                    Oy ort.:{' '}
                    {rr && rr.votes_count > 0 && rr.avg != null
                      ? `${rr.avg.toFixed(1)} / 100`
                      : '—'}
                  </Text>
                ) : null}
              </View>
              {isIban ? (
                <View style={styles.paidRow}>
                  <Text
                    style={styles.micro}
                    accessibilityLabel={a.paid ? 'Ödendi' : 'Ödenmedi'}
                  >
                    {a.paid ? 'Ödendi' : 'Ödenmedi'}
                  </Text>
                  {showPaidToggle ? (
                    <Pressable
                      onPress={() => onPressEditPaid(p!.id, p!.name, !a.paid)}
                      style={styles.paymentEditBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`${p!.name} için ödeme durumunu güncelle`}
                      testID={`match:detail:payment:row:${p!.id}:edit`}
                    >
                      <Text style={styles.paymentEditLabel}>Güncelle</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {guestAttendees.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, guestStyles.guestHeader]}>Misafir Oyuncular</Text>
            {guestAttendees.map((g) => {
              const showGuestPaidToggle = isIban && effectiveStatus === 'upcoming' && isOrganizer;
              return (
                <View key={g.id} style={styles.playerRow}>
                  <PlayerAvatar
                    name={g.displayName}
                    uri={undefined}
                    showPaid={isIban ? g.paid : undefined}
                  />
                  <View style={styles.playerMeta}>
                    <Text style={styles.playerName}>{g.displayName}</Text>
                    <View style={styles.badgesRow}>
                      <PositionBadge position={g.position} />
                      <View style={guestStyles.guestBadge}>
                        <Text style={guestStyles.guestBadgeTxt}>Misafir</Text>
                      </View>
                    </View>
                  </View>
                  <View style={guestStyles.guestRight}>
                    {isIban ? (
                      <View style={styles.paidRow}>
                        <Text style={styles.micro}>{g.paid ? 'Ödendi' : 'Ödenmedi'}</Text>
                        {showGuestPaidToggle ? (
                          <Pressable
                            onPress={() => onPressEditGuestPaid(g.id, g.displayName, !g.paid)}
                            style={styles.paymentEditBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`${g.displayName} için ödeme durumunu güncelle`}
                            testID={`match:detail:guest:payment:${g.id}:edit`}
                          >
                            <Text style={styles.paymentEditLabel}>Güncelle</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                    {isOrganizer ? (
                      <Pressable
                        onPress={() => onRemoveGuest(g.id, g.displayName)}
                        style={guestStyles.removeBtn}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${g.displayName} misafiri kaldır`}
                        testID={`match:detail:guest:remove:${g.id}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </>
        ) : null}

        {canAddGuest ? (
          <PillButton
            title="+ Misafir Ekle"
            variant="ghost"
            onPress={onAddGuest}
            style={guestStyles.addGuestBtn}
            testID="match:detail:addGuest:press"
            accessibilityLabel="Misafir oyuncu ekle"
          />
        ) : null}
      </View>
    </>
  );
}

const useGuestStyles = makeStyles((t) =>
  StyleSheet.create({
    guestHeader: {
      marginTop: spacing.md,
    },
    guestBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.colors.border,
    },
    guestBadgeTxt: {
      ...typography.micro,
      color: t.colors.textMuted,
      fontWeight: '600',
    },
    guestRight: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    removeBtn: {
      minWidth: 32,
      minHeight: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addGuestBtn: {
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },
  }),
);
