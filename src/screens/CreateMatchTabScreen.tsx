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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeViewGestureHandler } from 'react-native-gesture-handler';
import { PillButton } from '../components/PillButton';
import type { ShowToastOptions } from '../context/toastTypes';
import { radius, shadows, spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import {
  useAuthStore,
  useGroupsStore,
  useMatchTemplatesStore,
  useMatchesStore,
  usePlayersStore,
} from '../store';
import { useUserFeedback } from '../utils/userFeedback';
import { useTurkishIbanField } from '../hooks/useTurkishIbanField';
import { MATCH_TEMPLATE_NAME_MAX_LEN, type MatchPaymentMethod, type MatchTemplate } from '../types/domain';
import {
  formatIbanForInput,
  isValidTurkishIban,
  maskIban,
  normalizeIban,
} from '../utils/iban';
import { selectionTick } from '../utils/haptics';
import {
  applyMatchTemplateToFormFields,
  buildMatchTemplateFromForm,
} from '../utils/matchTemplateApply';
import {
  MATCH_MAX_PLAYERS_MAX,
  MATCH_MAX_PLAYERS_MIN,
  clampEvenMatchMaxPlayers,
} from '../utils/matchMaxPlayers';
import { normalizeStartsAtFromPicker } from '../utils/matchStartsAtNormalize';



function sanitizeMaxPlayersDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 2);
}

