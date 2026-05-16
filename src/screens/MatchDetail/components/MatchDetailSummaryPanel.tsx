import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Switch, Text, View } from 'react-native';
import { PillButton } from '../../../components/PillButton';
import { PostMatchInlineWizard } from '../../../components/PostMatchInlineWizard';
import { RsvpOptionButton } from '../../../components/RsvpOptionButton';
import type { GroupsStackParamList, HomeStackParamList, MyMatchesStackParamList } from '../../../navigation/types';
import { useTheme } from '../../../theme/ThemeContext';
import type { Match, Player, RSVPStatus, SelfReportRequest } from '../../../types/domain';
import type { EffectiveStatus } from '../../../utils/matchEffectiveStatus';
import { hasAssignedLineup } from '../../../utils/matchRoster';
import { isRemoteMatchId } from '../../../utils/matchId';
import { useMatchDetailStyles } from '../matchDetailStyles';

type MatchStacks = HomeStackParamList & MyMatchesStackParamList & GroupsStackParamList;
type Nav = NativeStackNavigationProp<MatchStacks>;

type Props = {
  match: Match;
  navigation: Nav;
  isOrganizer: boolean;
  canManageMatch: boolean;
  userOnMatchLineup: boolean;
  showFinishedRatingsChrome: boolean;
  ratingHints: { peer: boolean; motm: boolean };
  actionablePending: SelfReportRequest[];
  getPlayer: (id: string) => Player | undefined;
  onRespondSelfReport: (reportId: string, approved: boolean) => void;
  openRsvp: () => void;
  onAddSelfReport: (kind: 'goal' | 'assist') => void;
  pastScheduledEnd: boolean;
  onUnlockLineup: () => void;
  openCancelConfirm: () => void;
  onSetSelfReportEnabled: (enabled: boolean) => void;
  /** Kullanıcının kendi katılım durumu; katılımcı değilse null */
  currentUserRsvp: RSVPStatus | null;
  effectiveStatus: EffectiveStatus;
  showInlineWizard: boolean;
  onWizardCompleted: () => void;
  currentUserId: string;
};

export function MatchDetailSummaryPanel({
  match,
  navigation,
  isOrganizer,
  canManageMatch,
  userOnMatchLineup,
  showFinishedRatingsChrome,
  ratingHints,
  actionablePending,
  getPlayer,
  onRespondSelfReport,
  openRsvp,
  onAddSelfReport,
  pastScheduledEnd,
  onUnlockLineup,
  openCancelConfirm,
  onSetSelfReportEnabled,
  currentUserRsvp,
  effectiveStatus,
  showInlineWizard,
  onWizardCompleted,
  currentUserId,
}: Props) {
  const matchId = match.id;
  const { colors } = useTheme();
  const styles = useMatchDetailStyles();

  return (
    <>
      {showInlineWizard ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maç Sonucu</Text>
          <PostMatchInlineWizard
            match={match}
            canManageMatch={canManageMatch}
            currentUserId={currentUserId}
            onCompleted={onWizardCompleted}
          />
        </View>
      ) : null}

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

      {isOrganizer && match.status !== 'cancelled' && effectiveStatus === 'upcoming' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yönetim</Text>
          <View style={styles.rowWrap}>
            {effectiveStatus === 'upcoming' && match.lineupLocked ? (
              <PillButton
                title="Kilidi kaldır"
                variant="secondary"
                onPress={onUnlockLineup}
                style={styles.flex}
                testID="match:lineup:unlock:press"
              />
            ) : null}
            {!match.lineupLocked && effectiveStatus === 'upcoming' ? (
              <PillButton
                title={hasAssignedLineup(match) ? 'Kadroyu düzenle' : 'Kadro Kur'}
                onPress={() => navigation.navigate('LineupBuilder', { matchId })}
                style={styles.flex}
                testID="match:lineup:builder:press"
              />
            ) : null}
            {canManageMatch && effectiveStatus === 'upcoming' && isRemoteMatchId(match.id) ? (
              <PillButton
                title="Maç Detaylarını Düzenle"
                variant="secondary"
                onPress={() => navigation.navigate('EditMatch', { matchId })}
                style={styles.fullRow}
                testID="match:edit-details:press"
              />
            ) : null}
            {effectiveStatus === 'upcoming' ? (
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
          {effectiveStatus === 'upcoming' ? (
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
          ) : null}
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
              onPress={() => navigation.navigate('MatchRatingFlow', { matchId })}
              testID="match:ratings:cta:press"
              style={styles.mt}
            />
          ) : null}
        </View>
      ) : null}

      {actionablePending.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Taslak bildirimler{actionablePending.length > 0 ? ` (${actionablePending.length})` : ''}
          </Text>
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

      {match.selfReportEnabled && effectiveStatus === 'ongoing' && currentUserRsvp === 'going' ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maç İstatistikleri</Text>
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
        </View>
      ) : null}
    </>
  );
}
