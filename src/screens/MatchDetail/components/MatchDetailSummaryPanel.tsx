import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Switch, Text, View } from 'react-native';
import { PillButton } from '../../../components/PillButton';
import { RsvpOptionButton } from '../../../components/RsvpOptionButton';
import { formatRsvpStatusTr } from '../../../components/rsvpUserIndicator';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../../../navigation/types';
import { useTheme } from '../../../theme/ThemeContext';
import type { Match, Player, RSVPStatus, SelfReportRequest } from '../../../types/domain';
import { formatMatchDateTime } from '../../../utils/dates';
import { hasAssignedLineup } from '../../../utils/matchRoster';
import { isRemoteMatchId } from '../../../utils/matchId';
import { useMatchDetailStyles } from '../matchDetailStyles';

type MatchStacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type Nav = NativeStackNavigationProp<MatchStacks>;

type Props = {
  match: Match;
  navigation: Nav;
  organizerName: string;
  joinCopyLabel: string;
  joinCopied: boolean;
  onPressCopyJoin: () => void;
  isOrganizer: boolean;
  userOnMatchLineup: boolean;
  showFinishedRatingsChrome: boolean;
  ratingHints: { peer: boolean; motm: boolean };
  actionablePending: SelfReportRequest[];
  getPlayer: (id: string) => Player | undefined;
  onRespondSelfReport: (reportId: string, approved: boolean) => void;
  openRsvp: () => void;
  onAddSelfReport: (kind: 'goal' | 'assist') => void;
  pastScheduledEnd: boolean;
  endsAtIso: string;
  onUnlockLineup: () => void;
  openCancelConfirm: () => void;
  onSetSelfReportEnabled: (enabled: boolean) => void;
  /** Kullanıcının kendi katılım durumu; katılımcı değilse null */
  currentUserRsvp: RSVPStatus | null;
};

