# Gizlilik Politikasi Onay Paketi

Tarih: 2026-05-07

## Yayinlanacak belgeler

- Herkese acik yayin (`PUBLIC_PRIVACY_POLICY_URL` sabiti → Notion tam metin): `https://www.notion.so/Gizlilik-Politikasi-35940f6636088054876be6bf50f06bbe`
- `docs/privacy-policy-tr.md` (kanonik metin / repo icyi karşılaştırma)
- `docs/privacy-policy-en.md` (opsiyonel Ingilizce eslik metin)
- `docs/privacy-data-inventory.md` (teknik dayanak)
- `docs/privacy-release-checklist.md` (surum kontrol listesi)

## Changelog satiri (onerilen)

- `docs: GDPR-first gizlilik politikasi, veri envanteri ve yayin kontrol listesini ekle`

## Go-live hedefi

- Hedef yayin tarihi: 2026-05-10
- On kosullar:
  - Veri sorumlusu unvani ve iletisim e-postasi kesinlestirilmis olmali.
  - App Store / Google Play gizlilik formlari yeni metinle eslestirilmeli.
  - Profil ekranindaki "Gizlilik Politikasi" rotasi release build'de test edilmeli.

## Tutarlilik notlari

- Politika, mevcut kod akislarindaki Supabase Auth + Supabase DB + yerel persist modeline gore yazilmistir.
- Kod tabaninda zorunlu reklam/davranissal analitik SDK tespit edilmemistir.
- Yeni veri alani ya da yeni ucuncu taraf eklendiginde politika ve magaza beyanlari birlikte guncellenmelidir.
