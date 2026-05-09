import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PillButton } from '../components/PillButton';
import { useToast } from '../context/ToastContext';
import type { ShowToastOptions } from '../context/toastTypes';
import { colors, shadows, spacing, typography } from '../theme';
import { useAuthStore, useGroupsStore, useMatchesStore, usePlayersStore } from '../store';
import { toUserMessage } from '../services/supabase/errors';
import { useTurkishIbanField } from '../hooks/useTurkishIbanField';
import type { MatchPaymentMethod } from '../types/domain';
import {
  formatIbanForInput,
  isValidTurkishIban,
  maskIban,
  normalizeIban,
} from '../utils/iban';
import { selectionTick } from '../utils/haptics';

const MIN_MAX_PLAYERS = 4;
const MAX_MAX_PLAYERS = 22;

/** Seçilen zamanı en yakın tam / buçuk saate (:00 veya :30) yuvarlar. */
function snapStartsAtToNearestHalfHour(d: Date): Date {
  const x = new Date(d);
  const minutes = x.getMinutes();
  if (minutes < 15) {
    x.setMinutes(0, 0, 0);
  } else if (minutes < 45) {
    x.setMinutes(30, 0, 0);
  } else {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  }
  return x;
}

/** Geçerli andan sonraki tam veya buçuk saat (dakika/saniye sıfırlanmış). */
function roundUpToNextHalfHour(d: Date): Date {
  const x = new Date(d);
  const mins = x.getMinutes();
  const secs = x.getSeconds();
  const ms = x.getMilliseconds();
  if (secs === 0 && ms === 0 && (mins === 0 || mins === 30)) {
    return x;
  }
  if (mins < 30) {
    x.setMinutes(30, 0, 0);
  } else {
    x.setHours(x.getHours() + 1, 0, 0, 0);
  }
  return x;
}

/** Picker çıktısı: yarım saat grid + geçmişte kalmışsa şu andan sonraki uygun slot. */
function normalizeStartsAtFromPicker(d: Date): Date {
  const snapped = snapStartsAtToNearestHalfHour(d);
  const t = Date.now();
  if (snapped.getTime() >= t) {
    return snapped;
  }
  return roundUpToNextHalfHour(new Date(t));
}

