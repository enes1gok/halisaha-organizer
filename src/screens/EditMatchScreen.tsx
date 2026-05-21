import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PillButton } from '../components/PillButton';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme';
import {
  useAuthStore,
  useMatchesStore,
  usePlayersStore,
} from '../store';
import { useUserFeedback } from '../utils/userFeedback';
import { useTurkishIbanField } from '../hooks/useTurkishIbanField';
import type { MatchPaymentMethod } from '../types/domain';
import {
  formatIbanForInput,
  isValidTurkishIban,
  maskIban,
  normalizeIban,
} from '../utils/iban';
import { selectionTick } from '../utils/haptics';
import {
  MATCH_MAX_PLAYERS_MAX,
  MATCH_MAX_PLAYERS_MIN,
  clampEvenMatchMaxPlayers,
} from '../utils/matchMaxPlayers';
import { normalizeStartsAtFromPicker } from '../utils/matchStartsAtNormalize';
import type { GroupsStackParamList, HomeStackParamList } from '../navigation/types';

type MatchStacks = HomeStackParamList & GroupsStackParamList;
type Nav = NativeStackNavigationProp<MatchStacks>;
type EditMatchRoute =
  | RouteProp<HomeStackParamList, 'EditMatch'>
  | RouteProp<GroupsStackParamList, 'EditMatch'>;

function sanitizeMaxPlayersDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 2);
}

