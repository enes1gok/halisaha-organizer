import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, AlertButton, ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Card } from '../components/Card';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { SettingsSectionSkeleton, SkeletonText } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useClipboardCopyFeedback } from '../hooks/useClipboardCopyFeedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import type { GroupsStackParamList } from '../navigation/types';
import { useAuthStore, useGroupsStore, usePlayersStore } from '../store';
import { colors, letterSpacing, radius, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { useUserFeedback } from '../utils/userFeedback';
import { isRemoteUuid } from '../utils/matchId';
import type { GroupRole } from '../types/domain';

type SettingsRoute = RouteProp<GroupsStackParamList, 'GroupSettings'>;
type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupSettings'>;


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

export function GroupSettingsScreen() {
  const route = useRoute<SettingsRoute>();
  const navigation = useNavigation<Nav>();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { groupId } = route.params;
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const leaveGroup = useGroupsStore((s) => s.leaveGroup);
  const deleteGroup = useGroupsStore((s) => s.deleteGroup);
  const kickGroupMember = useGroupsStore((s) => s.kickGroupMember);
  const setGroupMemberRole = useGroupsStore((s) => s.setGroupMemberRole);
  const hydrateRemoteGroups = useGroupsStore((s) => s.hydrateRemoteGroups);
  const getPlayer = usePlayersStore((s) => s.getPlayer);
  const { configured, loading } = useSupabaseAuth();
  const { showUserFacingError, showApiErrorToast, showValidationToast, showToast } = useUserFeedback();
  const updateGroupPhoto = useGroupsStore((s) => s.updateGroupPhoto);

  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const group = groups.find((item) => item.id === groupId);
  const isOwner = group?.ownerId === userId;
  const deleteUsesRemoteTable = Boolean(remoteUserId) && isRemoteUuid(groupId);

  const myMembership = memberships.find((m) => m.groupId === groupId && m.playerId === userId);
  const isAdmin = myMembership?.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;

  const {
    label: copyCodeLabel,
    runCopy: runCopyCode,
    isCopied: codeCopied,
  } = useClipboardCopyFeedback({
    idleLabel: 'Kodu kopyala',
  });

  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
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

  const onPressPickGroupPhoto = useCallback(() => {
    if (!group) return;
    void (async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showValidationToast('İzin gerekli', 'Galeriden fotoğraf seçmek için erişim izni verin.');
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (picked.canceled || !picked.assets[0]?.uri) return;
      setPhotoUploading(true);
      try {
        await updateGroupPhoto(groupId, picked.assets[0].uri);
        showToast({
          variant: 'success',
          title: 'Başarılı',
          message: 'Grup fotoğrafı güncelleştirildi.',
        });
      } catch (error) {
        showApiErrorToast(error, {
          uiOperation: 'groups:settings:photo',
          fallbackMessage: 'Fotoğraf yüklenemedi.',
          mapOperation: 'updateGroupPhotoRemote',
        });
      } finally {
        setPhotoUploading(false);
      }
    })();
  }, [group, groupId, showValidationToast, showApiErrorToast, showToast, updateGroupPhoto]);

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
                navigation.popToTop();
              } catch (e) {
                showApiErrorToast(e, {
                  uiOperation: 'groups:settings:leave',
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
                navigation.popToTop();
              } catch (e) {
                try {
                  await hydrateRemoteGroups({ force: true });
                } catch {
                  /* ignore */
                }
                showUserFacingError(e, {
                  uiOperation: 'groups:settings:delete',
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
                            uiOperation: 'groups:settings:promote',
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
                            uiOperation: 'groups:settings:demote',
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
                        uiOperation: 'groups:settings:kick',
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
        <View style={styles.content}>
          <SettingsSectionSkeleton rows={2} />
          <SettingsSectionSkeleton rows={3} />
        </View>
      </View>
    );
  }

  if (!group) return null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: getTabBarListPaddingBottom(insets.bottom) },
      ]}
    >
      {isOwnerOrAdmin && (
        <Card variant="glass">
          <Text style={styles.cardTitle}>Grup Fotoğrafı</Text>
          <View style={styles.photoSection}>
            <View style={styles.photoPlaceholder}>
              {group.photoUri ? (
                <Image
                  source={{ uri: group.photoUri }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.photoPlaceholderText}>Fotoğraf yok</Text>
              )}
            </View>
            <PillButton
              title="Galeriden Seç"
              onPress={onPressPickGroupPhoto}
              loading={photoUploading}
              disabled={photoUploading}
              style={styles.photoButton}
            />
          </View>
          <Text style={styles.photoHint}>Grup fotoğrafı JPEG formatında 512px genişlikte saklanır.</Text>
        </Card>
      )}

      <Card variant="glass">
        <Text style={styles.cardTitle}>Katılım kodu</Text>
        <Text style={styles.hint}>
          Arkadaşların Gruplar sekmesinden Gruba Katıl ekranında bu kodu girebilir.
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText} selectable>
            {group.joinCode}
          </Text>
        </View>
        <PillButton
          title={copyCodeLabel}
          variant="accent"
          onPress={onPressCopyJoinCode}
          titleColor={codeCopied ? colors.copyFeedbackLight : undefined}
        />
      </Card>

      <Card variant="glass">
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
        <Card variant="glass">
          <Text style={styles.cardTitle}>Grup ayarları</Text>
          <Text style={styles.hint}>
            Yalnızca grup yöneticisi bu grubu kaldırabilir. Bu işlem geri alınamaz.
          </Text>
          <PillButton
            title="Grubu kaldır"
            variant="ghost"
            titleColor={colors.textMuted}
            onPress={onPressDeleteGroup}
            loading={deleting}
            disabled={deleting}
          />
        </Card>
      ) : (
        <PillButton
          title="Gruptan ayrıl"
          variant="danger"
          onPress={onPressLeave}
          loading={leaving}
          disabled={leaving}
        />
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.background },
    content: {
      padding: spacing.md,
      gap: spacing.md,
    },
    cardTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      marginBottom: spacing.sm,
    },
    hint: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginBottom: spacing.sm,
    },
    codeBox: {
      backgroundColor: t.colors.background,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    codeText: {
      ...typography.subtitle,
      color: t.colors.text,
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
      color: t.colors.text,
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
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
    },
    rolePillAdmin: {
      borderColor: t.colors.admin,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    rolePillMember: {
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    roleTextOwner: {
      ...typography.micro,
      color: t.colors.accent,
    },
    roleTextAdmin: {
      ...typography.micro,
      color: t.colors.admin,
    },
    roleTextMember: {
      ...typography.micro,
      color: t.colors.textMuted,
    },
    moreBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreBtnText: {
      ...typography.micro,
      color: t.colors.textMuted,
      letterSpacing: 2,
    },
    photoSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    photoPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: radius.card,
      backgroundColor: t.colors.background,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoPlaceholderText: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    photoButton: {
      flex: 1,
    },
    photoHint: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginTop: spacing.sm,
    },
  }),
);
