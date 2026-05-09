# Gizlilik Politikasi Yayin Kontrol Listesi

Bu kontrol listesi, uygulama surumu cikmadan once gizlilik politikasi ve magaza beyanlarinin tutarli kalmasi icindir.

## Kod ve veri akis kontrolu

- [ ] `src/types/domain.ts` ve Supabase satir tiplerinde yeni kisisel veri alani var mi?
- [ ] `src/store/useAppStore.ts` icinde yeni persist edilen veri eklendi mi?
- [ ] Yeni entegrasyon (analitik, crash, push, reklam, odeme) eklendiyse politika guncellendi mi?
- [ ] Veri paylasim modeli (isleyenler/ucuncu taraflar) degisti mi?

## Politika metni ve linkleme

- [ ] `docs/privacy-policy-tr.md` son surum ile guncel.
- [ ] Herkese acik kanonik URL ve kod sabiti uyumlu: `src/constants/legalUrls.ts` → `PUBLIC_PRIVACY_POLICY_URL` (Notion sayfasi ile App Store / Play `Privacy Policy` alani ayri ayri kontrol).
- [ ] Profil akisinda uygulama ici gizlilik ekrani aciliyor.
- [ ] Veri sorumlusu iletisim e-postasi dogru.
- [ ] Yururluk ve guncelleme tarihi guncel.

## App Store / Google Play uyumu

- [ ] Magaza gizlilik formlari politika ile tutarli.
- [ ] Hesap/veri silme akisi gereksinimleri karsilaniyor.
- [ ] Google Play "Delete account URL" alani `https://www.notion.so/Hesap-Silme-35940f6636088042b4fff790b917bfc9?source=copy_link` ile dolduruldu ve herkese acik erisilebilir.
- [ ] Toplanan veri kategorileri magaza beyaninda eksiksiz.

## Hukuki ve operasyonel kontrol

- [ ] GDPR hak basvurusu sureci (1 ay hedefi) operasyonel olarak karsilanabilir.
- [ ] Uluslararasi aktarim aciklamasi guncel altyapiyla tutarli.
- [ ] Destek ekibi hak talepleri icin yonlendirme metnine sahip.