export function CreateMatchTabScreen() {
  const navigation = useNavigation();
  const { showToast, showValidationToast, showApiErrorToast } = useUserFeedback();
  const { colors } = useTheme();
  const styles = useStyles();
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
  const [maxPlayersInputText, setMaxPlayersInputText] = useState('14');
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<MatchPaymentMethod | null>(null);
  const [ibanAccountName, setIbanAccountName] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
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

  const groupTriggerLabel = useMemo(() => {
    if (selectedGroupId === null) return 'Genel maç';
    const name = groups.find((g) => g.id === selectedGroupId)?.name;
    return name ?? 'Genel maç';
  }, [selectedGroupId, groups]);

  const matchTemplates = useMatchTemplatesStore((s) => s.matchTemplates);
  const addMatchTemplate = useMatchTemplatesStore((s) => s.addMatchTemplate);
  const removeMatchTemplate = useMatchTemplatesStore((s) => s.removeMatchTemplate);

  const [templateDraftName, setTemplateDraftName] = useState('');
  const [templateSaveExpanded, setTemplateSaveExpanded] = useState(false);

  const applyTemplate = useCallback(
    (tpl: MatchTemplate) => {
      const patch = applyMatchTemplateToFormFields(tpl, { fallbackStartsAt: startsAt });
      setVenue(patch.venue);
      setMaxPlayers(patch.maxPlayers);
      setMaxPlayersInputText(patch.maxPlayersInputText);
      setSelectedGroupId(patch.selectedGroupId);
      setStartsAt(patch.startsAt);
      setPaymentMethod(patch.paymentMethod);
      setPrice(patch.price);
      setIbanAccountName(patch.ibanAccountName);
      setPaymentNote(patch.paymentNote);
      setOverrideIban(patch.overrideIban);
      if (patch.overrideIban) {
        syncFromStored(
          patch.ibanCompactForInput
            ? formatIbanForInput(patch.ibanCompactForInput)
            : formatIbanForInput('TR'),
        );
      } else {
        syncFromStored('');
      }
      void selectionTick();
    },
    [startsAt, syncFromStored],
  );

  const onSaveTemplate = useCallback(() => {
    const built = buildMatchTemplateFromForm({
      name: templateDraftName,
      venue,
      maxPlayers,
      selectedGroupId,
      startsAt,
      paymentMethod,
      price,
      profileIbanNorm: profileNorm,
      ibanFieldNorm: normalizeIban(iban),
      ibanAccountName,
      paymentNote,
      overrideIban,
      hasValidProfileIban,
    });
    if (!built.ok) {
      showValidationToast('Şablon kaydedilemedi', built.message);
      return;
    }
    addMatchTemplate(built.template);
    setTemplateDraftName('');
    setTemplateSaveExpanded(false);
    showToast({
      title: 'Şablon kaydedildi',
      message: `"${built.template.name}" kaydedildi.`,
    });
  }, [
    templateDraftName,
    venue,
    maxPlayers,
    selectedGroupId,
    startsAt,
    paymentMethod,
    price,
    profileNorm,
    iban,
    ibanAccountName,
    paymentNote,
    overrideIban,
    hasValidProfileIban,
    addMatchTemplate,
    showValidationToast,
    showToast,
  ]);

  const { startsAtDateLine, startsAtTimeLine } = useMemo(() => {
    const dateLine = startsAt.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const timeLine = startsAt.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      startsAtDateLine: dateLine,
      startsAtTimeLine: timeLine,
    };
  }, [startsAt]);

  const [iosPickerMode, setIosPickerMode] = useState<'date' | 'time' | null>(null);
  /** Android: `datetime` mode is unsupported; use date then time (see datetimepicker issue 907). */
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
      setAndroidPickerStep(null);
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
    setGroupPickerOpen(false);
    goHome();
    const pending = pendingMatchToastRef.current;
    pendingMatchToastRef.current = null;
    if (pending) {
      setTimeout(() => showToast(pending), 400);
    }
  }, [goHome, showToast]);



  const onMaxPlayersSliderChange = useCallback((v: number) => {
    const even = clampEvenMatchMaxPlayers(Math.round(v));
    setMaxPlayers(even);
    setMaxPlayersInputText(String(even));
  }, []);

  const onMaxPlayersInputChange = useCallback((text: string) => {
    const digits = sanitizeMaxPlayersDigits(text);
    setMaxPlayersInputText(digits);
    if (digits.length > 0) {
      const n = parseInt(digits, 10);
      if (
        !Number.isNaN(n) &&
        n >= MATCH_MAX_PLAYERS_MIN &&
        n <= MATCH_MAX_PLAYERS_MAX
      ) {
        const even = clampEvenMatchMaxPlayers(n);
        setMaxPlayers(even);
        setMaxPlayersInputText(String(even));
      }
    }
  }, []);

  const onMaxPlayersInputBlur = useCallback(() => {
    const trimmed = maxPlayersInputText.trim();
    if (trimmed === '') {
      const c = clampEvenMatchMaxPlayers(maxPlayers);
      setMaxPlayers(c);
      setMaxPlayersInputText(String(c));
      return;
    }
    const n = parseInt(trimmed, 10);
    const c = clampEvenMatchMaxPlayers(Number.isNaN(n) ? maxPlayers : n);
    setMaxPlayers(c);
    setMaxPlayersInputText(String(c));
  }, [maxPlayers, maxPlayersInputText]);

  const handlePriceChange = useCallback((text: string) => {
    let cleaned = text.replace(/[^\d.,]/g, '');
    if (!cleaned) {
      setPrice('');
      return;
    }
    if (price.endsWith(' ₺')) {
      const oldClean = price.replace(/[^\d.,]/g, '');
      if (text.length < price.length && cleaned === oldClean) {
        cleaned = cleaned.slice(0, -1);
      }
    }
    if (!cleaned) {
      setPrice('');
    } else {
      setPrice(`${cleaned} ₺`);
    }
  }, [price]);

  const onSubmit = async () => {
    if (!venue.trim()) {
      showValidationToast('Eksik bilgi', 'Saha adını girin.');
      return;
    }
    if (!paymentMethod) {
      showValidationToast('Eksik bilgi', 'Lütfen ödeme yöntemini seçin.');
      return;
    }
    const ibanNormForMatch =
      paymentMethod === 'iban' ? (!overrideIban && hasValidProfileIban ? profileNorm : normalizeIban(iban)) : '';
    if (paymentMethod === 'iban' && (ibanNormForMatch.length === 0 || !isValidTurkishIban(ibanNormForMatch))) {
      showValidationToast(
        'Geçersiz IBAN',
        'Türkiye IBAN’ı TR ile başlamalı, toplam 26 karakter olmalı ve kontrol basamağı doğru olmalı. Örn: TR33 0006 1005 1978 6457 8413 26',
      );
      return;
    }
    const ibanAccountNameNorm =
      paymentMethod === 'iban' ? ibanAccountName.trim().toLocaleUpperCase('tr-TR') : '';
    if (paymentMethod === 'iban' && ibanAccountNameNorm.length === 0) {
      showValidationToast('Eksik bilgi', 'IBAN alıcı ad soyad bilgisini girin.');
      return;
    }
    const paymentNoteNorm = paymentMethod === 'note_only' ? paymentNote.trim() : '';
    if (paymentMethod === 'note_only' && paymentNoteNorm.length === 0) {
      showValidationToast('Eksik bilgi', 'Sadece not ekle seçeneğinde ödeme notu zorunludur.');
      return;
    }
    if (paymentMethod === 'note_only' && paymentNoteNorm.length > 120) {
      showValidationToast('Geçersiz not', 'Ödeme notu en fazla 120 karakter olabilir.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      showValidationToast('Geçersiz tarih', 'Maç başlangıcı geçmişte olamaz.');
      return;
    }
    const trimmedPlayers = maxPlayersInputText.trim();
    const parsedPlayers = trimmedPlayers === '' ? NaN : parseInt(trimmedPlayers, 10);
    const mp = clampEvenMatchMaxPlayers(Number.isNaN(parsedPlayers) ? maxPlayers : parsedPlayers);
    if (String(mp) !== maxPlayersInputText.trim()) {
      setMaxPlayers(mp);
      setMaxPlayersInputText(String(mp));
    }
    const rawPrice = price.replace(/[^\d.,]/g, '');
    const priceNum = rawPrice ? parseFloat(rawPrice.replace(',', '.')) : undefined;
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
      setMaxPlayersInputText('14');
      setPrice('');
      setPaymentMethod(null);
      setIbanAccountName('');
      setPaymentNote('');
      syncFromStored('');
      setOverrideIban(!hasValidProfileIban);
      setTemplateSaveExpanded(false);
      setTemplateDraftName('');
      setSelectedGroupId(null);
      sheetRef.current?.dismiss();
    } catch (e) {
      showApiErrorToast(e, {
        uiOperation: 'CreateMatchTabScreen:createMatch',
        fallbackMessage: 'Maç oluşturulamadı.',
        mapOperation: 'insertMatchWithOrganizerAttendee.create_match_rpc',
      });
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
        <BottomSheetScrollView
          contentContainerStyle={styles.sheetBody}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[typography.title, styles.title]}>Yeni Maç</Text>
          {matchTemplates.length > 0 ? (
            <View style={styles.templateBlock}>
              <Text style={styles.templateSectionLabel}>Şablonlar</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templateChipRow}
                keyboardShouldPersistTaps="handled"
              >
                {matchTemplates.map((tpl) => (
                  <View key={tpl.id} style={styles.templateChipWrap}>
                    <Pressable
                      testID={`match:template:${tpl.id}:apply`}
                      accessibilityRole="button"
                      accessibilityLabel={`Şablon uygula: ${tpl.name}`}
                      onPress={() => {
                        void selectionTick();
                        applyTemplate(tpl);
                      }}
                      style={({ pressed }) => [styles.templateChip, pressed && styles.templateChipPressed]}
                    >
                      <Text style={styles.templateChipText} numberOfLines={1}>
                        {tpl.name}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`match:template:${tpl.id}:remove`}
                      accessibilityRole="button"
                      accessibilityLabel={`Şablonu sil: ${tpl.name}`}
                      hitSlop={8}
                      onPress={() => {
                        void selectionTick();
                        Alert.alert('Şablonu sil', `"${tpl.name}" silinsin mi?`, [
                          { text: 'İptal', style: 'cancel' },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: () => removeMatchTemplate(tpl.id),
                          },
                        ]);
                      }}
                      style={({ pressed }) => [
                        styles.templateChipRemove,
                        pressed && styles.templateChipRemovePressed,
                      ]}
                    >
                      <Text style={styles.templateChipRemoveMark}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <PillButton
            title={
              templateSaveExpanded ? 'Şablon kaydetmeyi iptal et' : 'Bu ayarları şablon olarak kaydet'
            }
            variant="ghost"
            testID="match:template:toggle-save"
            onPress={() => {
              void selectionTick();
              setTemplateSaveExpanded((v) => {
                if (v) setTemplateDraftName('');
                return !v;
              });
            }}
          />
          {templateSaveExpanded ? (
            <View style={styles.templateSaveBlock}>
              <Text style={styles.label}>Şablon adı</Text>
              <BottomSheetTextInput
                value={templateDraftName}
                onChangeText={(t) => setTemplateDraftName(t.slice(0, MATCH_TEMPLATE_NAME_MAX_LEN))}
                placeholder="Örn. Çarşamba Kadıköy"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={MATCH_TEMPLATE_NAME_MAX_LEN}
                testID="match:template:name-input"
                accessibilityLabel="Şablon adı"
              />
              <Text style={styles.ibanHint}>
                {templateDraftName.trim().length}/{MATCH_TEMPLATE_NAME_MAX_LEN} karakter
              </Text>
              <View style={styles.templateSaveActions}>
                <PillButton
                  title="Şablonu kaydet"
                  onPress={() => {
                    void selectionTick();
                    onSaveTemplate();
                  }}
                  testID="match:template:save-commit"
                />
              </View>
            </View>
          ) : null}
          <View>
          <Text style={styles.label}>Grup (isteğe bağlı)</Text>
          <Pressable
            testID="match:create:group-open"
            accessibilityRole="button"
            accessibilityLabel={`Grup, ${groupTriggerLabel}`}
            accessibilityHint="Grup listesini açar"
            onPress={() => {
              void selectionTick();
              setGroupPickerOpen(true);
            }}
            style={({ pressed }) => [styles.groupPickerTrigger, pressed && styles.groupPickerTriggerPressed]}
          >
            <Text style={styles.groupPickerTriggerText} numberOfLines={2}>
              {groupTriggerLabel}
            </Text>
            <Ionicons name="chevron-down" size={22} color={colors.textMuted} accessibilityElementsHidden />
          </Pressable>
          </View>
          <View>
          <Text style={styles.label}>Saha</Text>
          <BottomSheetTextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Örn. Kadıköy Halı Saha"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          </View>
          <View>
          <View style={styles.startsAtButtonsRow}>
            <View style={styles.startsAtSegmentColumn}>
              <Text style={styles.label}>Tarih</Text>
              <PillButton
                variant="ghost"
                style={styles.startsAtSegmentButton}
                testID="match:create:starts-at-date"
                accessibilityLabel={`Tarih: ${startsAtDateLine}`}
                onPress={() => {
                  setPickerMinDate(new Date());
                  if (Platform.OS === 'android') {
                    setAndroidPickerStep('date');
                  } else {
                    setIosPickerMode('date');
                  }
                }}
              >
                <Text style={styles.startsAtDateLine}>{startsAtDateLine}</Text>
              </PillButton>
            </View>
            <View style={styles.startsAtSegmentColumn}>
              <Text style={styles.label}>Saat</Text>
              <PillButton
                variant="ghost"
                style={styles.startsAtSegmentButton}
                testID="match:create:starts-at-time"
                accessibilityLabel={`Saat: ${startsAtTimeLine}`}
                onPress={() => {
                  setPickerMinDate(new Date());
                  if (Platform.OS === 'android') {
                    setAndroidPickerStep('time');
                  } else {
                    setIosPickerMode('time');
                  }
                }}
              >
                <Text style={styles.startsAtTimeLine}>{startsAtTimeLine}</Text>
              </PillButton>
            </View>
          </View>
          {Platform.OS === 'ios' && iosPickerMode === 'date' ? (
            <DateTimePicker
              value={startsAt}
              mode="date"
              display="spinner"
              minimumDate={pickerMinDate}
              onChange={(_, d) => {
                if (d) setStartsAt(normalizeStartsAtFromPicker(d));
              }}
            />
          ) : null}
          {Platform.OS === 'ios' && iosPickerMode === 'time' ? (
            <DateTimePicker
              value={startsAt}
              mode="time"
              display="spinner"
              minuteInterval={30}
              onChange={(_, d) => {
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
          </View>
          <View>
          <Text style={styles.label}>Maksimum oyuncu</Text>
          <View style={styles.maxPlayersBlock}>
            <View style={styles.maxPlayersTopRow}>
              <BottomSheetTextInput
                testID="match:create:max-players-input"
                value={maxPlayersInputText}
                onChangeText={onMaxPlayersInputChange}
                onBlur={onMaxPlayersInputBlur}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Maksimum oyuncu sayısı, 4 ile 22 arası çift sayı"
                placeholder={`${MATCH_MAX_PLAYERS_MIN}`}
                placeholderTextColor={colors.textMuted}
                style={styles.maxPlayersInput}
              />
              <Text style={styles.maxPlayersSuffix} importantForAccessibility="no">
                kişi
              </Text>
            </View>
            <NativeViewGestureHandler disallowInterruption={true} shouldActivateOnStart={true}>
              <Slider
                testID="match:create:max-players"
                accessibilityLabel={`Maksimum oyuncu kaydırıcı, ${maxPlayers} kişi, 4 ile 22 arası çift sayı`}
                style={styles.maxPlayersSlider}
                value={maxPlayers}
                onValueChange={onMaxPlayersSliderChange}
                minimumValue={MATCH_MAX_PLAYERS_MIN}
                maximumValue={MATCH_MAX_PLAYERS_MAX}
                step={2}
                minimumTrackTintColor={colors.accent}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.accent}
              />
            </NativeViewGestureHandler>
            <View style={styles.maxPlayersRange}>
              <Text style={styles.ibanHint}>{MATCH_MAX_PLAYERS_MIN}</Text>
              <Text style={styles.ibanHint}>{MATCH_MAX_PLAYERS_MAX}</Text>
            </View>
          </View>
          </View>
          <View>
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
              <Text style={styles.label}>Kişi başı ücret — isteğe bağlı</Text>
              <BottomSheetTextInput
                value={price}
                onChangeText={handlePriceChange}
                keyboardType="decimal-pad"
                placeholder="0 ₺"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
              />
            </>
          ) : null}
          {paymentMethod === 'iban' ? (
            <>
              <View style={styles.ibanLabelRow}>
                <Text style={styles.ibanLabelText}>IBAN</Text>
                {hasValidProfileIban && !overrideIban ? (
                  <View
                    style={styles.profileIbanBadge}
                    accessibilityRole="text"
                    accessibilityLabel="Profil IBAN'ı kullanılıyor"
                  >
                    <Text style={styles.profileIbanBadgeText}>Profil IBAN'ı</Text>
                  </View>
                ) : null}
              </View>
              {hasValidProfileIban && !overrideIban ? (
                <View style={styles.ibanBlock}>
                  <Text style={styles.ibanMasked}>{maskIban(profileNorm)}</Text>
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
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
      <Modal
        transparent
        animationType="fade"
        visible={groupPickerOpen}
        onRequestClose={() => setGroupPickerOpen(false)}
      >
        <Pressable
          style={styles.groupModalBackdrop}
          onPress={() => setGroupPickerOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Grup seçimini kapat"
        >
          <Pressable style={styles.groupModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.groupModalTitle}>Grup seçin</Text>
            <ScrollView
              style={styles.groupModalScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              <Pressable
                testID="match:create:group-general"
                accessibilityRole="button"
                accessibilityState={{ selected: selectedGroupId === null }}
                accessibilityLabel="Genel maç"
                onPress={() => {
                  void selectionTick();
                  setSelectedGroupId(null);
                  setGroupPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.groupModalOption,
                  selectedGroupId === null && styles.groupModalOptionSelected,
                  pressed && styles.groupModalOptionPressed,
                ]}
              >
                <Text
                  style={[
                    styles.groupModalOptionText,
                    selectedGroupId === null && styles.groupModalOptionTextSelected,
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
                    setGroupPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.groupModalOption,
                    selectedGroupId === group.id && styles.groupModalOptionSelected,
                    pressed && styles.groupModalOptionPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.groupModalOptionText,
                      selectedGroupId === group.id && styles.groupModalOptionTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {group.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    placeholder: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    sheetBg: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    handle: {
      backgroundColor: t.colors.border,
    },
    sheetBody: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: t.colors.text,
      marginBottom: spacing.sm,
    },
    templateBlock: {
      marginBottom: spacing.sm,
    },
    templateSectionLabel: {
      ...typography.caption,
      color: t.colors.textMuted,
      marginBottom: spacing.xs,
    },
    templateChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    templateChipWrap: {
      flexDirection: 'row',
      alignItems: 'stretch',
      maxWidth: 280,
      borderRadius: radius.pill,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
      ...shadows.sm,
    },
    templateChip: {
      flexShrink: 1,
      paddingVertical: 10,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
      minHeight: 44,
      justifyContent: 'center',
    },
    templateChipPressed: {
      opacity: 0.85,
    },
    templateChipText: {
      ...typography.caption,
      color: t.colors.text,
    },
    templateChipRemove: {
      paddingHorizontal: spacing.sm,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: 1,
      borderLeftColor: t.colors.border,
    },
    templateChipRemovePressed: {
      backgroundColor: t.colors.surface,
    },
    templateChipRemoveMark: {
      ...typography.subtitle,
      color: t.colors.textMuted,
      fontSize: 20,
      lineHeight: 22,
    },
    templateSaveBlock: {
      marginBottom: spacing.sm,
    },
    templateSaveActions: {
      marginTop: spacing.xs,
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
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: t.colors.text,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      backgroundColor: t.colors.background,
    },
    maxPlayersBlock: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      backgroundColor: t.colors.background,
      ...shadows.sm,
    },
    maxPlayersTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    maxPlayersInput: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
      minWidth: 56,
      maxWidth: 72,
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 18,
      textAlign: 'center',
      backgroundColor: t.colors.surface,
    },
    maxPlayersSuffix: {
      ...typography.body,
      color: t.colors.textMuted,
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
    ibanLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    ibanLabelText: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    profileIbanBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: t.colors.accentMuted,
    },
    profileIbanBadgeText: {
      ...typography.micro,
      color: t.colors.accent,
    },
    groupPickerTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
      gap: spacing.sm,
      ...shadows.sm,
    },
    groupPickerTriggerPressed: {
      opacity: 0.92,
    },
    groupPickerTriggerText: {
      ...typography.body,
      flex: 1,
      color: t.colors.text,
    },
    groupModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    groupModalCard: {
      borderRadius: radius.card,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      maxHeight: '75%',
      paddingVertical: spacing.md,
      ...shadows.sm,
    },
    groupModalTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    groupModalScroll: {
      maxHeight: 360,
    },
    groupModalOption: {
      minHeight: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
    },
    groupModalOptionSelected: {
      backgroundColor: t.colors.accentMuted,
    },
    groupModalOptionPressed: {
      opacity: 0.88,
    },
    groupModalOptionText: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    groupModalOptionTextSelected: {
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
    startsAtButtonsRow: {
      flexDirection: 'row',
      width: '100%',
      gap: spacing.sm,
    },
    startsAtSegmentColumn: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    startsAtSegmentButton: {
      width: '100%',
    },
    startsAtDateLine: {
      ...typography.subtitle,
      fontSize: 15,
      color: t.colors.text,
      textAlign: 'center',
    },
    startsAtTimeLine: {
      ...typography.caption,
      color: t.colors.textMuted,
      textAlign: 'center',
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
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.sm,
    },
    paymentSegmentActive: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accentMuted,
    },
    paymentSegmentPressed: {
      opacity: 0.92,
    },
    paymentSegmentText: {
      ...typography.caption,
      textAlign: 'center',
      color: t.colors.textMuted,
    },
    paymentSegmentTextActive: {
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
    ibanMasked: {
      ...typography.body,
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
    },
    ibanHint: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    noteInput: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
  }),
);
