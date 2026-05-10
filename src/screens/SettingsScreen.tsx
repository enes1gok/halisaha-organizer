import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Card } from '../components/Card';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { readDeleteAccountUrl } from '../lib/publicConfig';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { ProfileStackParamList } from '../navigation/types';
import { usePreferencesStore } from '../store';
import type { ThemePreference } from '../store/types';
import { letterSpacing, radius, shadows, spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { selectionTick } from '../utils/haptics';
import { getAppVersionLabel, getAppVersionDetailLines } from '../utils/appMeta';
import { isEmailVerified } from '../utils/emailVerification';

type Nav = StackNavigationProp<ProfileStackParamList, 'Settings'>;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type ThemeOption = {
  value: ThemePreference;
  label: string;
  hint: string;
  testId: string;
};

const THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
  {
    value: 'system',
    label: 'Sistem',
    hint: 'Cihaz ayarını takip eder',
    testId: 'profile:settings:appearance:theme:system:press',
  },
  {
    value: 'light',
    label: 'Açık',
    hint: 'Aydınlık tema',
    testId: 'profile:settings:appearance:theme:light:press',
  },
  {
    value: 'dark',
    label: 'Karanlık',
    hint: 'Karanlık tema',
    testId: 'profile:settings:appearance:theme:dark:press',
  },
];

