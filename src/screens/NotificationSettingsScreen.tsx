import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { fetchCurrentUserProfile, updateCurrentUserProfile } from '../services/supabase/profiles';
import { colors, spacing, typography } from '../theme';
import {
  type NotificationPreferences,
  defaultNotificationPreferences,
  isValidQuietHourTime,
  normalizeNotificationPreferences,
} from '../types/notificationPreferences';

function toJsonRecord(p: NotificationPreferences): Record<string, unknown> {
  return {
    push_enabled: p.push_enabled,
    types: {
      group_match_initial: p.types.group_match_initial,
      group_match_reminder: p.types.group_match_reminder,
      group_match_cancelled: p.types.group_match_cancelled,
      group_match_venue_change: p.types.group_match_venue_change,
      group_match_lineup_published: p.types.group_match_lineup_published,
      group_match_payment_reminder: p.types.group_match_payment_reminder,
    },
    quiet_hours: {
      enabled: p.quiet_hours.enabled,
      start: p.quiet_hours.start,
      end: p.quiet_hours.end,
      timezone: p.quiet_hours.timezone,
    },
  };
}

function permissionLabel(status: Notifications.PermissionStatus): string {
  switch (status) {
    case 'granted':
      return 'İzin verildi';
    case 'denied':
      return 'Reddedildi';
    default:
      return 'Henüz sorulmadı';
  }
}

