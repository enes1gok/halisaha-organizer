import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PillButton } from '../components/PillButton';
import { colors, spacing, typography } from '../theme';
import { useAppStore } from '../store/useAppStore';
import { useTurkishIbanField } from '../hooks/useTurkishIbanField';
import {
  formatIbanForInput,
  isValidTurkishIban,
  maskIban,
  normalizeIban,
} from '../utils/iban';

export function CreateMatchTabScreen() {
  const navigation = useNavigation();
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['82%'], []);
  const createMatch = useAppStore((s) => s.createMatch);
  const userId = useAppStore((s) => s.getCurrentUserId());
  const profileIbanRaw = useAppStore((s) => s.players.find((p) => p.id === userId)?.iban);

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
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 86400000));
  const [showPicker, setShowPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const t = requestAnimationFrame(() => sheetRef.current?.present());
      const valid = profileNorm.length > 0 && isValidTurkishIban(profileNorm);
      setOverrideIban(!valid);
      syncFromStored('');
      return () => cancelAnimationFrame(t);
    }, [profileNorm, syncFromStored]),
  );

  const goHome = () => {
    navigation.navigate('HomeTab' as never);
  };

  const onSubmit = () => {
    if (!venue.trim()) {
      Alert.alert('Eksik bilgi', 'Saha adını girin.');
      return;
    }
    const ibanNormForMatch =
      !overrideIban && hasValidProfileIban ? profileNorm : normalizeIban(iban);
    if (ibanNormForMatch.length > 0 && !isValidTurkishIban(ibanNormForMatch)) {
      Alert.alert(
        'Geçersiz IBAN',
        'Türkiye IBAN’ı TR ile başlamalı, toplam 26 karakter olmalı ve kontrol basamağı doğru olmalı. Örn: TR33 0006 1005 1978 6457 8413 26',
      );
      return;
    }
    const mp = Math.min(22, Math.max(4, parseInt(maxPlayers || '14', 10) || 14));
    const priceNum = price.trim() ? parseFloat(price.replace(',', '.')) : undefined;
    const m = createMatch({
      venue: venue.trim(),
      startsAt: startsAt.toISOString(),
      maxPlayers: mp,
      pricePerPerson: priceNum && priceNum > 0 ? priceNum : undefined,
      iban: ibanNormForMatch || undefined,
    });
    Alert.alert(
      'Maç oluşturuldu',
      `Katılım kodu: ${m.joinCode}\nBağlantı: halisaha://match/${m.id}`,
      [{ text: 'Tamam', onPress: () => sheetRef.current?.dismiss() }],
    );
    setVenue('');
    setPrice('');
    syncFromStored('');
    setOverrideIban(!hasValidProfileIban);
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
        onDismiss={goHome}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <Text style={[typography.title, styles.title]}>Yeni Maç</Text>
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
            onPress={() => setShowPicker(true)}
          />
          {showPicker ? (
            <DateTimePicker
              value={startsAt}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => {
                setShowPicker(Platform.OS === 'ios');
                if (d) setStartsAt(d);
              }}
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
          <Text style={styles.label}>Kişi başı ücret (₺) — isteğe bağlı</Text>
          <BottomSheetTextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>IBAN — isteğe bağlı</Text>
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
          <PillButton title="Maçı Oluştur" onPress={onSubmit} style={styles.cta} />
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
  ibanMasked: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  ibanHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
