import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PillButton } from '../components/PillButton';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

const CONTACT_EMAIL = 'privacy@halisaha.app';

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Hizmetin tanimi',
    body: 'Halisaha Organizer; halisaha maclarinin organizasyonu, katilimcilarin yonetimi, kadro kurulmasi ve skor/istatistik kaydedilmesi icin sunulan bir mobil uygulamadir.',
  },
  {
    title: 'Hesap ve sorumluluk',
    body: 'Hesap olustururken verdiginiz bilgilerin dogrulugundan ve hesabinizin guvenliginden siz sorumlusunuz. Hesabiniz uzerinden gerceklesen tum islemler size aittir. Supabase altyapisi uzerinde tutulan kimlik dogrulama bilgileri zorunlu temel veri olarak islenir.',
  },
  {
    title: 'Kabul edilebilir kullanim',
    body: 'Uygulamayi yasalara aykiri sekilde kullanmamayi, baskalarinin haklarini ihlal etmemeyi, otomasyon/scraping ile asiri yuk yaratmamayi ve hizmetin guvenligini bozacak davraniscalardan kacinmayi kabul edersiniz.',
  },
  {
    title: 'Icerik ve katilim',
    body: 'Uygulamada paylastiginiz mac, profil, skor ve katilim verileri icin gerekli izinlere sahip oldugunuzu beyan edersiniz. Topluluk kurallarina aykiri (taciz, nefret soylemi, vb.) icerikler kaldirilabilir ve hesap askiya alinabilir.',
  },
  {
    title: 'Hizmet degisiklikleri',
    body: 'Uygulamanin ozellikleri zaman zaman degistirilebilir, gelistirilebilir veya durdurulabilir. Onemli degisikliklerden makul oldugu olcude haberdar edilirsiniz.',
  },
  {
    title: 'Sorumluluk sinirlamasi',
    body: 'Uygulama "oldugu gibi" sunulur. Yasalarin izin verdigi azami olcude, dolayli zararlar (kar kaybi, veri kaybi, kesinti vb.) icin sorumluluk kabul edilmez. Tuketici haklarindan dogan zorunlu kanunlar saklidir.',
  },
  {
    title: 'Sona erdirme',
    body: 'Bu kosullari ihlal etmeniz halinde hesabiniz askiya alinabilir veya kapatilabilir. Hesabinizi istediginiz zaman silebilir veya kapatma talebinde bulunabilirsiniz; ayrintilar gizlilik politikasinda yer alir.',
  },
  {
    title: 'Yururluk ve degisiklikler',
    body: 'Bu kosullar uygulamayi kullandiginiz suresince yururluktedir. Onemli degisiklikler oldugunda guncel surum uygulama icinde yayinlanir; kullanmaya devam etmeniz guncel kosullari kabul ettiginiz anlamina gelir.',
  },
  {
    title: 'Iletisim',
    body: 'Sorulariniz ve talepleriniz icin privacy@halisaha.app adresine yazabilirsiniz.',
  },
];

export function TermsOfUseScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Kullanim Kosullari</Text>
        <Text style={styles.meta}>Son guncelleme: 2026-05-07</Text>
        <Text style={styles.intro}>
          Bu ekran, kullanim kosullarinin okunabilir bir ozetidir. Tam metin depo icindeki
          `docs/terms-of-use-tr.md` belgesinde surumlu olarak tutulur.
        </Text>
      </View>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}

      <PillButton
        title="E-posta ile iletisime gec"
        variant="ghost"
        onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
        testID="terms:contact-email:press"
        accessibilityLabel="Kullanim kosullari iletisim e-postasi ac"
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