export function CreateMatchTabScreen() {
  const navigation = useNavigation();
  const { showToast } = useToast();
  const sheetRef = useRef<BottomSheetModal>(null);
  const pendingMatchToastRef = useRef<ShowToastOptions | null>(null);
  const snapPoints = useMemo(() => ['82%'], []);
  const createMatch = useMatchesStore((s) => s.createMatch);
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const groups = useGroupsStore((s) => s.groups);
  const memberships = useGroupsStore((s) => s.groupMemberships);
  const profileIbanRaw = usePlayersStore((s) => s.players.find((p) => p.id === userId)?.iban);

  const profileNorm = useMemo(
    () => (profileIbanRaw ? normalizeIban(profileIbanRaw) : ''),
    [profileIbanRaw],
  );

  const hasValidProfileIban = useMemo(
    () => profileNorm.length > 0 && isValidTurkishIban(profileNorm),
    [profileNorm],
  );

  const { iban, setIban, syncFromStored, onChange: onIbanChange, onFocus: onIbanFocus } =
    useTurkishIbanField();

  const [overrideIban, setOverrideIban] = useState(true);

  const [venue, setVenue] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(14);
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MatchPaymentMethod | null>(null);
  const [ibanAccountName, setIbanAccountName] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState(() =>
    normalizeStartsAtFromPicker(new Date(Date.now() + 86400000)),
  );
  const myGroups = useMemo(
    () =>
      groups.filter((group) =>
        memberships.some((membership) => membership.groupId === group.id && membership.playerId === userId),
      ),
    [groups, memberships, userId],
  );

  const { startsAtDateLine, startsAtTimeLine, startsAtAccessibilityLabel } = useMemo(() => {
    const dateLine = startsAt.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeLine = startsAt.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const a11y = startsAt.toLocaleString('tr-TR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    return {
      startsAtDateLine: dateLine,
      startsAtTimeLine: timeLine,
      startsAtAccessibilityLabel: a11y,
    };
  }, [startsAt]);

  const [showPicker, setShowPicker] = useState(false);
  /** Android: `datetime` mode is unsupported; use date then time (see datetimepicker #907). */
  const [androidPickerStep, setAndroidPickerStep] = useState<'date' | 'time' | null>(null);
  const [pickerMinDate, setPickerMinDate] = useState(() => new Date());

  const onAndroidDateChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || event.type === 'neutralButtonPressed') {
      setAndroidPickerStep(null);
      return;
    }
    if (event.type === 'set' && picked) {
      setStartsAt((prev) => {
        const merged = new Date(picked);
        merged.setHours(
          prev.getHours(),
          prev.getMinutes(),
          prev.getSeconds(),
          prev.getMilliseconds(),
        );
        return normalizeStartsAtFromPicker(merged);
      });
      setAndroidPickerStep('time');
    }
  };

  const onAndroidTimeChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (event.type === 'dismissed' || event.type === 'neutralButtonPressed') {
      setAndroidPickerStep(null);
      return;
    }
    if (event.type === 'set' && picked) {
      setStartsAt((prev) => {
        const merged = new Date(prev);
        merged.setHours(
          picked.getHours(),
          picked.getMinutes(),
          picked.getSeconds(),
          picked.getMilliseconds(),
        );
        return normalizeStartsAtFromPicker(merged);
      });
      setAndroidPickerStep(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const t = requestAnimationFrame(() => sheetRef.current?.present());
      const valid = profileNorm.length > 0 && isValidTurkishIban(profileNorm);
      setOverrideIban(!valid);
      syncFromStored('');
      return () => cancelAnimationFrame(t);
    }, [profileNorm, syncFromStored]),
  );

  const goHome = useCallback(() => {
    navigation.navigate('HomeTab' as never);
  }, [navigation]);

  const handleSheetDismiss = useCallback(() => {
    goHome();
    const pending = pendingMatchToastRef.current;
    pendingMatchToastRef.current = null;
    if (pending) {
      setTimeout(() => showToast(pending), 400);
    }
  }, [goHome, showToast]);

  const onSubmit = async () => {
    if (!venue.trim()) {
      Alert.alert('Eksik bilgi', 'Saha adını girin.');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Eksik bilgi', 'Lütfen ödeme yöntemini seçin.');
      return;
    }
    const ibanNormForMatch =
      paymentMethod === 'iban' ? (!overrideIban && hasValidProfileIban ? profileNorm : normalizeIban(iban)) : '';
    if (paymentMethod === 'iban' && (ibanNormForMatch.length === 0 || !isValidTurkishIban(ibanNormForMatch))) {
      Alert.alert(
        'Geçersiz IBAN',
        'Türkiye IBAN’ı TR ile başlamalı, toplam 26 karakter olmalı ve kontrol basamağı doğru olmalı. Örn: TR33 0006 1005 1978 6457 8413 26',
      );
      return;
    }
    const ibanAccountNameNorm =
      paymentMethod === 'iban' ? ibanAccountName.trim().toLocaleUpperCase('tr-TR') : '';
    if (paymentMethod === 'iban' && ibanAccountNameNorm.length === 0) {
      Alert.alert('Eksik bilgi', 'IBAN alıcı ad soyad bilgisini girin.');
      return;
    }
    const paymentNoteNorm = paymentMethod === 'note_only' ? paymentNote.trim() : '';
    if (paymentMethod === 'note_only' && paymentNoteNorm.length === 0) {
      Alert.alert('Eksik bilgi', 'Sadece not ekle seçeneğinde ödeme notu zorunludur.');
      return;
    }
    if (paymentMethod === 'note_only' && paymentNoteNorm.length > 120) {
      Alert.alert('Geçersiz not', 'Ödeme notu en fazla 120 karakter olabilir.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      Alert.alert('Geçersiz tarih', 'Maç başlangıcı geçmişte olamaz.');
      return;
    }
    const mp = Math.min(MAX_MAX_PLAYERS, Math.max(MIN_MAX_PLAYERS, Math.round(maxPlayers)));
    const priceNum = price.trim() ? parseFloat(price.replace(',', '.')) : undefined;
    try {
      const m = await createMatch({
        venue: venue.trim(),
        startsAt: startsAt.toISOString(),
        maxPlayers: mp,
        groupId: selectedGroupId ?? undefined,
        pricePerPerson:
          paymentMethod === 'note_only' ? undefined : priceNum && priceNum > 0 ? priceNum : undefined,
        iban: paymentMethod === 'iban' ? ibanNormForMatch : undefined,
        ibanAccountName: paymentMethod === 'iban' ? ibanAccountNameNorm : undefined,
        paymentNote: paymentMethod === 'note_only' ? paymentNoteNorm : undefined,
        paymentMethod,
      });
      const copyPayload = `Katılım kodu: ${m.joinCode}`;
      pendingMatchToastRef.current = {
        title: 'Maç oluşturuldu',
        message: `Katılım kodu: ${m.joinCode}`,
        actionLabel: 'Kopyala',
        onActionPress: () => void Clipboard.setStringAsync(copyPayload),
      };
      setVenue('');
      setMaxPlayers(14);
      setPrice('');
      setPaymentMethod(null);
      setIbanAccountName('');
      setPaymentNote('');
      syncFromStored('');
      setOverrideIban(!hasValidProfileIban);
      sheetRef.current?.dismiss();
    } catch (e) {
      Alert.alert('Hata', toUserMessage(e, 'Maç oluşturulamadı.'));
    }
  };

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return (
    <View style={styles.placeholder}>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        onDismiss={handleSheetDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <Text style={[typography.title, styles.title]}>Yeni Maç</Text>
          <Text style={styles.label}>Grup (isteğe bağlı)</Text>
          <View style={styles.groupSelectList}>
            <Pressable
              testID="match:create:group-general"
              accessibilityRole="button"
              accessibilityState={{ selected: selectedGroupId === null }}
              accessibilityLabel="Genel maç"
              onPress={() => {
                void selectionTick();
                setSelectedGroupId(null);
              }}
              style={({ pressed }) => [
                styles.groupSelectRow,
                selectedGroupId === null && styles.groupSelectRowActive,
                pressed && styles.groupSelectRowPressed,
              ]}
            >
              <Text
                style={[
                  styles.groupSelectRowText,
                  selectedGroupId === null && styles.groupSelectRowTextActive,
                ]}
              >
                Genel maç
              </Text>
            </Pressable>
            {myGroups.map((group) => (
              <Pressable
                key={group.id}
                testID={`match:create:group:${group.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedGroupId === group.id }}
                accessibilityLabel={group.name}
                onPress={() => {
                  void selectionTick();
                  setSelectedGroupId(group.id);
                }}
                style={({ pressed }) => [
                  styles.groupSelectRow,
                  selectedGroupId === group.id && styles.groupSelectRowActive,
                  pressed && styles.groupSelectRowPressed,
                ]}
              >
                <Text
                  style={[
                    styles.groupSelectRowText,
                    selectedGroupId === group.id && styles.groupSelectRowTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {group.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Saha</Text>
          <BottomSheetTextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Örn. Kadıköy Halı Saha"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Tarih ve saat</Text>
          <PillButton
            variant="ghost"
            testID="match:create:starts-at"
            accessibilityLabel={startsAtAccessibilityLabel}
            onPress={() => {
              setPickerMinDate(new Date());
              if (Platform.OS === 'android') {
                setAndroidPickerStep('date');
              } else {
                setShowPicker(true);
              }
            }}
          >
            <View style={styles.startsAtButtonInner}>
              <Text style={styles.startsAtDateLine}>{startsAtDateLine}</Text>
              <Text style={styles.startsAtTimeLine}>{startsAtTimeLine}</Text>
            </View>
          </PillButton>
          {Platform.OS === 'ios' && showPicker ? (
            <DateTimePicker
              value={startsAt}
              mode="datetime"
              display="spinner"
              minuteInterval={30}
              minimumDate={pickerMinDate}
              onChange={(_, d) => {
                setShowPicker(Platform.OS === 'ios');
                if (d) setStartsAt(normalizeStartsAtFromPicker(d));
              }}
            />
          ) : null}
          {Platform.OS === 'android' && androidPickerStep === 'date' ? (
            <DateTimePicker
              value={startsAt}
              mode="date"
              display="default"
              minimumDate={pickerMinDate}
              onChange={onAndroidDateChange}
            />
          ) : null}
          {Platform.OS === 'android' && androidPickerStep === 'time' ? (
            <DateTimePicker
              value={startsAt}
              mode="time"
              display="default"
              is24Hour
              minuteInterval={30}
              onChange={onAndroidTimeChange}
            />
          ) : null}
          <Text style={styles.label}>Maksimum oyuncu</Text>
          <View style={styles.maxPlayersBlock}>
            <Text
              style={styles.maxPlayersValue}
              accessibilityLabel={`Maksimum oyuncu: ${maxPlayers}`}
            >
              {maxPlayers}
            </Text>
            <Slider
              testID="match:create:max-players"
              accessibilityLabel={`Maksimum oyuncu, ${maxPlayers} kişi`}
              style={styles.maxPlayersSlider}
              value={maxPlayers}
              onValueChange={setMaxPlayers}
              minimumValue={MIN_MAX_PLAYERS}
              maximumValue={MAX_MAX_PLAYERS}
              step={1}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accent}
            />
            <View style={styles.maxPlayersRange}>
              <Text style={styles.ibanHint}>{MIN_MAX_PLAYERS}</Text>
              <Text style={styles.ibanHint}>{MAX_MAX_PLAYERS}</Text>
            </View>
          </View>
          <Text style={styles.label}>Ödeme yöntemi</Text>
          <View style={styles.paymentSegmentRow}>
            <Pressable
              testID="match:create:payment-iban"
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === 'iban' }}
              accessibilityLabel="IBAN"
              onPress={() => {
                void selectionTick();
                setPaymentMethod('iban');
              }}
              style={({ pressed }) => [
                styles.paymentSegment,
                paymentMethod === 'iban' && styles.paymentSegmentActive,
                pressed && styles.paymentSegmentPressed,
              ]}
            >
              <Text
                style={[
                  styles.paymentSegmentText,
                  paymentMethod === 'iban' && styles.paymentSegmentTextActive,
                ]}
                numberOfLines={2}
              >
                IBAN
              </Text>
            </Pressable>
            <Pressable
              testID="match:create:payment-cash"
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === 'cash' }}
              accessibilityLabel="Nakit"
              onPress={() => {
                void selectionTick();
                setPaymentMethod('cash');
              }}
              style={({ pressed }) => [
                styles.paymentSegment,
                paymentMethod === 'cash' && styles.paymentSegmentActive,
                pressed && styles.paymentSegmentPressed,
              ]}
            >
              <Text
                style={[
                  styles.paymentSegmentText,
                  paymentMethod === 'cash' && styles.paymentSegmentTextActive,
                ]}
                numberOfLines={2}
              >
                Nakit
              </Text>
            </Pressable>
            <Pressable
              testID="match:create:payment-note"
              accessibilityRole="button"
              accessibilityState={{ selected: paymentMethod === 'note_only' }}
              accessibilityLabel="Sadece not ekle"
              onPress={() => {
                void selectionTick();
                setPaymentMethod('note_only');
              }}
              style={({ pressed }) => [
                styles.paymentSegment,
                paymentMethod === 'note_only' && styles.paymentSegmentActive,
                pressed && styles.paymentSegmentPressed,
              ]}
            >
              <Text
                style={[
                  styles.paymentSegmentText,
                  paymentMethod === 'note_only' && styles.paymentSegmentTextActive,
                ]}
                numberOfLines={2}
              >
                Not
              </Text>
            </Pressable>
          </View>
          {paymentMethod !== 'note_only' ? (
            <>
              <Text style={styles.label}>Kişi başı ücret (₺) — isteğe bağlı</Text>
              <BottomSheetTextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            </>
          ) : null}
          {paymentMethod === 'iban' ? (
            <>
              <Text style={styles.label}>IBAN</Text>
              {hasValidProfileIban && !overrideIban ? (
                <View style={styles.ibanBlock}>
                  <Text style={styles.ibanMasked}>{maskIban(profileNorm)}</Text>
                  <Text style={styles.ibanHint}>Profilinizdeki IBAN bu maç için kullanılacak.</Text>
                  <PillButton
                    title="Başka IBAN kullanacağım"
                    variant="ghost"
                    onPress={() => {
                      setOverrideIban(true);
                      setIban(formatIbanForInput('TR'));
                    }}
                  />
                </View>
              ) : (
                <View style={styles.ibanBlock}>
                  {hasValidProfileIban ? (
                    <PillButton
                      title="Profil IBAN'ına dön"
                      variant="ghost"
                      onPress={() => {
                        setOverrideIban(false);
                        syncFromStored('');
                      }}
                    />
                  ) : null}
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
                </View>
              )}
              <Text style={styles.label}>IBAN alıcı ad soyad</Text>
              <BottomSheetTextInput
                value={ibanAccountName}
                onChangeText={(v) => setIbanAccountName(v.toLocaleUpperCase('tr-TR'))}
                placeholder="Örn. ALİ YILMAZ"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                autoCapitalize="characters"
                style={styles.input}
              />
            </>
          ) : null}
          {paymentMethod === 'cash' ? (
            <Text style={styles.ibanHint}>Ödeme nakit olarak sahada toplanacaktır.</Text>
          ) : null}
          {paymentMethod === 'note_only' ? (
            <>
              <Text style={styles.label}>Ödeme notu</Text>
              <BottomSheetTextInput
                value={paymentNote}
                onChangeText={(v) => setPaymentNote(v.slice(0, 120))}
                placeholder="Örn: Maç ücretsiz olacak beyler."
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                multiline
                style={[styles.input, styles.noteInput]}
              />
              <Text style={styles.ibanHint}>{paymentNote.trim().length}/120 karakter</Text>
            </>
          ) : null}
          <PillButton title="Maçı Oluştur" onPress={onSubmit} disabled={!paymentMethod} style={styles.cta} />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetBg: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    backgroundColor: colors.border,
  },
  sheetBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
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
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    backgroundColor: colors.background,
  },
  maxPlayersBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
    ...shadows.sm,
  },
  maxPlayersValue: {
    ...typography.subtitle,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  maxPlayersSlider: {
    width: '100%',
    height: 40,
  },
  maxPlayersRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  cta: {
    marginTop: spacing.lg,
  },
  ibanBlock: {
    gap: spacing.sm,
  },
  groupSelectList: {
    width: '100%',
    gap: spacing.sm,
  },
  groupSelectRow: {
    width: '100%',
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
    ...shadows.sm,
  },
  groupSelectRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  groupSelectRowPressed: {
    opacity: 0.92,
  },
  groupSelectRowText: {
    ...typography.body,
    color: colors.textMuted,
  },
  groupSelectRowTextActive: {
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  startsAtButtonInner: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  startsAtDateLine: {
    ...typography.subtitle,
    fontSize: 15,
    color: colors.text,
  },
  startsAtTimeLine: {
    ...typography.caption,
    color: colors.textMuted,
  },
  paymentSegmentRow: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.xs,
  },
  paymentSegment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  paymentSegmentActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  paymentSegmentPressed: {
    opacity: 0.92,
  },
  paymentSegmentText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
  },
  paymentSegmentTextActive: {
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  ibanMasked: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  ibanHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
