import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { PillButton } from '../components/PillButton';
import {
  MatchCardSkeleton,
  ProfileHeaderSkeleton,
  ProfileStatsHeroSkeleton,
  SkeletonText,
} from '../components/skeleton';
import { spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import type { Position, PreferredFoot } from '../types/domain';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { uploadProfileAvatar } from '../services/supabase/avatarUpload';
import { updateCurrentUserProfile } from '../services/supabase/profiles';
import { useAuthStore, useMatchesStore, usePlayersStore } from '../store';
import {
  computeWinStreak,
  levelLabelFromScore,
  playerScore,
  playerScoreTierProgress01,
  winRate,
} from '../utils/stats';
import { useTurkishIbanField } from '../hooks/useTurkishIbanField';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { ProfileStackParamList } from '../navigation/types';
import { isValidTurkishIban, normalizeIban } from '../utils/iban';
import {
  buildProfileEditBaseline,
  profileEditMatchesBaseline,
  type ProfileEditBaseline,
} from '../utils/profileEditBaseline';
import { matchOutcomeForPlayer, sparklineTrendScores } from '../utils/profileMatchTrend';
import { ProfileAccountSection } from './profile/ProfileAccountSection';
import { ProfileGlobalRankCard } from './profile/ProfileGlobalRankCard';
import { ProfileRecentMatches, type RecentMatchRow } from './profile/ProfileRecentMatches';
import { ProfileStatsHero } from './profile/ProfileStatsHero';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
const FEET: PreferredFoot[] = ['left', 'right', 'both'];
type Nav = StackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

function footLabel(f: PreferredFoot): string {
  if (f === 'left') return 'Sol';
  if (f === 'right') return 'Sağ';
  return 'İkisi';
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useStyles();
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const remoteUserId = useAuthStore((s) => s.remoteUserId);
  const player = usePlayersStore((s) => s.players.find((p) => p.id === userId));
  const matches = useMatchesStore((s) => s.matches);
  const updateProfile = usePlayersStore((s) => s.updatePlayerProfile);
  const hydrateRemoteMatches = useMatchesStore((s) => s.hydrateRemoteMatches);
  const { configured, session, refreshRemoteProfile, refreshAuthSession } = useSupabaseAuth();

  const [rankRefreshKey, setRankRefreshKey] = useState(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={styles.headerBtn}
          hitSlop={8}
          testID="profile:settings:press"
          accessibilityRole="button"
          accessibilityLabel="Ayarlar"
        >
          <Ionicons name="settings-outline" size={22} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, colors.text, styles.headerBtn]);

  const sheetRef = useRef<BottomSheetModal>(null);
  const editBaselineRef = useRef<ProfileEditBaseline | null>(null);
  const snapPoints = useMemo(() => ['62%'], []);

  const [name, setName] = useState(player?.name ?? '');
  const [photoUri, setPhotoUri] = useState(player?.photoUri ?? '');
  const [position, setPosition] = useState<Position>(player?.position ?? 'MID');
  const [foot, setFoot] = useState<PreferredFoot>(player?.preferredFoot ?? 'both');
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { iban, syncFromStored, onChange: onIbanChange, onFocus: onIbanFocus } = useTurkishIbanField(
    player?.iban,
  );

  const compositeScore = player ? playerScore(player) : 0;
  const level = levelLabelFromScore(compositeScore);
  const tierProgress01 = playerScoreTierProgress01(compositeScore);
  const wr = player ? Math.round(winRate(player.stats) * 100) : 0;
  const effectiveUserId = player?.id ?? userId;
  const winStreak = useMemo(
    () => (player ? computeWinStreak(matches, player.id) : 0),
    [matches, player],
  );

  const sparklinePoints = useMemo(
    () => (player ? sparklineTrendScores(matches, effectiveUserId, 10) : []),
    [effectiveUserId, matches, player],
  );

  const recent: RecentMatchRow[] = useMemo(() => {
    const finished = matches
      .filter((m) => m.status === 'finished' && m.result)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .slice(0, 5);

    return finished.map((m) => {
      const r = m.result!;
      const myGoals = r.scorers.find((s) => s.playerId === effectiveUserId)?.count ?? 0;
      const outcome = matchOutcomeForPlayer(m, effectiveUserId) ?? 'D';
      return { m, outcome, myGoals };
    });
  }, [effectiveUserId, matches]);

  const openEdit = () => {
    if (!player) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setName(player.name);
    setPhotoUri(player.photoUri ?? '');
    setPosition(player.position);
    setFoot(player.preferredFoot);
    syncFromStored(player.iban);
    editBaselineRef.current = buildProfileEditBaseline({
      name: player.name,
      photoUri: player.photoUri,
      position: player.position,
      preferredFoot: player.preferredFoot,
      ibanStored: player.iban,
    });
    sheetRef.current?.present();
  };

  const pickAvatarFromLibrary = async () => {
    if (!player) return;
    if (!configured || session?.user?.id !== player.id) {
      Alert.alert('Giriş gerekli', 'Profil fotoğrafı yüklemek için oturum açmalısınız.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Galeriden fotoğraf seçmek için erişim izni verin.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]?.uri) return;
    setAvatarUploading(true);
    try {
      const url = await uploadProfileAvatar(picked.assets[0].uri);
      setPhotoUri(url);
    } catch {
      Alert.alert('Yükleme', 'Fotoğraf yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const save = async () => {
    if (!player) return;
    const baseline = editBaselineRef.current;
    if (
      baseline &&
      profileEditMatchesBaseline(baseline, {
        name,
        photoUriInput: photoUri,
        position,
        preferredFoot: foot,
        ibanInput: iban,
      })
    ) {
      sheetRef.current?.dismiss();
      return;
    }
    const ibanNorm = normalizeIban(iban);
    if (ibanNorm.length > 0 && !isValidTurkishIban(ibanNorm)) {
      Alert.alert(
        'Geçersiz IBAN',
        'Türkiye IBAN’ı TR ile başlamalı, toplam 26 karakter olmalı ve kontrol basamağı doğru olmalı.',
      );
      return;
    }
    updateProfile(player.id, {
      name: name.trim() || player.name,
      photoUri: photoUri.trim() || undefined,
      position,
      preferredFoot: foot,
      iban: ibanNorm || undefined,
    });
    sheetRef.current?.dismiss();
    if (configured && session?.user?.id === player.id) {
      try {
        await updateCurrentUserProfile({
          display_name: name.trim() || player.name,
          photo_uri: photoUri.trim() || null,
          position,
          preferred_foot: foot,
          iban: ibanNorm || null,
        });
      } catch {
        Alert.alert('Sunucu', 'Profil sunucuya yazılamadı; yerel kayıt güncellendi.');
      }
    }
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (session) {
        await refreshAuthSession();
        await refreshRemoteProfile();
        await hydrateRemoteMatches();
      }
      setRankRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const awaitingRemoteProfile =
    configured && !!session?.user?.id && session.user.id === userId && !player;

  if (awaitingRemoteProfile) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}
        accessibilityLabel="Profil yükleniyor"
      >
        <ProfileHeaderSkeleton />
        <ProfileStatsHeroSkeleton />
        <View style={styles.skeletonRank}>
          <SkeletonText variant="subtitle" width="55%" />
          <SkeletonText variant="body" width="88%" style={styles.skeletonGap} />
        </View>
        <View style={styles.skeletonRecentSection}>
          <SkeletonText variant="subtitle" width={140} style={styles.skeletonRecentTitle} />
          <MatchCardSkeleton />
          <MatchCardSkeleton />
        </View>
      </ScrollView>
    );
  }

  if (!player) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>Oyuncu bulunamadı</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <ProfileStatsHero
        player={player}
        winRatePct={wr}
        winStreak={winStreak}
        levelLabel={level}
        tierProgress01={tierProgress01}
        compositeScore={compositeScore}
        sparklinePoints={sparklinePoints}
      />

      <ProfileGlobalRankCard userId={player.id} remoteUserId={remoteUserId} refreshKey={rankRefreshKey} />

      <ProfileRecentMatches rows={recent} />

      <ProfileAccountSection configured={configured} user={session?.user} player={player} />

      <PillButton
        title="Profili Düzenle"
        variant="ghost"
        onPress={openEdit}
        style={styles.editBtn}
        testID="profile:edit:press"
      />

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetBody}>
          <Text style={styles.sheetTitle}>Profili düzenle</Text>
          <Text style={styles.label}>Ad</Text>
          <BottomSheetTextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Fotoğraf</Text>
          <Pressable
            onPress={pickAvatarFromLibrary}
            disabled={avatarUploading}
            style={({ pressed }) => [
              styles.pickPhotoBtn,
              pressed && styles.pickPhotoBtnPressed,
              avatarUploading && styles.pickPhotoBtnDisabled,
            ]}
            testID="profile:avatar-pick:press"
            accessibilityRole="button"
            accessibilityLabel="Galeriden fotoğraf seç"
          >
            {avatarUploading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.pickPhotoTxt}>Galeriden seç</Text>
            )}
          </Pressable>
          <Text style={styles.label}>Fotoğraf URL (isteğe bağlı)</Text>
          <BottomSheetTextInput
            value={photoUri}
            onChangeText={setPhotoUri}
            style={styles.input}
            placeholder="https://"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Pozisyon</Text>
          <View style={styles.rowWrap}>
            {POSITIONS.map((p) => (
              <Pressable key={p} onPress={() => setPosition(p)} style={[styles.opt, position === p && styles.optOn]}>
                <Text style={[styles.optTxt, position === p && styles.optTxtOn]}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Tercih edilen ayak</Text>
          <View style={styles.rowWrap}>
            {FEET.map((f) => (
              <Pressable key={f} onPress={() => setFoot(f)} style={[styles.opt, foot === f && styles.optOn]}>
                <Text style={[styles.optTxt, foot === f && styles.optTxtOn]}>{footLabel(f)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>IBAN'ım (isteğe bağlı)</Text>
          <BottomSheetTextInput
            value={iban}
            onChangeText={onIbanChange}
            onFocus={onIbanFocus}
            placeholder="33 0006 1005 1978 6457 8413 26"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            autoCorrect={false}
            style={styles.input}
          />
          <PillButton title="Kaydet" onPress={save} />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    headerBtn: {
      paddingHorizontal: spacing.md,
    },
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.background,
    },
    emptyMsg: {
      color: t.colors.textMuted,
    },
    skeletonRecentSection: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    skeletonRecentTitle: {
      marginBottom: spacing.sm,
    },
    skeletonRank: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    skeletonGap: {
      marginTop: spacing.sm,
    },
    editBtn: {
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    sheetBg: {
      backgroundColor: t.colors.surface,
    },
    handle: {
      backgroundColor: t.colors.border,
    },
    sheetBody: {
      padding: spacing.lg,
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    sheetTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      marginBottom: spacing.sm,
    },
    label: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginTop: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      padding: spacing.sm,
      color: t.colors.text,
      fontFamily: 'Inter_400Regular',
    },
    rowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    opt: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
    },
    optOn: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
    },
    optTxt: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    optTxtOn: {
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
    pickPhotoBtn: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
      paddingHorizontal: spacing.md,
    },
    pickPhotoBtnPressed: {
      opacity: 0.85,
    },
    pickPhotoBtnDisabled: {
      opacity: 0.6,
    },
    pickPhotoTxt: {
      ...typography.body,
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
  }),
);
