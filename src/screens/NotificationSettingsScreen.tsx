import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SettingsSectionSkeleton } from '../components/skeleton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import { fetchCurrentUserProfile, updateCurrentUserProfile } from '../services/supabase/profiles';
import { colors, spacing, typography } from '../theme';
import {
  type NotificationPreferences,
  defaultNotificationPreferences,
  isValidQuietHourTime,
  normalizeNotificationPreferences,
} from '../types/notificationPreferences';
import { openAppSystemSettings } from '../utils/openAppSystemSettings';
import { formatDateToQuietHour, parseQuietHourToDate } from '../utils/quietHourTime';
import { useUserFeedback } from '../utils/userFeedback';

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
      group_match_post_match_rating_reminder: p.types.group_match_post_match_rating_reminder,
      group_match_match_result: p.types.group_match_match_result,
      group_match_streak_at_risk: p.types.group_match_streak_at_risk,
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

type QuietField = 'start' | 'end';

export function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { configured, session } = useSupabaseAuth();
  const { showValidationToast, showApiErrorToast } = useUserFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [permStatus, setPermStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [startInput, setStartInput] = useState(prefs.quiet_hours.start);
  const [endInput, setEndInput] = useState(prefs.quiet_hours.end);
  const [activeQuietField, setActiveQuietField] = useState<QuietField | null>(null);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

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
      showApiErrorToast(e, {
        uiOperation: 'NotificationSettings:refresh',
        fallbackMessage: 'Bildirim tercihleri alınamadı. Lütfen tekrar deneyin.',
        mapOperation: 'fetchProfileById',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [configured, session, showApiErrorToast]);

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
        showApiErrorToast(e, {
          uiOperation: 'NotificationSettings:persist',
          fallbackMessage: 'Tercihler sunucuya yazılamadı. Bağlantınızı kontrol edin.',
          mapOperation: 'updateCurrentUserProfile',
        });
        await refresh(true);
      } finally {
        setSaving(false);
      }
    },
    [configured, session, refresh, showApiErrorToast],
  );

  const applyPickedTime = useCallback(
    (field: QuietField, picked: Date) => {
      const p = prefsRef.current;
      const hhmm = formatDateToQuietHour(picked);
      const start = field === 'start' ? hhmm : p.quiet_hours.start;
      const end = field === 'end' ? hhmm : p.quiet_hours.end;
      if (!isValidQuietHourTime(start) || !isValidQuietHourTime(end)) {
        showValidationToast('Geçersiz saat', 'Saat seçilemedi. Lütfen tekrar deneyin.');
        return;
      }
      if (start === p.quiet_hours.start && end === p.quiet_hours.end) return;
      setStartInput(start);
      setEndInput(end);
      void persist({
        ...p,
        quiet_hours: { ...p.quiet_hours, start, end },
      });
    },
    [persist, showValidationToast],
  );

  const iosQuietDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleIosQuietApply = useCallback(
    (field: QuietField, picked: Date) => {
      if (iosQuietDebounceRef.current) clearTimeout(iosQuietDebounceRef.current);
      iosQuietDebounceRef.current = setTimeout(() => {
        iosQuietDebounceRef.current = null;
        applyPickedTime(field, picked);
      }, 350);
    },
    [applyPickedTime],
  );

  useEffect(
    () => () => {
      if (iosQuietDebounceRef.current) clearTimeout(iosQuietDebounceRef.current);
    },
    [],
  );

  const onAndroidQuietTimeChange = useCallback(
    (field: QuietField, event: DateTimePickerEvent, date?: Date) => {
      if (event.type === 'dismissed' || event.type === 'neutralButtonPressed') {
        setActiveQuietField(null);
        return;
      }
      if (event.type === 'set' && date) {
        applyPickedTime(field, date);
        setActiveQuietField(null);
      }
    },
    [applyPickedTime],
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

  const onTogglePostMatchRatingReminder = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_post_match_rating_reminder: v },
      });
    },
    [prefs, persist],
  );

  const onToggleMatchResult = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_match_result: v },
      });
    },
    [prefs, persist],
  );

  const onToggleStreakAtRisk = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_streak_at_risk: v },
      });
    },
    [prefs, persist],
  );

  const onTogglePaymentMorningReminder = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_payment_morning_reminder: v },
      });
    },
    [prefs, persist],
  );

  const onToggleRosterFullOrganizer = useCallback(
    (v: boolean) => {
      void persist({
        ...prefs,
        types: { ...prefs.types, group_match_roster_full_organizer: v },
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

  const typesDisabled = !prefs.push_enabled;
  const quietControlsDisabled = saving || typesDisabled || !prefs.quiet_hours.enabled;
  const permDenied = permStatus === 'denied';

  if (!configured) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}>
        <Text style={styles.hint}>
          Supabase için kök dizinde `.env` içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın.
        </Text>
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}>
        <Text style={styles.hint}>Bildirim tercihleri için önce oturum açın.</Text>
      </ScrollView>
    );
  }

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}>
        <SettingsSectionSkeleton rows={2} />
        <SettingsSectionSkeleton rows={1} />
        <SettingsSectionSkeleton rows={7} />
        <SettingsSectionSkeleton rows={2} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sistem</Text>
        <Text style={styles.muted}>
          Uygulama bildirimleri: {permStatus ? permissionLabel(permStatus) : '—'}
        </Text>
        <Text style={[styles.caption, permDenied ? styles.captionStrong : undefined]}>
          {permDenied
            ? 'Bildirimleri kullanmak için sistem ayarlarından izin vermeniz gerekir.'
            : 'Tam kontrol için işletim sistemi bildirim ayarlarını kullanın.'}
        </Text>
        <Pressable
          onPress={() => void openAppSystemSettings()}
          style={[styles.linkBtn, permDenied ? styles.linkBtnCta : styles.linkBtnNeutral]}
          testID="settings:notifications:open-os-settings:press"
          accessibilityRole="button"
          accessibilityLabel="Sistem bildirim ayarlarını aç"
        >
          <Text style={[styles.linkText, permDenied ? styles.linkTextCta : undefined]}>
            {permDenied ? 'Ayarlara git' : 'Sistem ayarlarını aç'}
          </Text>
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
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Maç sonu oylaması</Text>
            <Text style={styles.caption}>Maç bittikten 15 dakika sonra oylama hatırlatması gönderilir</Text>
          </View>
          <Switch
            value={prefs.types.group_match_post_match_rating_reminder}
            onValueChange={onTogglePostMatchRatingReminder}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_post_match_rating_reminder ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-post-match-rating:switch"
            accessibilityLabel="Maç sonu oylama bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Maç sonucu</Text>
            <Text style={styles.caption}>Skor kaydedildiğinde maç özetini bildirir</Text>
          </View>
          <Switch
            value={prefs.types.group_match_match_result}
            onValueChange={onToggleMatchResult}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_match_result ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-match-result:switch"
            accessibilityLabel="Maç sonucu bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Haftalık seri hatırlatıcısı</Text>
            <Text style={styles.caption}>
              Haftada planlı maç yokken seriyi kaybetmemek için Çarşamba hatırlatması
            </Text>
          </View>
          <Switch
            value={prefs.types.group_match_streak_at_risk}
            onValueChange={onToggleStreakAtRisk}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_streak_at_risk ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-streak-at-risk:switch"
            accessibilityLabel="Haftalık seri hatırlatıcı bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Nakit/Not maç sabahı</Text>
            <Text style={styles.caption}>Nakit veya not ödemeli maç günü sabahı hatırlatma gönderilir</Text>
          </View>
          <Switch
            value={prefs.types.group_match_payment_morning_reminder}
            onValueChange={onTogglePaymentMorningReminder}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_payment_morning_reminder ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-payment-morning:switch"
            accessibilityLabel="Nakit/Not maç sabahı bildirimleri"
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Kadro doldu (Organizatör)</Text>
            <Text style={styles.caption}>Maç kadrosu tamamlandığında organizatöre bildirim gönderilir</Text>
          </View>
          <Switch
            value={prefs.types.group_match_roster_full_organizer}
            onValueChange={onToggleRosterFullOrganizer}
            disabled={saving || typesDisabled}
            trackColor={{ false: colors.border, true: colors.accentMuted }}
            thumbColor={Platform.OS === 'android' ? (prefs.types.group_match_roster_full_organizer ? colors.accent : colors.textMuted) : undefined}
            testID="settings:notifications:type-roster-full:switch"
            accessibilityLabel="Kadro doldu organizatör bildirimleri"
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
        <Pressable
          disabled={quietControlsDisabled}
          onPress={() => {
            if (Platform.OS === 'android') {
              setActiveQuietField('start');
              return;
            }
            setActiveQuietField((prev) => (prev === 'start' ? null : 'start'));
          }}
          style={[styles.input, styles.timePressable, quietControlsDisabled && styles.inputDisabled]}
          testID="settings:notifications:quiet-start:press"
          accessibilityRole="button"
          accessibilityLabel="Sessiz saat başlangıcı, saat seç"
          accessibilityHint="24 saat formatında saat seçmek için dokunun"
        >
          <Text style={[styles.inputText, quietControlsDisabled && styles.inputTextDisabled]}>{startInput}</Text>
        </Pressable>
        {Platform.OS === 'ios' && activeQuietField === 'start' ? (
          <DateTimePicker
            value={parseQuietHourToDate(prefs.quiet_hours.start)}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_, date) => {
              if (date) scheduleIosQuietApply('start', date);
            }}
          />
        ) : null}
        {Platform.OS === 'android' && activeQuietField === 'start' ? (
          <DateTimePicker
            value={parseQuietHourToDate(prefs.quiet_hours.start)}
            mode="time"
            display="default"
            is24Hour
            onChange={(e, d) => onAndroidQuietTimeChange('start', e, d)}
          />
        ) : null}

        <Text style={styles.label}>Bitiş</Text>
        <Pressable
          disabled={quietControlsDisabled}
          onPress={() => {
            if (Platform.OS === 'android') {
              setActiveQuietField('end');
              return;
            }
            setActiveQuietField((prev) => (prev === 'end' ? null : 'end'));
          }}
          style={[styles.input, styles.timePressable, quietControlsDisabled && styles.inputDisabled]}
          testID="settings:notifications:quiet-end:press"
          accessibilityRole="button"
          accessibilityLabel="Sessiz saat bitişi, saat seç"
          accessibilityHint="24 saat formatında saat seçmek için dokunun"
        >
          <Text style={[styles.inputText, quietControlsDisabled && styles.inputTextDisabled]}>{endInput}</Text>
        </Pressable>
        {Platform.OS === 'ios' && activeQuietField === 'end' ? (
          <DateTimePicker
            value={parseQuietHourToDate(prefs.quiet_hours.end)}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_, date) => {
              if (date) scheduleIosQuietApply('end', date);
            }}
          />
        ) : null}
        {Platform.OS === 'android' && activeQuietField === 'end' ? (
          <DateTimePicker
            value={parseQuietHourToDate(prefs.quiet_hours.end)}
            mode="time"
            display="default"
            is24Hour
            onChange={(e, d) => onAndroidQuietTimeChange('end', e, d)}
          />
        ) : null}
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
  captionStrong: {
    color: colors.text,
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
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    borderRadius: 12,
  },
  linkBtnCta: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentMuted,
  },
  linkBtnNeutral: {
    paddingVertical: spacing.xs,
  },
  linkText: {
    ...typography.body,
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  linkTextCta: {
    textAlign: 'center',
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
  timePressable: {
    minHeight: 44,
    justifyContent: 'center',
  },
  inputText: {
    ...typography.body,
    color: colors.text,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputTextDisabled: {
    color: colors.textMuted,
  },
});
