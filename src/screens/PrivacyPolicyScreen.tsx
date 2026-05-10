import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PillButton } from '../components/PillButton';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { PUBLIC_PRIVACY_POLICY_URL } from '../constants/legalUrls';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

const PRIVACY_CONTACT_EMAIL = 'privacy@halisaha.app';

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Veri sorumlusu',
    body: 'Halisaha Organizer uygulama isleticisi veri sorumlusudur. Sorulariniz ve hak talepleriniz icin privacy@halisaha.app adresini kullanabilirsiniz.',
  },
  {
    title: 'Hangi verileri isliyoruz?',
    body: 'Hesap (e-posta/kimlik), profil (ad, foto URL, pozisyon, tercih edilen ayak, istege bagli IBAN), mac katilim/RSVP, skor ve performans verileri.',
  },
  {
    title: 'Neden isliyoruz?',
    body: 'Mac organizasyonu, katilim yonetimi, skor/istatistik hesaplama ve hesap guvenligi icin. Hukuki dayanak agirlikla GDPR Madde 6(1)(b) ve 6(1)(f) kapsamindadir.',
  },
  {
    title: 'Nerede sakliyoruz?',
    body: 'Verileriniz Supabase uzerinde ve uygulama deneyimi icin cihazin yerel depolamasinda (AsyncStorage) tutulabilir.',
  },
  {
    title: 'Haklariniz',
    body: 'GDPR kapsaminda erisim, duzeltme, silme, kisitlama, tasinabilirlik ve itiraz haklariniz vardir. Basvurular kural olarak 1 ay icinde sonuclandirilir.',
  },
];

export function PrivacyPolicyScreen() {
  const styles = useStyles();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Gizlilik Politikasi</Text>
        <Text style={styles.meta}>Son guncelleme: 2026-05-07</Text>
        <Text style={styles.intro}>
          Bu ekran, politikanin okunabilir bir ozetidir. Tam ve guncel metin web uzerinden yayinlanir; gelistirme
          kopyasi `docs/privacy-policy-tr.md` ile es tutulmalidir.
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}

      <PillButton
        title="Tam metni tarayicida ac"
        variant="secondary"
        onPress={() => void Linking.openURL(PUBLIC_PRIVACY_POLICY_URL)}
        testID="privacy:full-policy-url:press"
        accessibilityLabel="Gizlilik politikasının tam metnini webde ac"
      />
      <PillButton
        title="E-posta ile iletisime gec"
        variant="ghost"
        onPress={() => void Linking.openURL(`mailto:${PRIVACY_CONTACT_EMAIL}`)}
        testID="privacy:contact-email:press"
        accessibilityLabel="Gizlilik iletisim e-postasi ac"
      />
    </ScrollView>
  );
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
      gap: spacing.sm,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.xs,
    },
    title: {
      ...typography.title,
      color: t.colors.text,
    },
    meta: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    intro: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    section: {
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.xs,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: t.colors.text,
    },
    body: {
      ...typography.body,
      color: t.colors.textMuted,
    },
  }),
);
