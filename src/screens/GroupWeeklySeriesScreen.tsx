import DateTimePicker from '@react-native-community/datetimepicker';
import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import type { GroupsStackParamList } from '../navigation/types';
import { useUserFeedback } from '../utils/userFeedback';
import { useAuthStore, useGroupsStore } from '../store';
import { colors, radius, spacing, typography } from '../theme';
import {
  formatIbanForInput,
  isValidTurkishIban,
  maskIban,
  normalizeIban,
} from '../utils/iban';
import { clampEvenMatchMaxPlayers } from '../utils/matchMaxPlayers';

type Route = RouteProp<GroupsStackParamList, 'GroupWeeklySeries'>;

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Pzt' },
  { value: 2, label: 'Sal' },
  { value: 3, label: 'Car' },
  { value: 4, label: 'Per' },
  { value: 5, label: 'Cum' },
  { value: 6, label: 'Cmt' },
  { value: 7, label: 'Paz' },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function timeFromDate(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

function parseTimeToDate(t: string): Date {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  const d = new Date();
  if (m) {
    d.setHours(parseInt(m[1]!, 10), parseInt(m[2]!, 10), 0, 0);
  } else {
    d.setHours(20, 0, 0, 0);
  }
  return d;
}

export function GroupWeeklySeriesScreen() {
  const { groupId } = useRoute<Route>().params;
  const userId = useAuthStore((s) => s.getCurrentUserId());
  const group = useGroupsStore((s) => s.groups.find((g) => g.id === groupId));
  const fetchSeries = useGroupsStore((s) => s.fetchGroupWeeklySeries);
  const upsertSeries = useGroupsStore((s) => s.upsertGroupWeeklySeries);
  const cached = useGroupsStore((s) => s.weeklySeriesByGroupId[groupId]);
  const { showValidationToast, showToast, showApiErrorToast } = useUserFeedback();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [weekday, setWeekday] = useState(3);
  const [localTime, setLocalTime] = useState('20:00:00');
  const [timePicker, setTimePicker] = useState(() => parseTimeToDate('20:00'));
  const [showTime, setShowTime] = useState(false);
  const [venue, setVenue] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('14');
  const [price, setPrice] = useState('');
  const [iban, setIban] = useState('');

  const isOwner = group?.ownerId === userId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchSeries(groupId);
    } catch (e) {
      showApiErrorToast(e, {
        uiOperation: 'GroupWeeklySeriesScreen:load',
        fallbackMessage: 'Haftalık seri yüklenemedi.',
        mapOperation: 'fetchGroupWeeklySeries',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchSeries, groupId, showApiErrorToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (cached === undefined) return;
    if (cached === null) {
      setIsActive(true);
      setWeekday(3);
      setLocalTime('20:00:00');
      setTimePicker(parseTimeToDate('20:00'));
      setVenue('');
      setMaxPlayers('14');
      setPrice('');
      setIban('');
      return;
    }
    setIsActive(cached.isActive);
    setWeekday(cached.weekdayIsodow);
    setLocalTime(cached.localTime);
    setTimePicker(parseTimeToDate(cached.localTime));
    setVenue(cached.venue);
    setMaxPlayers(String(cached.maxPlayers));
    setPrice(cached.pricePerPerson != null ? String(cached.pricePerPerson) : '');
    setIban(cached.iban ? formatIbanForInput(cached.iban) : '');
  }, [cached]);

  const onSave = async () => {
    if (!venue.trim()) {
      showValidationToast('Eksik bilgi', 'Saha adını girin.');
      return;
    }
    const ibanNorm = normalizeIban(iban);
    if (ibanNorm.length > 0 && !isValidTurkishIban(ibanNorm)) {
      showValidationToast('Geçersiz IBAN', 'IBAN formatını kontrol edin.');
      return;
    }
    const mp = clampEvenMatchMaxPlayers(parseInt(maxPlayers || '14', 10) || 14);
    const priceNum = price.trim() ? parseFloat(price.replace(',', '.')) : null;
    setSaving(true);
    try {
      await upsertSeries({
        groupId,
        isActive,
        weekdayIsodow: weekday,
        localTime,
        venue: venue.trim(),
        maxPlayers: mp,
        pricePerPerson: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
        iban: ibanNorm.length > 0 ? ibanNorm : null,
        defaultOrganizerId: userId,
      });
      showToast({
        title: 'Kaydedildi',
        message: 'Haftalık tekrar ayarları güncellendi.',
      });
    } catch (e) {
      showApiErrorToast(e, {
        uiOperation: 'GroupWeeklySeriesScreen:save',
        fallbackMessage: 'Kayıt başarısız.',
        mapOperation: 'upsertGroupWeeklySeriesRemote',
        toastTitle: 'Kayıt başarısız',
      });
    } finally {
      setSaving(false);
    }
  };

  const maskedIban = useMemo(() => maskIban(iban), [iban]);

  if (!group || !isOwner) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Bu ekranı yalnızca grup sahibi kullanabilir.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>
        Maç sonucu kaydedildiğinde bir sonraki hafta aynı gün ve saatte yeni maç oluşturulur. Katılımcı listesi sıfırlanır;
        yalnızca varsayılan organizatör &quot;geliyorum&quot; olarak eklenir.
      </Text>

      <View style={styles.rowBetween}>
        <Text style={styles.label}>Haftalık tekrar açık</Text>
        <Switch
          value={isActive}
          onValueChange={setIsActive}
          testID="groups:weekly:active"
          accessibilityLabel="Haftalık tekrar"
        />
      </View>

      <Text style={styles.label}>Gün (takvim)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <PillButton
            key={d.value}
            title={d.label}
            variant={weekday === d.value ? 'accent' : 'ghost'}
            onPress={() => setWeekday(d.value)}
            testID={`groups:weekly:day:${d.value}`}
          />
        ))}
      </ScrollView>

      <Text style={styles.label}>Saat (yerel)</Text>
      <PillButton
        title={localTime.slice(0, 5)}
        variant="ghost"
        onPress={() => setShowTime(true)}
        testID="groups:weekly:time:open"
      />
      {showTime && (
        <DateTimePicker
          value={timePicker}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => {
            setShowTime(Platform.OS === 'ios');
            if (d) {
              setTimePicker(d);
              setLocalTime(timeFromDate(d));
            }
          }}
        />
      )}

      <Text style={styles.label}>Saha</Text>
      <TextInput
        style={styles.input}
        value={venue}
        onChangeText={setVenue}
        placeholder="Örn: Kadıköy Halısaha"
        placeholderTextColor={colors.textMuted}
        testID="groups:weekly:venue"
      />

      <Text style={styles.label}>Maks. oyuncu</Text>
      <TextInput
        style={styles.input}
        value={maxPlayers}
        onChangeText={setMaxPlayers}
        keyboardType="number-pad"
        testID="groups:weekly:max"
      />

      <Text style={styles.label}>Kişi başı ücret (opsiyonel)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        testID="groups:weekly:price"
      />

      <Text style={styles.label}>IBAN (opsiyonel)</Text>
      <TextInput
        style={styles.input}
        value={maskedIban}
        onChangeText={(t) => setIban(formatIbanForInput(t))}
        autoCapitalize="characters"
        testID="groups:weekly:iban"
      />

      <PillButton
        title={saving ? 'Kaydediliyor…' : 'Kaydet'}
        onPress={() => void onSave()}
        disabled={saving}
        testID="groups:weekly:save"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  muted: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  lead: { ...typography.caption, color: colors.textMuted },
  label: { ...typography.subtitle, color: colors.text },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