function ThemeSegmentControl() {
  const styles = useThemeSegmentStyles();
  const preference = usePreferencesStore((s) => s.themePreference);
  const setThemePreference = usePreferencesStore((s) => s.setThemePreference);

  const handlePress = useCallback(
    (next: ThemePreference) => {
      if (next === preference) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      void selectionTick();
      setThemePreference(next);
    },
    [preference, setThemePreference],
  );

  return (
    <View
      style={styles.shell}
      accessibilityRole="radiogroup"
      accessibilityLabel="Tema tercihi"
    >
      {THEME_OPTIONS.map((option) => {
        const active = option.value === preference;
        return (
          <Pressable
            key={option.value}
            onPress={() => handlePress(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={`${option.label} tema, ${option.hint}`}
            accessibilityState={{ selected: active }}
            testID={option.testId}
            hitSlop={4}
            style={({ pressed }) => [
              styles.cell,
              active && styles.cellActive,
              pressed && !active && styles.cellPressed,
            ]}
          >
            <Text
              style={[styles.cellLabel, active ? styles.cellLabelActive : styles.cellLabelInactive]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const reduceMotion = useReduceMotion();
  const styles = useStyles();
  const {
    configured,
    loading: authLoading,
    session,
    signOut,
    refreshAuthSession,
    resendSignupConfirmationEmail,
  } = useSupabaseAuth();
  const deleteAccountUrl = readDeleteAccountUrl();
  const [resendBusy, setResendBusy] = useState(false);

  const versionLabel = getAppVersionLabel();
  const versionDetailLines = getAppVersionDetailLines();

  useFocusEffect(
    useCallback(() => {
      if (configured && session) {
        void refreshAuthSession();
      }
    }, [configured, session, refreshAuthSession]),
  );

  const openDeleteAccountUrl = useCallback(async () => {
    if (!deleteAccountUrl) {
      Alert.alert(
        'Hesap Silme',
        'Hesap silme baglantisi su an tanimli degil. Lutfen privacy@halisaha.app adresine e-posta gonderin.',
      );
      return;
    }

    const canOpen = await Linking.canOpenURL(deleteAccountUrl);
    if (!canOpen) {
      Alert.alert(
        'Hesap Silme',
        'Baglanti acilamadi. Lutfen privacy@halisaha.app adresine e-posta gonderin.',
      );
      return;
    }

    await Linking.openURL(deleteAccountUrl);
  }, [deleteAccountUrl]);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Hesap
        </Text>
        {!configured ? (
          <Text style={styles.hint}>
            Supabase için kök dizinde `.env` içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın;
            Metro’yu yeniden başlatın.
          </Text>
        ) : authLoading ? (
          <ActivityIndicatorTinted />
        ) : session ? (
          <>
            <Text style={styles.label}>Oturum açık</Text>
            <Text style={styles.email}>{session.user.email ?? session.user.id}</Text>
            <Text
              style={isEmailVerified(session.user) ? styles.emailVerified : styles.emailUnverified}
              testID="profile:settings:email-verification:status"
            >
              {isEmailVerified(session.user)
                ? 'E-posta doğrulandı'
                : 'E-posta henüz doğrulanmadı'}
            </Text>
            {!isEmailVerified(session.user) ? (
              <PillButton
                title="Doğrulama e-postasını yeniden gönder"
                variant="ghost"
                loading={resendBusy}
                disabled={resendBusy}
                onPress={async () => {
                  setResendBusy(true);
                  const { error } = await resendSignupConfirmationEmail();
                  setResendBusy(false);
                  if (error) {
                    Alert.alert('E-posta', error.message);
                  } else {
                    Alert.alert('E-posta', 'Doğrulama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.');
                  }
                }}
                testID="profile:settings:email-resend:press"
                accessibilityLabel="Doğrulama e-postasını yeniden gönder"
              />
            ) : null}
            <PillButton
              title="Çıkış Yap"
              variant="ghost"
              onPress={() => void signOut()}
              testID="profile:auth:signout:press"
              accessibilityLabel="Çıkış yap"
            />
            <View style={styles.divider} />
            <Text style={styles.label}>Tehlikeli bölge</Text>
            <PillButton
              title="Hesabımı ve Verilerimi Sil"
              variant="ghost"
              onPress={() => void openDeleteAccountUrl()}
              testID="profile:account-deletion:press"
              accessibilityLabel="Hesap ve veri silme baglantisini ac"
            />
          </>
        ) : (
          <Text style={styles.hint}>Henüz giriş yapılmadı.</Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Görünüm
        </Text>
        <Text style={styles.bodyMuted}>
          Tema seçimi: Sistem, Açık veya Karanlık. "Sistem" seçildiğinde cihaz ayarınız takip edilir.
        </Text>
        <ThemeSegmentControl />
        <Text style={styles.bodyMuted}>
          Azaltılmış hareket (Reduce Motion):{' '}
          <Text style={styles.bodyStrong}>{reduceMotion ? 'Açık' : 'Kapalı'}</Text>
          {' — sistem tercihine göre geçişler uyarlanır.'}
        </Text>
        <PillButton
          title="Sistem ayarlarını aç"
          variant="ghost"
          onPress={openSystemSettings}
          testID="profile:settings:appearance:system-settings:press"
          accessibilityLabel="Erisilebilirlik ve goruntu icin sistem ayarlarini ac"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Bildirimler
        </Text>
        <Text style={styles.bodyMuted}>
          Push bildirimleri ve sessiz saatleri buradan yönetirsiniz.
        </Text>
        <PillButton
          title="Bildirim tercihleri"
          variant="ghost"
          onPress={() => navigation.navigate('NotificationSettings')}
          testID="profile:settings:notifications:press"
          accessibilityLabel="Bildirim tercihleri ekranına git"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Gizlilik ve veri
        </Text>
        <Text style={styles.bodyMuted}>
          Uygulama içinde zorunlu üçüncü taraf reklam veya davranışsal analitik SDK’sı bulunmaz. Veri işleme özeti
          için politikayı okuyun.
        </Text>
        <Text style={styles.bodyMuted}>
          Push bildirimleri ve iletişim tercihleri için yukarıdaki «Bildirimler» bölümünü kullanın.
        </Text>
        <PillButton
          title="Gizlilik Politikası"
          variant="ghost"
          onPress={() => navigation.navigate('PrivacyPolicy')}
          testID="profile:privacy-policy:press"
          accessibilityLabel="Gizlilik politikasi ekranina git"
        />
        <PillButton
          title="Kullanım Koşulları"
          variant="ghost"
          onPress={() => navigation.navigate('TermsOfUse')}
          testID="profile:settings:terms:press"
          accessibilityLabel="Kullanim kosullari ekranina git"
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Hakkında
        </Text>
        <Text style={styles.label}>Halısaha: Maç Organize Et</Text>
        <Text style={styles.versionPrimary} testID="profile:settings:about:version">
          Sürüm {versionLabel}
        </Text>
        {versionDetailLines.map((line) => (
          <Text key={line} style={styles.hint}>
            {line}
          </Text>
        ))}
        <PillButton
          title="Açık kaynak lisansları"
          variant="ghost"
          onPress={() => navigation.navigate('Licenses')}
          testID="profile:settings:licenses:press"
          accessibilityLabel="Acik kaynak lisanslari ekranina git"
        />
      </Card>
    </ScrollView>
  );
}

function ActivityIndicatorTinted() {
  const styles = useStyles();
  return <ActivityIndicator color={styles.indicatorTint.color} />;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
      gap: spacing.md,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      marginBottom: spacing.xs,
    },
    label: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    email: {
      ...typography.body,
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
    },
    emailVerified: {
      ...typography.caption,
      color: t.colors.accent,
      marginTop: spacing.xs,
    },
    emailUnverified: {
      ...typography.caption,
      color: t.colors.danger,
      marginTop: spacing.xs,
    },
    hint: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    bodyMuted: {
      ...typography.caption,
      color: t.colors.textMuted,
      lineHeight: 20,
    },
    bodyStrong: {
      ...typography.caption,
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
    },
    versionPrimary: {
      ...typography.body,
      color: t.colors.text,
      fontFamily: 'Inter_600SemiBold',
    },
    divider: {
      marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      paddingTop: spacing.sm,
    },
    indicatorTint: {
      color: t.colors.accent,
    },
  }),
);

const useThemeSegmentStyles = makeStyles((t) =>
  StyleSheet.create({
    shell: {
      flexDirection: 'row',
      backgroundColor: t.colors.surfaceGlass,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      padding: 4,
      gap: 4,
      ...shadows.sm,
    },
    cell: {
      flex: 1,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellActive: {
      backgroundColor: t.colors.accentMuted,
      borderWidth: 1,
      borderColor: t.colors.accent,
    },
    cellPressed: {
      backgroundColor: t.colors.glassHighlight,
    },
    cellLabel: {
      ...typography.caption,
      letterSpacing: letterSpacing.normal,
    },
    cellLabelActive: {
      color: t.colors.accent,
      fontFamily: typography.subtitle.fontFamily,
      fontWeight: typography.subtitle.fontWeight,
    },
    cellLabelInactive: {
      color: t.colors.textMuted,
    },
  }),
);
