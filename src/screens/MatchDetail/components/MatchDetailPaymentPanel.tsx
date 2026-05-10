import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PillButton } from '../../../components/PillButton';
import { PlayerAvatar } from '../../../components/PlayerAvatar';
import { PositionBadge } from '../../../components/PositionBadge';
import type { Attendee, Match, Player } from '../../../types/domain';
import { colors } from '../../../theme';
import { maskIban } from '../../../utils/iban';
import { matchDetailStyles as styles } from '../matchDetailStyles';

type Props = {
  match: Match;
  showPrice: boolean;
  showIbanPayment: boolean;
  showCashPayment: boolean;
  showNoteOnlyPayment: boolean;
  ibanCopyLabel: string;
  ibanCopied: boolean;
  onPressCopyIban: () => void;
  attendeesSorted: { a: Attendee; p: Player }[];
  isOrganizer: boolean;
  userId: string | undefined;
  onPressEditPaid: (playerId: string, playerName: string, nextPaid: boolean) => void;
};

export function MatchDetailPaymentPanel({
  match,
  showPrice,
  showIbanPayment,
  showCashPayment,
  showNoteOnlyPayment,
  ibanCopyLabel,
  ibanCopied,
  onPressCopyIban,
  attendeesSorted,
  isOrganizer,
  userId,
  onPressEditPaid,
}: Props) {
  const hasMatchPaymentInfo = showIbanPayment || showCashPayment || showNoteOnlyPayment;

  return (
    <>
      {showIbanPayment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme bilgisi</Text>
          {showPrice ? <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text> : null}
          {match.ibanAccountName ? <Text style={styles.body}>{match.ibanAccountName}</Text> : null}
          <Text style={styles.iban}>{maskIban(match.iban ?? '')}</Text>
          <PillButton
            title={ibanCopyLabel}
            onPress={onPressCopyIban}
            style={styles.mt}
            titleColor={ibanCopied ? colors.copyFeedbackLight : undefined}
            accessibilityLabel={ibanCopied ? 'Kopyalandı' : 'IBAN\'ı panoya kopyala'}
          />
        </View>
      ) : null}
      {showCashPayment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme bilgisi</Text>
          {showPrice ? <Text style={styles.muted}>Kişi başı ₺{match.pricePerPerson}</Text> : null}
          <Text style={styles.muted}>Ödeme nakit olarak sahada toplanacaktır.</Text>
        </View>
      ) : null}
      {showNoteOnlyPayment ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme bilgisi</Text>
          <Text style={styles.body}>{match.paymentNote ?? 'Not eklenmemiş.'}</Text>
        </View>
      ) : null}

      {!hasMatchPaymentInfo ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödeme bilgisi</Text>
          <Text style={styles.muted}>Bu maç için kayıtlı ödeme detayı yok.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Oyuncu ödemeleri</Text>
        {attendeesSorted.map(({ a, p }) => {
          const showPaidToggle = isOrganizer || p!.id === userId;
          return (
            <View key={a.playerId} style={styles.playerRow}>
              <PlayerAvatar name={p!.name} uri={p!.photoUri} showPaid={a.paid} />
              <View style={styles.playerMeta}>
                <Text style={styles.playerName}>{p!.name}</Text>
                <PositionBadge position={p!.position} />
              </View>
              <View style={styles.paidRow}>
                <Text style={styles.micro}>{a.paid ? 'Ödendi' : 'Ödenmedi'}</Text>
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
            </View>
          );
        })}
      </View>
    </>
  );
}