export function MatchDetailSummaryPanel({
  match,
  navigation,
  organizerName,
  joinCopyLabel,
  joinCopied,
  onPressCopyJoin,
  isOrganizer,
  userOnMatchLineup,
  showFinishedRatingsChrome,
  ratingHints,
  actionablePending,
  getPlayer,
  onRespondSelfReport,
  openRsvp,
  onAddSelfReport,
  pastScheduledEnd,
  endsAtIso,
  onUnlockLineup,
  openCancelConfirm,
  onSetSelfReportEnabled,
  currentUserRsvp,
}: Props) {
  const matchId = match.id;
  const { colors } = useTheme();
  const styles = useMatchDetailStyles();

  return (
    <>
      {match.status === 'finished' && match.result ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skor detayı</Text>
          {match.result.scorers.length === 0 &&
          match.result.assists.length === 0 &&
          (match.result.ownGoals ?? []).length === 0 ? (
            <Text style={styles.muted}>Oyuncu bazlı gol kaydı yok.</Text>
          ) : (
            <>
              {match.result.scorers.map((l) => (
                <Text key={`g-${l.playerId}`} style={styles.body}>
                  {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — Gol ×{l.count}
                </Text>
              ))}
              {(match.result.ownGoals ?? []).map((l) => (
                <Text key={`og-${l.playerId}`} style={styles.body}>
                  {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — KK ×{l.count}
                </Text>
              ))}
              {match.result.assists.map((l) => (
                <Text key={`a-${l.playerId}`} style={styles.body}>
                  {getPlayer(l.playerId)?.name ?? 'Oyuncu'} — Asist ×{l.count}
                </Text>
              ))}
            </>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organizatör</Text>
        <Text style={styles.body}>{organizerName}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Katılım kodu</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.code}>{match.joinCode}</Text>
          <PillButton
            title={joinCopyLabel}
            variant="ghost"
            onPress={onPressCopyJoin}
            titleColor={joinCopied ? colors.copyFeedbackLight : undefined}
            accessibilityLabel={joinCopied ? 'Kopyalandı' : 'Katılım kodunu panoya kopyala'}
          />
        </View>
      </View>

      {isRemoteMatchId(match.id) && userOnMatchLineup && !isOrganizer ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saha</Text>
          <Text style={styles.muted}>
            Skoru girmek veya takım arkadaşlarını değerlendirmek için maç sonrası ekranını kullanın.
          </Text>
          <PillButton
            title="Maç sonrası"
            onPress={() => navigation.navigate('MatchPostgame', { matchId })}
            style={styles.mt}
            disabled={!pastScheduledEnd}
            accessibilityState={{ disabled: !pastScheduledEnd }}
            testID="match:detail:postgame:player"
          />
          {!pastScheduledEnd ? (
            <Text style={[styles.muted, styles.mtXs]}>
              Tahmini bitiş ({formatMatchDateTime(endsAtIso)}) sonrası açılır.
            </Text>
          ) : null}
        </View>
      ) : null}

      {isOrganizer && match.status !== 'cancelled' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yönetim</Text>
          <View style={styles.rowWrap}>
            {match.status === 'upcoming' && match.lineupLocked ? (
              <PillButton
                title="Kilidi kaldır"
                variant="secondary"
                onPress={onUnlockLineup}
                style={styles.flex}
                testID="match:lineup:unlock:press"
              />
            ) : null}
            {!match.lineupLocked && match.status === 'upcoming' ? (
              <PillButton
                title={hasAssignedLineup(match) ? 'Kadroyu düzenle' : 'Kadro Kur'}
                onPress={() => navigation.navigate('LineupBuilder', { matchId })}
                style={styles.flex}
                testID="match:lineup:builder:press"
              />
            ) : null}
            {match.status !== 'finished' ? (
              <>
                <PillButton
                  title="Maç sonrası"
                  onPress={() => navigation.navigate('MatchPostgame', { matchId })}
                  variant="ghost"
                  style={styles.flex}
                  disabled={!pastScheduledEnd}
                  accessibilityState={{ disabled: !pastScheduledEnd }}
                  testID="match:detail:postgame:organizer"
                />
                {!pastScheduledEnd ? (
                  <Text style={[styles.muted, styles.fullRow, styles.mtXs]}>
                    Tahmini bitiş ({formatMatchDateTime(endsAtIso)}) sonrası açılır.
                  </Text>
                ) : null}
              </>
            ) : null}
            {match.status === 'upcoming' ? (
              <PillButton
                title="Maçı İptal Et"
                variant="danger"
                onPress={openCancelConfirm}
                style={styles.fullRow}
                accessibilityLabel="Maçı iptal et"
                testID="match:cancel:press"
              />
            ) : null}
          </View>
          <View style={styles.mt}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.body}>Oyuncular kendi bildirsin</Text>
                <Text style={styles.muted}>
                  Açıkken oyuncular maç sırasında kendi gol ve asistlerini bildirebilir; organizatör veya karşı takım onaylar.
                </Text>
              </View>
              <Switch
                value={match.selfReportEnabled}
                onValueChange={(v) => onSetSelfReportEnabled(v)}
                trackColor={{ false: colors.border, true: colors.accentMuted }}
                thumbColor={match.selfReportEnabled ? colors.accent : colors.textMuted}
              />
            </View>
          </View>
        </View>
      ) : null}

      {showFinishedRatingsChrome ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Derecelendirme</Text>
          <Text style={styles.muted}>
            Kadrodaki oyuncuların ortalama oyları listede gösterilir; bireysel oylar anonimdir. En çok seçilen maçın adamı
            vurgulanır.
          </Text>
          {userOnMatchLineup ? (
            <PillButton
              title={
                ratingHints.peer || ratingHints.motm ? 'Derecelendirmeyi düzenle' : 'Oyuncuları derecelendir'
              }
              onPress={() => navigation.navigate('MatchRatings', { matchId })}
              testID="match:ratings:cta:press"
              style={styles.mt}
            />
          ) : null}
        </View>
      ) : null}

      {actionablePending.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Taslak bildirimler</Text>
          <Text style={[styles.muted, styles.peerHint]}>
            Onaylanınca gol ve asist istatistiklere işlenir. Organizatör veya karşı takımdan biri onaylayabilir (akran
            onayı).
          </Text>
          {actionablePending.map((r) => {
            const p = getPlayer(r.playerId);
            return (
              <View key={r.id} style={styles.pendingRow}>
                <Text style={styles.body}>
                  {p?.name} — {r.type === 'goal' ? 'Gol' : 'Asist'}
                  <Text style={styles.draftTag}> · Taslak</Text>
                </Text>
                <View style={styles.row}>
                  <PillButton
                    title="Reddet"
                    variant="ghost"
                    onPress={() => onRespondSelfReport(r.id, false)}
                  />
                  <PillButton title="Onayla" onPress={() => onRespondSelfReport(r.id, true)} />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Katılım durumu</Text>
        {currentUserRsvp === 'going' ? (
          <RsvpOptionButton
            label="Gidiyorum"
            iconName="checkmark-circle"
            baseColor={colors.accent}
            textColorOnFill={colors.textOnAccent}
            isSelected={true}
            onPress={openRsvp}
          />
        ) : currentUserRsvp === 'maybe' ? (
          <RsvpOptionButton
            label="Belki"
            iconName="help-circle"
            baseColor={colors.text}
            textColorOnFill={colors.background}
            isSelected={true}
            onPress={openRsvp}
          />
        ) : currentUserRsvp === 'notGoing' ? (
          <RsvpOptionButton
            label="Gelmiyorum"
            iconName="close-circle"
            baseColor={colors.danger}
            textColorOnFill={colors.textOnAccent}
            isSelected={true}
            onPress={openRsvp}
          />
        ) : (
          <>
            <Text style={styles.muted}>
              Bu maçta katılımcı olarak görünmüyorsun; kod ile katıldıktan sonra durumunu buradan güncelleyebilirsin.
            </Text>
            <PillButton title="Katılım Durumu" onPress={openRsvp} />
          </>
        )}
        {match.selfReportEnabled && match.status !== 'finished' ? (
          <View style={styles.rowWrap}>
            <PillButton
              title="Gol Attım"
              variant="ghost"
              onPress={() => onAddSelfReport('goal')}
              style={styles.flex}
            />
            <PillButton
              title="Asist Yaptım"
              variant="ghost"
              onPress={() => onAddSelfReport('assist')}
              style={styles.flex}
            />
          </View>
        ) : null}
      </View>
    </>
  );
}
