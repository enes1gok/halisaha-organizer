import * as Clipboard from 'expo-clipboard';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, AlertButton, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { MatchCard } from '../components/MatchCard';
import { MatchCardListRow } from '../components/MatchCardListRow';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { MatchCardSkeleton, SettingsSectionSkeleton, SkeletonList, SkeletonText } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { GroupsStackParamList } from '../navigation/types';
import { useAuthStore, useGroupsStore, useMatchesStore, usePlayersStore } from '../store';
import { colors, letterSpacing, radius, spacing, typography } from '../theme';
import { useUserFeedback } from '../utils/userFeedback';
import { countGoing } from '../utils/matchRoster';
import { isRemoteUuid } from '../utils/matchId';
import type { GroupRole } from '../types/domain';

type DetailRoute = RouteProp<GroupsStackParamList, 'GroupDetail'>;
type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupDetail'>;

function roleSortOrder(role: GroupRole): number {
  if (role === 'owner') return 0;
  if (role === 'admin') return 1;
  return 2;
}

function roleLabel(role: GroupRole): string {
  if (role === 'owner') return 'Yönetici';
  if (role === 'admin') return 'Yardımcı';
  return 'Üye';
}

export function GroupDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation<Nav>();
  const { groupId } = route.params;
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const leaveGroup = useGroupsStore((s) => s.leaveGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);
  const kickGroupMember = useGroupsStore((s) => s.kickGroupMember);
  const setGroupMemberRole = useGroupsStore((s) => s.setGroupMemberRole);
  const hydrateRemoteGroups = useGroupsStore((s) => s.hydrateRemoteGroups);
  const matches = useMatchesStore((s) => s.matches);
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const { configured, loading } = useSupabaseAuth();
  const { showUserFacingError, showApiErrorToast } = useUserFeedback();

  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const group = groups.find((item) => item.id === groupId);
  const isOwner = group?.ownerId === userId;
  const deleteUsesRemoteTable =
    Boolean(remoteUserId) && isRemoteUuid(groupId);
  const isMember = memberships.some((item) => item.groupId === groupId && item.playerId === userId);
  const memberCount = memberships.filter((item) => item.groupId === groupId).length;

  const myMembership = memberships.find((m) => m.groupId === groupId && m.playerId === userId);
  const isAdmin = myMembership?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;

  const groupMatches = useMemo(
    () => matches.filter((item) => item.groupId === groupId),
    [matches, groupId],
  );

  const {
    label: copyCodeLabel,
    runCopy: runCopyCode,
    isCopied: codeCopied,
  } = useClipboardCopyFeedback({
    idleLabel: 'Kodu kopyala',
  });

  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const showInitialSkeleton = configured && loading && !group;

  const groupMembersSorted = useMemo(() => {
    if (!groupId) return [];
    return memberships
      .filter((m) => m.groupId === groupId)
      .map((m) => ({
        membership: m,
        player: getPlayer(m.playerId),
      }))
      .sort((a, b) => {
        const diff = roleSortOrder(a.membership.role) - roleSortOrder(b.membership.role);
        if (diff !== 0) return diff;
        const an = a.player?.name ?? 'Oyuncu';
        const bn = b.player?.name ?? 'Oyuncu';
        return an.localeCompare(bn, 'tr');
      });
  }, [memberships, groupId, getPlayer]);

  const onPressCopyJoinCode = useCallback(() => {
    if (!group) return;
    void runCopyCode(async () => {
      await Clipboard.setStringAsync(group.joinCode);
    });
  }, [group, runCopyCode]);

  const onPressLeave = useCallback(() => {
    Alert.alert(
      'Gruptan ayrıl',
      'Bu gruptan ayrılmak istediğine emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLeaving(true);
              try {
                await leaveGroup(groupId);
                navigation.navigate('GroupsMain');
              } catch (e) {
                showApiErrorToast(e, {
                  uiOperation: 'groups:detail:leave',
                  fallbackMessage: 'Gruptan ayrılınamadı.',
                  mapOperation: 'leaveGroupRemote',
                });
              } finally {
                setLeaving(false);
              }
            })();
          },
        },
      ],
    );
  }, [groupId, leaveGroup, navigation, showApiErrorToast]);

  const onPressDeleteGroup = useCallback(() => {
    Alert.alert(
      'Grubu kaldır',
      'Bu grup kalıcı olarak kaldırılır; üyeler bu gruba erişemez. Gruba bağlı maçlar listende kalabilir ancak grup bilgisi kalkar. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Grubu kaldır',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await deleteGroup(groupId);
                navigation.navigate('GroupsMain');
              } catch (e) {
                try {
                  await hydrateRemoteGroups({ force: true });
                } catch {
                  /* listeyi yenileyemediysek yine de kullanıcıya ilk hatayı göster */
                }
                showUserFacingError(e, {
                  uiOperation: 'groups:detail:delete',
                  fallbackMessage: 'Grup kaldırılamadı.',
                  mapOperation: 'deleteGroupRemote',
                });
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ],
    );
  }, [groupId, deleteGroup, hydrateRemoteGroups, navigation, showUserFacingError]);

  const onPressMemberActions = useCallback(
    (targetPlayerId: string, targetRole: GroupRole, targetName: string) => {
      const buttons: AlertButton[] = [];

      if (isOwner) {
        if (targetRole === 'member') {
          buttons.push({
            text: 'Yardımcı Yönetici Yap',
            onPress: () => {
              Alert.alert(
                'Yardımcı Yönetici Yap',
                `${targetName} grubun yardımcı yöneticisi olacak. Devam etmek istiyor musun?`,
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Yap',
                    onPress: () => {
                      void (async () => {
                        try {
                          await setGroupMemberRole(groupId, targetPlayerId, 'admin');
                        } catch (e) {
                          showApiErrorToast(e, {
                            uiOperation: 'groups:detail:promote',
                            fallbackMessage: 'Rol değiştirilemedi.',
                            mapOperation: 'setGroupMemberRoleRemote',
                          });
                        }
                      })();
                    },
                  },
                ],
              );
            },
          });
        }
        if (targetRole === 'admin') {
          buttons.push({
            text: 'Yardımcılığı Kaldır',
            onPress: () => {
              Alert.alert(
                'Yardımcılığı Kaldır',
                `${targetName} artık yardımcı yönetici olmayacak.`,
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Kaldır',
                    style: 'destructive',
                    onPress: () => {
                      void (async () => {
                        try {
                          await setGroupMemberRole(groupId, targetPlayerId, 'member');
                        } catch (e) {
                          showApiErrorToast(e, {
                            uiOperation: 'groups:detail:demote',
                            fallbackMessage: 'Rol değiştirilemedi.',
                            mapOperation: 'setGroupMemberRoleRemote',
                          });
                        }
                      })();
                    },
                  },
                ],
              );
            },
          });
        }
      }

      buttons.push({
        text: 'Gruptan At',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Gruptan At',
            `${targetName} bu gruptan atılacak.`,
            [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'At',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    try {
                      await kickGroupMember(groupId, targetPlayerId);
                    } catch (e) {
                      showApiErrorToast(e, {
                        uiOperation: 'groups:detail:kick',
                        fallbackMessage: 'Üye gruptan atılamadı.',
                        mapOperation: 'kickGroupMemberRemote',
                      });
                    }
                  })();
                },
              },
            ],
          );
        },
      });

      buttons.push({ text: 'İptal', style: 'cancel' });

      Alert.alert(targetName, undefined, buttons);
    },
    [groupId, isOwner, kickGroupMember, setGroupMemberRole, showApiErrorToast],
  );

  if (showInitialSkeleton) {
    return (
      <View style={styles.screen}>
        <View style={styles.listContent}>
          <SkeletonText variant="title" width="55%" />
          <SkeletonText variant="caption" width="24%" />
          <SettingsSectionSkeleton rows={2} />
          <SettingsSectionSkeleton rows={3} />
          <SkeletonText variant="subtitle" width={96} />
          <SkeletonList count={2} renderItem={() => <MatchCardSkeleton />} />
        </View>
      </View>
    );
  }

  if (!group || !isMember) {
    return (
      <View style={styles.screen}>
        <View style={styles.deniedWrap}>
          <Text style={styles.title}>Bu grubu görüntüleme yetkin yok.</Text>
          <Text style={styles.meta}>
            Grup dışı katılımcıysan maç detayından kadroyu görebilirsin.
          </Text>
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {group.name}
        </Text>
        <Text style={styles.meta}>
          {memberCount} üye
        </Text>
      </View>

      <PillButton
        title="Liderlik Tablosu"
        variant="ghost"
        onPress={() => navigation.navigate('GroupLeaderboard', { groupId })}
        testID="groups:leaderboard:open"
        accessibilityLabel="Liderlik tablosunu aç"
      />
      {isOwner ? (
        <PillButton
          title="Haftalık maç tekrarı"
          variant="ghost"
          onPress={() => navigation.navigate('GroupWeeklySeries', { groupId })}
          testID="groups:weekly:open"
          accessibilityLabel="Haftalık maç tekrarını aç"
        />
      ) : null}

      <Card style={styles.cardGap} variant="glass">
        <Text style={styles.cardTitle}>Katılım kodu</Text>
        <Text style={styles.inviteHint}>
          Arkadaşların Gruplar sekmesinden Gruba Katıl ekranında bu kodu girebilir.
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText} selectable testID="groups:detail:join-code-display">
            {group.joinCode}
          </Text>
        </View>
        <PillButton
          title={copyCodeLabel}
          variant="accent"
          onPress={onPressCopyJoinCode}
          titleColor={codeCopied ? colors.copyFeedbackLight : undefined}
          testID="groups:detail:copy-code"
          accessibilityLabel="Katılım kodunu panoya kopyala"
        />
      </Card>

      <Card style={styles.cardGap} variant="glass">
        <Text style={styles.cardTitle}>Üyeler</Text>
        <View style={styles.memberList}>
          {groupMembersSorted.map(({ membership, player }) => {
            const displayName = player?.name ?? 'Oyuncu';
            const label = roleLabel(membership.role);
            const canAct =
              isOwnerOrAdmin &&
              membership.playerId !== userId &&
              membership.role !== 'owner';
            return (
              <View key={`${membership.groupId}-${membership.playerId}`} style={styles.memberRow}>
                <PlayerAvatar name={displayName} uri={player?.photoUri} size={44} />
                <View style={styles.memberMeta}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <View style={styles.memberRight}>
                    <View
                      style={[
                        styles.rolePill,
                        membership.role === 'owner'
                          ? styles.rolePillOwner
                          : membership.role === 'admin'
                          ? styles.rolePillAdmin
                          : styles.rolePillMember,
                      ]}
                    >
                      <Text
                        style={
                          membership.role === 'owner'
                            ? styles.roleTextOwner
                            : membership.role === 'admin'
                            ? styles.roleTextAdmin
                            : styles.roleTextMember
                        }
                      >
                        {label}
                      </Text>
                    </View>
                    {canAct ? (
                      <Pressable
                        onPress={() =>
                          onPressMemberActions(membership.playerId, membership.role, displayName)
                        }
                        hitSlop={8}
                        style={styles.moreBtn}
                        testID={`groups:member:actions:${membership.playerId}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${displayName} için işlemler`}
                      >
                        <Text style={styles.moreBtnText}>•••</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {isOwner ? (
        <Card style={styles.cardGap} variant="glass">
          <Text style={styles.cardTitle}>Grup ayarları</Text>
          <Text style={styles.settingsHint}>
            Yalnızca grup yöneticisi bu grubu kaldırabilir. Bu işlem geri alınamaz.
            {remoteUserId && !deleteUsesRemoteTable
              ? ' Bu kayıt salt bu cihazda oluşturulmuş bir grup; sunucuda ayrı bir kopyası olmayabilir.'
              : ''}
          </Text>
          <PillButton
            title="Grubu kaldır"
            variant="ghost"
            titleColor={colors.textMuted}
            onPress={onPressDeleteGroup}
            loading={deleting}
            disabled={deleting}
            testID="groups:detail:delete-group"
            accessibilityLabel="Grubu kaldır"
            accessibilityState={{ disabled: deleting }}
          />
        </Card>
      ) : (
        <PillButton
          title="Gruptan ayrıl"
          variant="danger"
          onPress={onPressLeave}
          loading={leaving}
          disabled={leaving}
          testID="groups:detail:leave"
          accessibilityLabel="Gruptan ayrıl"
          accessibilityState={{ disabled: leaving }}
          style={styles.leaveBtn}
        />
      )}

      <Text style={styles.sectionLabel}>Maçlar</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={groupMatches}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM },
        ]}
        ListEmptyComponent={
          <Text style={styles.empty}>Bu grupta henüz planlanan maç yok.</Text>
        }
        renderItem={({ item }) => (
          <MatchCardListRow matchId={item.id}>
            <MatchCard
              match={item}
              goingCount={countGoing(item)}
              userRsvp={
                item.attendees.find((att) => att.playerId === userId)?.status ?? null
              }
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            />
          </MatchCardListRow>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  deniedWrap: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
    flexGrow: 1,
  },
  listHeader: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  titleBlock: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  cardGap: {
    marginTop: spacing.xs,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inviteHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  settingsHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  codeBox: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  codeText: {
    ...typography.subtitle,
    color: colors.text,
    letterSpacing: letterSpacing.code,
    textAlign: 'center',
  },
  memberList: {
    gap: spacing.md,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  memberMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  memberName: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rolePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rolePillOwner: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  rolePillAdmin: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  rolePillMember: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roleTextOwner: {
    ...typography.micro,
    color: colors.accent,
  },
  roleTextAdmin: {
    ...typography.micro,
    color: '#F59E0B',
  },
  roleTextMember: {
    ...typography.micro,
    color: colors.textMuted,
  },
  moreBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtnText: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  sectionLabel: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  leaveBtn: {
    marginTop: spacing.xs,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
