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
import { colors, spacing, typography } from '../theme';
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
  const [maxPlayers, setMaxPlayers] = useState('14');
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MatchPaymentMethod | null>(null);
  const [ibanAccountName, setIbanAccountName] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 86400000));
  const myGroups = useMemo(
    () =>
      groups.filter((group) =>
        memberships.some((membership) => membership.groupId === group.id && membership.playerId === userId),
      ),
    [groups, memberships, userId],
  );

  const [showPicker, setShowPicker] = useState(false);
  /** Android: `datetime` mode is unsupported; use date then time (see datetimepicker #907). */
  const [androidPickerStep, setAndroidPickerStep] = useState<'date' | 'time' | null>(null);

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
        return merged;
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
        return merged;
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
    const mp = Math.min(22, Math.max(4, parseInt(maxPlayers || '14', 10) || 14));
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
      const copyPayload = `Katılım kodu: ${m.joinCode}\nhalisaha://match/${m.id}`;
      pendingMatchToastRef.current = {
        title: 'Maç oluşturuldu',
        message: `Katılım kodu: ${m.joinCode}\nBağlantı: halisaha://match/${m.id}`,
        actionLabel: 'Kopyala',
        onActionPress: () => void Clipboard.setStringAsync(copyPayload),
      };
      setVenue('');
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
          <View style={styles.groupRow}>
            <Pressable
              onPress={() => setSelectedGroupId(null)}
              style={[styles.groupChip, selectedGroupId === null && styles.groupChipActive]}
            >
              <Text style={[styles.groupChipText, selectedGroupId === null && styles.groupChipTextActive]}>
                Genel maç
              </Text>
            </Pressable>
            {myGroups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => setSelectedGroupId(group.id)}
                style={[styles.groupChip, selectedGroupId === group.id && styles.groupChipActive]}
              >
                <Text
                  style={[
                    styles.groupChipText,
                    selectedGroupId === group.id && styles.groupChipTextActive,
                  ]}
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
            title={startsAt.toLocaleString('tr-TR')}
            variant="ghost"
            onPress={() => {
              if (Platform.OS === 'android') {
                setAndroidPickerStep('date');
              } else {
                setShowPicker(true);
              }
            }}
          />
          {Platform.OS === 'ios' && showPicker ? (
            <DateTimePicker
              value={startsAt}
              mode="datetime"
              display="spinner"
              onChange={(_, d) => {
                setShowPicker(Platform.OS === 'ios');
                if (d) setStartsAt(d);
              }}
            />
          ) : null}
          {Platform.OS === 'android' && androidPickerStep === 'date' ? (
            <DateTimePicker
              value={startsAt}
              mode="date"
              display="default"
              onChange={onAndroidDateChange}
            />
          ) : null}
          {Platform.OS === 'android' && androidPickerStep === 'time' ? (
            <DateTimePicker
              value={startsAt}
              mode="time"
              display="default"
              is24Hour
              onChange={onAndroidTimeChange}
            />
          ) : null}
          <Text style={styles.label}>Maksimum oyuncu</Text>
          <BottomSheetTextInput
            value={maxPlayers}
            onChangeText={setMaxPlayers}
            keyboardType="number-pad"
            placeholder="14"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Ödeme yöntemi</Text>
          <View style={styles.groupRow}>
            <Pressable
              onPress={() => setPaymentMethod('iban')}
              style={[styles.groupChip, paymentMethod === 'iban' && styles.groupChipActive]}
            >
              <Text style={[styles.groupChipText, paymentMethod === 'iban' && styles.groupChipTextActive]}>
                IBAN
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPaymentMethod('cash')}
              style={[styles.groupChip, paymentMethod === 'cash' && styles.groupChipActive]}
            >
              <Text style={[styles.groupChipText, paymentMethod === 'cash' && styles.groupChipTextActive]}>
                Nakit
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPaymentMethod('note_only')}
              style={[styles.groupChip, paymentMethod === 'note_only' && styles.groupChipActive]}
            >
              <Text style={[styles.groupChipText, paymentMethod === 'note_only' && styles.groupChipTextActive]}>
                Sadece not ekle
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
  cta: {
    marginTop: spacing.lg,
  },
  ibanBlock: {
    gap: spacing.sm,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  groupChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  groupChipText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  groupChipTextActive: {
    color: colors.accent,
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