export function NotificationSettingsScreen() {
  const { configured, session } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [permStatus, setPermStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [startInput, setStartInput] = useState(prefs.quiet_hours.start);
  const [endInput, setEndInput] = useState(prefs.quiet_hours.end);

  const refresh = useCallback(async (silent: boolean) => {
    if (!configured || !session) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermStatus(status);
      const row = await fetchCurrentUserProfile();
      const n = normalizeNotificationPreferences(row?.notification_preferences);
      setPrefs(n);
      setStartInput(n.quiet_hours.start);
      setEndInput(n.quiet_hours.end);
    } catch (e) {
      console.warn('NotificationSettings load failed', e);
      Alert.alert('Yüklenemedi', 'Bildirim tercihleri alınamadı. Lütfen tekrar deneyin.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [configured, session]);

  const skipLoadSpinnerRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      void refresh(skipLoadSpinnerRef.current);
      skipLoadSpinnerRef.current = true;
    }, [refresh]),
  );

  const persist = useCallback(
    async (next: NotificationPreferences) => {
      if (!configured || !session) return;
      setSaving(true);
      try {
        await updateCurrentUserProfile({ notification_preferences: toJsonRecord(next) });
        setPrefs(next);
        setStartInput(next.quiet_hours.start);
        setEndInput(next.quiet_hours.end);
      } catch (e) {
        console.warn('notification_preferences save failed', e);
        Alert.alert('Kaydedilemedi', 'Tercihler sunucuya yazılamadı. Bağlantınızı kontrol edin.');
        await refresh(true);
      } finally {
        setSaving(false);
      }
    },
    [configured, session, refresh],
  );

  const onTogglePush = useCallback(
    (v: boolean) => {
      void persist({ ...prefs, push_enabled: v });
    },
    [prefs, persist],
  );

  const onToggleInitial = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_initial: v },
      });
    },
    [prefs, persist],
  );

  const onToggleReminder = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_reminder: v },
      });
    },
    [prefs, persist],
  );

  const onToggleCancelled = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_cancelled: v },
      });
    },
    [prefs, persist],
  );

  const onToggleVenueChange = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_venue_change: v },
      });
    },
    [prefs, persist],
  );

  const onToggleLineupPublished = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_lineup_published: v },
      });
    },
    [prefs, persist],
  );

  const onTogglePaymentReminder = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_payment_reminder: v },
      });
    },
    [prefs, persist],
  );

  const onToggleQuiet = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        quiet_hours: { ...prefs.quiet_hours, enabled: v },
      });
    },
    [prefs, persist],
  );

  const commitQuietTimes = useCallback(() => {
    const start = startInput.trim();
    const end = endInput.trim();
    if (!isValidQuietHourTime(start) || !isValidQuietHourTime(end)) {
      Alert.alert('Geçersiz saat', 'Başlangıç ve bitiş için HH:MM formatında girin (ör. 22:30).');
      setStartInput(prefs.quiet_hours.start);
      setEndInput(prefs.quiet_hours.end);
      return;
    }
    void persist({
      ...prefs,
      quiet_hours: { ...prefs.quiet_hours, start, end },
    });
  }, [startInput, endInput, prefs, persist]);

  const typesDisabled = !prefs.push_enabled;

  if (!configured) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Supabase için kök dizinde `.env` içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın.
        </Text>
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.hint}>Bildirim tercihleri için önce oturum açın.</Text>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingFull}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sistem</Text>
        <Text style={styles.muted}>
          Uygulama bildirimleri: {permStatus ? permissionLabel(permStatus) : '—'}
        </Text>
        <Text style={styles.caption}>
          Tam kontrol için işletim sistemi bildirim ayarlarını kullanın.
        </Text>
        <Pressable
          onPress={() => void Linking.openSettings()}
          style={styles.linkBtn}
          testID="settings:notifications:open-os-settings:press"
          accessibilityRole="button"
          accessibilityLabel="Sistem bildirim ayarlarını aç"
        >
          <Text style={styles.linkText}>Sistem ayarlarını aç</Text>
        </Pressable>
      </View>

      <View style={[styles.section, saving && styles.sectionDisabled]}>
        <Text style={styles.sectionTitle}>Push bildirimleri</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Uygulama bildirimleri</Text>
            <Text style={styles.caption}>Sunucudan gelen maç ve hatırlatma bildirimleri</Text>
          </View>
          <Switch
            value={prefs.push_enabled}
            onValueChange={onTogglePush}
            disabled={saving}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.push_enabled ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:push-enabled:switch"
            accessibilityLabel="Uygulama bildirimleri"
          />
        </View>
      </View>

      <View style={[styles.section, typesDisabled && styles.sectionDisabled]}>
        <Text style={styles.sectionTitle}>Türler</Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Yeni grup maçı</Text>
            <Text style={styles.caption}>Grubunuzda yeni maç açıldığında</Text>
          </View>
          <Switch
            value={prefs.types.group_match_initial}
            onValueChange={onToggleInitial}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_initial ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-initial:switch"
            accessibilityLabel="Yeni grup maçı bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>RSVP hatırlatmaları</Text>
            <Text style={styles.caption}>Yanıt vermediğiniz maçlar için günlük hatırlatma</Text>
          </View>
          <Switch
            value={prefs.types.group_match_reminder}
            onValueChange={onToggleReminder}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_reminder ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-reminder:switch"
            accessibilityLabel="RSVP hatırlatma bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Maç iptali</Text>
            <Text style={styles.caption}>Grubunuzdaki maç iptal edildiğinde</Text>
          </View>
          <Switch
            value={prefs.types.group_match_cancelled}
            onValueChange={onToggleCancelled}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_cancelled ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-cancelled:switch"
            accessibilityLabel="Maç iptali bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Saha güncellemesi</Text>
            <Text style={styles.caption}>Katıldığınız maçın sahası değiştiğinde</Text>
          </View>
          <Switch
            value={prefs.types.group_match_venue_change}
            onValueChange={onToggleVenueChange}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_venue_change ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-venue:switch"
            accessibilityLabel="Saha güncelleme bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Kadro yayınlandı</Text>
            <Text style={styles.caption}>Organizatör kadroyu yayınladığında (katıldığınız maçlar)</Text>
          </View>
          <Switch
            value={prefs.types.group_match_lineup_published}
            onValueChange={onToggleLineupPublished}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_lineup_published ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-lineup-published:switch"
            accessibilityLabel="Kadro yayınlandı bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Ödeme hatırlatıcıları</Text>
            <Text style={styles.caption}>Maça 24 saat kala ödemediyseniz hatırlatma gönderilir</Text>
          </View>
          <Switch
            value={prefs.types.group_match_payment_reminder}
            onValueChange={onTogglePaymentReminder}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_payment_reminder ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-payment-reminder:switch"
            accessibilityLabel="Ödeme hatırlatıcı bildirimleri"
          />
        </View>
      </View>

      <View style={[styles.section, typesDisabled && styles.sectionDisabled]}>
        <Text style={styles.sectionTitle}>Sessiz saatler</Text>
        <Text style={styles.caption}>
          Bu aralıkta gönderilen bildirimler iletilmez (saat dilimi: {prefs.quiet_hours.timezone}).
        </Text>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Sessiz saatleri kullan</Text>
          </View>
          <Switch
            value={prefs.quiet_hours.enabled}
            onValueChange={onToggleQuiet}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.quiet_hours.enabled ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:quiet-enabled:switch"
            accessibilityLabel="Sessiz saatleri kullan"
          />
        </View>
        <Text style={styles.label}>Başlangıç</Text>
        <TextInput
          style={styles.input}
          value={startInput}
          onChangeText={setStartInput}
          placeholder="22:30"
          placeholderTextColor={colors.textMuted}
          editable={!saving && !typesDisabled && prefs.quiet_hours.enabled}
          onEndEditing={commitQuietTimes}
          keyboardType="numbers-and-punctuation"
          testID="settings:notifications:quiet-start:input"
          accessibilityLabel="Sessiz saat başlangıcı"
        />
        <Text style={styles.label}>Bitiş</Text>
        <TextInput
          style={styles.input}
          value={endInput}
          onChangeText={setEndInput}
          placeholder="07:00"
          placeholderTextColor={colors.textMuted}
          editable={!saving && !typesDisabled && prefs.quiet_hours.enabled}
          onEndEditing={commitQuietTimes}
          keyboardType="numbers-and-punctuation"
          testID="settings:notifications:quiet-end:input"
          accessibilityLabel="Sessiz saat bitişi"
        />
      </View>

      {saving ? <ActivityIndicator color={colors.accent} style={styles.savingSpinner} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingFull: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingSpinner: {
    marginTop: spacing.sm,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionDisabled: {
    opacity: 0.55,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  linkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  linkText: {
    ...typography.body,
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
    backgroundColor: colors.background,
  },
});
