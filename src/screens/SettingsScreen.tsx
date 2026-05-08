import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { readDeleteAccountUrl } from '../lib/publicConfig';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import type { ProfileStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';
import { isEmailVerified } from '../utils/emailVerification';

type Nav = StackNavigationProp<ProfileStackParamList, 'Settings'>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hesap</Text>
        {!configured ? (
          <Text style={styles.hint}>
            Supabase için kök dizinde `.env` içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlayın;
            Metro’yu yeniden başlatın.
          </Text>
        ) : authLoading ? (
          <ActivityIndicator color={colors.accent} />
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
          </>
        ) : (
          <Text style={styles.hint}>Henüz giriş yapılmadı.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <PillButton
          title="Bildirim tercihleri"
          variant="ghost"
          onPress={() => navigation.navigate('NotificationSettings')}
          testID="profile:settings:notifications:press"
          accessibilityLabel="Bildirim tercihleri ekranına git"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gizlilik</Text>
        <PillButton
          title="Gizlilik Politikasi"
          variant="ghost"
          onPress={() => navigation.navigate('PrivacyPolicy')}
          testID="profile:privacy-policy:press"
          accessibilityLabel="Gizlilik politikasi ekranina git"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hesap Silme</Text>
        <PillButton
          title="Hesabimi ve Verilerimi Sil"
          variant="ghost"
          onPress={() => void openDeleteAccountUrl()}
          testID="profile:account-deletion:press"
          accessibilityLabel="Hesap ve veri silme baglantisini ac"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  email: {
    ...typography.body,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  emailVerified: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
  },
  emailUnverified: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