export function EditMatchScreen() {
  const route = useRoute<EditMatchRoute>();
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast, showValidationToast, showApiErrorToast } = useUserFeedback();

  const { matchId } = route.params;
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const match = useMatchesStore((s) => s.getMatch(matchId));
  const updateMatchDetails = useMatchesStore((s) => s.updateMatchDetails);
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
  const [startsAt, setStartsAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pre-populate from match
  React.useEffect(() => {
    if (!match) return;
    setVenue(match.venue);
    setMaxPlayers(match.maxPlayers);
    setMaxPlayersInputText(String(match.maxPlayers));
    setPaymentMethod(match.paymentMethod);
    setPrice(String(match.pricePerPerson ?? ''));
    setIbanAccountName(match.ibanAccountName ?? '');
    setPaymentNote(match.paymentNote ?? '');
    setStartsAt(new Date(match.startsAt));
    if (match.paymentMethod === 'iban') {
      const norm = normalizeIban(match.iban ?? '');
      setIban(norm);
    }
  }, [match]);

  if (!match) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Maç bulunamadı</Text>
      </View>
    );
  }

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      const combined = new Date(date);
      combined.setHours(startsAt.getHours(), startsAt.getMinutes(), 0, 0);
      setStartsAt(combined);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (date) {
      const combined = new Date(startsAt);
      combined.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setStartsAt(combined);
    }
  };

  const handleMaxPlayersChange = (text: string) => {
    const sanitized = sanitizeMaxPlayersDigits(text);
    setMaxPlayersInputText(sanitized);
    if (sanitized) {
      const n = parseInt(sanitized, 10);
      const clamped = clampEvenMatchMaxPlayers(n);
      setMaxPlayers(clamped);
    }
  };

  const handleMaxPlayersSlider = (value: number) => {
    const clamped = clampEvenMatchMaxPlayers(value);
    setMaxPlayers(clamped);
    setMaxPlayersInputText(String(clamped));
  };

  const onSubmit = async () => {
    if (!venue.trim()) {
      showValidationToast('Lütfen yer bilgisini girin');
      return;
    }

    if (paymentMethod === 'iban') {
      const normalized = normalizeIban(iban);
      if (!isValidTurkishIban(normalized)) {
        showValidationToast('Geçersiz IBAN');
        return;
      }
      if (!ibanAccountName.trim()) {
        showValidationToast('Lütfen hesap adını girin');
        return;
      }
    }

    if (paymentMethod === 'note_only') {
      if (!paymentNote.trim()) {
        showValidationToast('Lütfen ödeme notunu girin');
        return;
      }
      if (paymentNote.trim().length > 120) {
        showValidationToast('Ödeme notu en fazla 120 karakter olmalıdır');
        return;
      }
    }

    try {
      setSubmitting(true);
      const startsAtNorm = normalizeStartsAtFromPicker(startsAt).toISOString();
      await updateMatchDetails({
        matchId,
        venue: venue.trim(),
        startsAt: startsAtNorm,
        maxPlayers,
        paymentMethod: paymentMethod!,
        pricePerPerson: price ? parseFloat(price) : undefined,
        iban: paymentMethod === 'iban' ? normalizeIban(iban) : undefined,
        ibanAccountName: paymentMethod === 'iban' ? ibanAccountName.trim() : undefined,
        paymentNote: paymentMethod === 'note_only' ? paymentNote.trim() : undefined,
      });
      showToast({ title: 'Maç güncellendi' });
      navigation.goBack();
    } catch (error) {
      showApiErrorToast(error, {
        uiOperation: 'EditMatch:updateMatchDetails',
        fallbackMessage: 'Maç güncellenemedi',
        mapOperation: 'updateMatchDetailsRemote',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = startsAt.toLocaleDateString('tr-TR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = startsAt.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    section: {
      marginVertical: spacing.sm,
    },
    label: {
      ...typography.body,
      fontWeight: '500',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    textInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: colors.text,
      ...typography.body,
      marginBottom: spacing.sm,
    },
    dateTimeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    dateTimeButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dateTimeButtonText: {
      ...typography.body,
      color: colors.text,
    },
    sliderContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: 'center',
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
      marginBottom: spacing.sm,
      gap: 2,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.pill,
    },
    segmentButtonActive: {
      backgroundColor: colors.accent,
    },
    segmentButtonText: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.textMuted,
    },
    segmentButtonTextActive: {
      color: colors.background,
    },
    paymentSection: {
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    helperText: {
      ...typography.caption,
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },
    ibanToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    toggleLabel: {
      ...typography.body,
      color: colors.text,
    },
    submitButton: {
      marginTop: spacing.lg,
    },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: getTabBarListPaddingBottom(insets.bottom) }}
      showsVerticalScrollIndicator={false}
    >
      {/* Venue */}
      <View style={styles.section}>
        <Text style={styles.label}>Yer</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Maç yeri"
          placeholderTextColor={colors.textMuted}
          value={venue}
          onChangeText={setVenue}
        />
      </View>

      {/* Date */}
      <View style={styles.section}>
        <Text style={styles.label}>Tarih & Saat</Text>
        <View style={styles.dateTimeRow}>
          <Pressable
            style={styles.dateTimeButton}
            onPress={() => {
              selectionTick();
              setShowDatePicker(true);
            }}
          >
            <Text style={styles.dateTimeButtonText}>{formattedDate}</Text>
          </Pressable>
          <Pressable
            style={styles.dateTimeButton}
            onPress={() => {
              selectionTick();
              setShowTimePicker(true);
            }}
          >
            <Text style={styles.dateTimeButtonText}>{formattedTime}</Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <>
            {Platform.OS === 'ios' && (
              <Modal transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <View style={{ backgroundColor: colors.surface }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                      <PillButton title="İptal" variant="secondary" onPress={() => setShowDatePicker(false)} />
                      <PillButton title="Seç" onPress={() => setShowDatePicker(false)} />
                    </View>
                    <DateTimePicker
                      value={startsAt}
                      mode="date"
                      display="spinner"
                      onChange={onDateChange}
                      textColor={colors.text}
                    />
                  </View>
                </View>
              </Modal>
            )}
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={startsAt}
                mode="date"
                display="default"
                onChange={onDateChange}
              />
            )}
          </>
        )}

        {showTimePicker && (
          <>
            {Platform.OS === 'ios' && (
              <Modal transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <View style={{ backgroundColor: colors.surface }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                      <PillButton title="İptal" variant="secondary" onPress={() => setShowTimePicker(false)} />
                      <PillButton title="Seç" onPress={() => setShowTimePicker(false)} />
                    </View>
                    <DateTimePicker
                      value={startsAt}
                      mode="time"
                      display="spinner"
                      onChange={onTimeChange}
                      textColor={colors.text}
                    />
                  </View>
                </View>
              </Modal>
            )}
            {Platform.OS === 'android' && (
              <DateTimePicker
                value={startsAt}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}
          </>
        )}
      </View>

      {/* Max Players */}
      <View style={styles.section}>
        <Text style={styles.label}>Katılımcı Sayısı</Text>
        <View style={styles.sliderContainer}>
          <TextInput
            style={[styles.textInput, { width: 60, marginBottom: 0 }]}
            placeholder="14"
            placeholderTextColor={colors.textMuted}
            value={maxPlayersInputText}
            onChangeText={handleMaxPlayersChange}
            keyboardType="number-pad"
          />
          <Slider
            style={{ flex: 1, height: 40 }}
            minimumValue={MATCH_MAX_PLAYERS_MIN}
            maximumValue={MATCH_MAX_PLAYERS_MAX}
            value={maxPlayers}
            onValueChange={handleMaxPlayersSlider}
            step={2}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
          />
        </View>
      </View>

      {/* Payment Method */}
      <View style={styles.section}>
        <Text style={styles.label}>Ödeme Yöntemi</Text>
        <View style={styles.segmentedControl}>
          {(['iban', 'cash', 'note_only'] as const).map((method) => (
            <Pressable
              key={method}
              style={[
                styles.segmentButton,
                paymentMethod === method && styles.segmentButtonActive,
              ]}
              onPress={() => {
                selectionTick();
                setPaymentMethod(method);
              }}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  paymentMethod === method && styles.segmentButtonTextActive,
                ]}
              >
                {method === 'iban' ? 'IBAN' : method === 'cash' ? 'Nakit' : 'Not'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Payment Details */}
      {paymentMethod === 'iban' && (
        <View style={styles.paymentSection}>
          <Text style={styles.helperText}>IBAN ve hesap bilgileri</Text>
          {hasValidProfileIban && (
            <View style={styles.ibanToggleRow}>
              <Text style={styles.toggleLabel}>Profil IBAN'ını kullan</Text>
              <Pressable
                onPress={() => {
                  setOverrideIban(!overrideIban);
                  if (!overrideIban) {
                    setIban(profileNorm);
                  }
                }}
              >
                <Ionicons
                  name={overrideIban ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={colors.accent}
                />
              </Pressable>
            </View>
          )}
          <TextInput
            style={styles.textInput}
            placeholder="TR32..."
            placeholderTextColor={colors.textMuted}
            value={formatIbanForInput(iban)}
            onChangeText={onIbanChange}
            onFocus={onIbanFocus}
            editable={!hasValidProfileIban || overrideIban}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Hesap Adı"
            placeholderTextColor={colors.textMuted}
            value={ibanAccountName}
            onChangeText={setIbanAccountName}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Ödeme Ücreti (TL)"
            placeholderTextColor={colors.textMuted}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {paymentMethod === 'cash' && (
        <View style={styles.paymentSection}>
          <Text style={styles.helperText}>Nakit ödemesi: Oyuncular maçta öderler</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Ödeme Ücreti (TL)"
            placeholderTextColor={colors.textMuted}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        </View>
      )}

      {paymentMethod === 'note_only' && (
        <View style={styles.paymentSection}>
          <Text style={styles.helperText}>Not şeklinde ödeme bilgisi (maks 120 karakter)</Text>
          <TextInput
            style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Ödeme açıklaması"
            placeholderTextColor={colors.textMuted}
            value={paymentNote}
            onChangeText={setPaymentNote}
            maxLength={120}
            multiline
          />
          <Text style={styles.helperText}>
            {paymentNote.length}/120
          </Text>
        </View>
      )}

      <PillButton
        title={submitting ? 'Kaydediliyor...' : 'Kaydet'}
        onPress={onSubmit}
        disabled={submitting}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}
