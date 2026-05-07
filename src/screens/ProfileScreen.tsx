import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PositionBadge } from '../components/PositionBadge';
import { colors, spacing, typography } from '../theme';
import type { Position, PreferredFoot } from '../types/domain';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { updateCurrentUserProfile } from '../services/supabase/profiles';
import { useAppStore } from '../store/useAppStore';
import { formatShortDate } from '../utils/dates';
import { levelLabelFromScore, playerScore, winRate } from '../utils/stats';
import { useTurkishIbanField } from '../hooks/useTurkishIbanField';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { ProfileStackParamList } from '../navigation/types';
import { isValidTurkishIban, maskIban, normalizeIban } from '../utils/iban';

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
  const insets = useSafeAreaInsets();
  const userId = useAppStore((s) => s.getCurrentUserId());
  const player = useAppStore((s) => s.players.find((p) => p.id === userId));
  const matches = useAppStore((s) => s.matches);
  const updateProfile = useAppStore((s) => s.updatePlayerProfile);
  const hydrateRemoteMatches = useAppStore((s) => s.hydrateRemoteMatches);
  const { configured, session, loading: authLoading, signInWithEmail, signUpWithEmail, signOut, refreshRemoteProfile } =
    useSupabaseAuth();

  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%'], []);

  const [name, setName] = useState(player?.name ?? '');
  const [photoUri, setPhotoUri] = useState(player?.photoUri ?? '');
  const [position, setPosition] = useState<Position>(player?.position ?? 'MID');
  const [foot, setFoot] = useState<PreferredFoot>(player?.preferredFoot ?? 'both');
  const [refreshing, setRefreshing] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const { iban, syncFromStored, onChange: onIbanChange, onFocus: onIbanFocus } = useTurkishIbanField(
    player?.iban,
  );

  const score = player ? playerScore(player) : 0;
  const level = levelLabelFromScore(score);
  const wr = player ? Math.round(winRate(player.stats) * 100) : 0;

  const recent = useMemo(() => {
    const finished = matches
      .filter((m) => m.status === 'finished' && m.result)
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .slice(0, 5);

    return finished.map((m) => {
      const r = m.result!;
      const inA = m.teamAIds.includes(userId);
      const inB = m.teamBIds.includes(userId);
      const myGoals = r.scorers.find((s) => s.playerId === userId)?.count ?? 0;
      let outcome: 'W' | 'L' | 'D';
      if (r.scoreA === r.scoreB) outcome = 'D';
      else if (inA) outcome = r.scoreA > r.scoreB ? 'W' : 'L';
      else if (inB) outcome = r.scoreB > r.scoreA ? 'W' : 'L';
      else outcome = 'D';
      return { m, outcome, myGoals };
    });
  }, [matches, userId]);

  const openEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setName(player?.name ?? '');
    setPhotoUri(player?.photoUri ?? '');
    setPosition(player?.position ?? 'MID');
    setFoot(player?.preferredFoot ?? 'both');
    syncFromStored(player?.iban);
    sheetRef.current?.present();
  };

  const save = async () => {
    if (!player) return;
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

  if (!player) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textMuted }}>Oyuncu bulunamadı</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              if (session) {
                await refreshRemoteProfile();
                await hydrateRemoteMatches();
              }
            } finally {
              setRefreshing(false);
            }
          }}
          tintColor={colors.accent}
        />
      }
    >
      <View style={[styles.authCard, { marginTop: insets.top + spacing.md }]}>
        {!configured ? (
          <Text style={styles.authHint}>
            Supabase için kök dizinde `.env` içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın;
            Metro’yu yeniden başlatın.
          </Text>
        ) : authLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : session ? (
          <>
            <Text style={styles.authLabel}>Hesap</Text>
            <Text style={styles.authEmail}>{session.user.email ?? session.user.id}</Text>
            <PillButton
              title="Çıkış Yap"
              variant="ghost"
              onPress={() => void signOut()}
              testID="profile:auth:signout:press"
              accessibilityLabel="Çıkış yap"
            />
          </>
        ) : (
          <>
            <Text style={styles.authTitle}>Giriş / kayıt</Text>
            <TextInput
              style={styles.authInput}
              placeholder="E-posta"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={authEmail}
              onChangeText={setAuthEmail}
              testID="profile:auth:email:input"
              accessibilityLabel="E-posta"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Şifre"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={authPassword}
              onChangeText={setAuthPassword}
              testID="profile:auth:password:input"
              accessibilityLabel="Şifre"
            />
            <View style={styles.authActions}>
              <PillButton
                title="Giriş Yap"
                loading={authBusy}
                onPress={async () => {
                  setAuthBusy(true);
                  const { error } = await signInWithEmail(authEmail, authPassword);
                  setAuthBusy(false);
                  if (error) Alert.alert('Giriş', error.message);
                }}
                disabled={authBusy}
                testID="profile:auth:signin:press"
                accessibilityLabel="Giriş yap"
              />
              <PillButton
                title="Kayıt Ol"
                variant="ghost"
                loading={authBusy}
                onPress={async () => {
                  setAuthBusy(true);
                  const { error } = await signUpWithEmail(authEmail, authPassword);
                  setAuthBusy(false);
                  if (error) Alert.alert('Kayıt', error.message);
                  else {
                    Alert.alert(
                      'Kayıt',
                      'Hesabınız oluşturuldu. E-posta doğrulaması açıksa gelen kutunuzu kontrol edin.',
                    );
                  }
                }}
                disabled={authBusy}
                testID="profile:auth:signup:press"
                accessibilityLabel="Kayıt ol"
              />
            </View>
          </>
        )}
      </View>

      <View style={[styles.hero, { paddingTop: spacing.lg }]}>
        <PlayerAvatar name={player.name} uri={player.photoUri} size={88} />
        <Text style={styles.heroName}>{player.name}</Text>
        <View style={styles.badges}>
          <PositionBadge position={player.position} />
          <View style={styles.levelBadge}>
            <Text style={styles.levelTxt}>{level}</Text>
          </View>
        </View>
        {player.iban ? (
          <View style={styles.ibanHero}>
            <Text style={styles.ibanHeroLbl}>IBAN'ım</Text>
            <Text style={styles.ibanHeroVal}>{maskIban(player.iban)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.cellVal}>{player.stats.matchesPlayed}</Text>
          <Text style={styles.cellLbl}>Maç</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellVal}>{player.stats.goals}</Text>
          <Text style={styles.cellLbl}>Gol</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellVal}>{player.stats.assists}</Text>
          <Text style={styles.cellLbl}>Asist</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.cellVal}>{wr}%</Text>
          <Text style={styles.cellLbl}>Galibiyet</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Son maçlar</Text>
        {recent.length === 0 ? (
          <Text style={styles.muted}>Henüz kayıtlı maç yok.</Text>
        ) : (
          recent.map(({ m, outcome, myGoals }) => (
            <View key={m.id} style={styles.rm}>
              <Text style={styles.rmDate}>{formatShortDate(m.startsAt)}</Text>
              <Text style={styles.rmMid}>
                {m.result!.scoreA} — {m.result!.scoreB}
              </Text>
              <Text style={[styles.rmTag, outcome === 'W' && styles.win, outcome === 'L' && styles.loss]}>
                {outcome === 'W' ? 'G' : outcome === 'L' ? 'M' : 'B'}
              </Text>
              <Text style={styles.rmG}>{myGoals} gol</Text>
            </View>
          ))
        )}
      </View>

      <PillButton title="Profili Düzenle" variant="ghost" onPress={openEdit} style={styles.editBtn} />
      <PillButton
        title="Gizlilik Politikasi"
        variant="ghost"
        onPress={() => navigation.navigate('PrivacyPolicy')}
        style={styles.privacyBtn}
        testID="profile:privacy-policy:press"
        accessibilityLabel="Gizlilik politikasi ekranina git"
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
          <Text style={styles.label}>Fotoğraf URL</Text>
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

const styles = StyleSheet.create({
  authCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  authHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  authTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  authLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  authEmail: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  authInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
  },
  authActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroName: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  levelTxt: {
    ...typography.micro,
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  ibanHero: {
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  ibanHeroLbl: {
    ...typography.caption,
    color: colors.textMuted,
  },
  ibanHeroVal: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cell: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  cellVal: {
    ...typography.title,
    color: colors.accent,
  },
  cellLbl: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
  },
  rm: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rmDate: {
    ...typography.caption,
    color: colors.textMuted,
    width: 56,
  },
  rmMid: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  rmTag: {
    ...typography.subtitle,
    width: 24,
    textAlign: 'center',
    color: colors.textMuted,
  },
  win: { color: colors.accent },
  loss: { color: colors.danger },
  rmG: {
    ...typography.caption,
    color: colors.textMuted,
    width: 52,
    textAlign: 'right',
  },
  editBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  privacyBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  sheetBg: {
    backgroundColor: colors.surface,
  },
  handle: {
    backgroundColor: colors.border,
  },
  sheetBody: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    color: colors.text,
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
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  optTxt: {
    ...typography.caption,
    color: colors.textMuted,
  },
  optTxtOn: {
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
});
