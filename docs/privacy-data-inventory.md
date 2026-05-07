# Halisaha Organizer - Kisisel Veri Isleme Envanteri

Bu envanter, uygulamadaki mevcut kod akislari temel alinarak hazirlanmistir ve GDPR odakli gizlilik politikasinin teknik dayanaigidir.

## 1) Kimlik ve hesap verileri

- Veri alanlari: `auth.users.id`, e-posta adresi (Supabase Auth), oturum belirtecleri.
- Kaynak: kullanici girisi/kayit akisi.
- Amac: kimlik dogrulama, hesap yonetimi, oturum surdurme.
- Hukuki dayanak: GDPR Madde 6(1)(b) (sozlesmenin ifasi), guvenlik kayitlari icin 6(1)(f) (mesru menfaat).
- Saklama yeri: Supabase Auth.
- Alicilar/isleyenler: Supabase (isleyen).
- Saklama: hesap aktif kaldigi surece ve yasal zorunluluklar/uyusmazlik savunmasi icin makul sure.

## 2) Profil verileri

- Veri alanlari: `display_name`, `photo_uri`, `position`, `preferred_foot`, `iban`.
- Kaynak: profil duzenleme ekrani.
- Amac: oyuncu profilini gostermek, mac organizasyonunu kolaylastirmak, odeme koordinasyonunu saglamak (IBAN).
- Hukuki dayanak: 6(1)(b) ve opsiyonel alanlar icin 6(1)(a) (acik riza/tercih) veya 6(1)(f) (mesru menfaat) birlikte degerlendirilebilir.
- Saklama yeri: Supabase `profiles`; ayrica cihazda `AsyncStorage` senkron kopyasi.
- Alicilar/isleyenler: Supabase (isleyen), maca katilan diger kullanicilar (uygulama ici gorunurluk kapsaminda).
- Saklama: hesap aktif oldugu surece; silme talebi veya hesap kapatma sonrasi teknik/yasal surecler dogrultusunda.

## 3) Mac ve katilim verileri

- Veri alanlari: `starts_at`, `venue`, `organizer_id`, `max_players`, `price_per_person`, `iban`, `join_code`, `attendees`, `team` dagilimi, `status`.
- Kaynak: mac olusturma, koda katilim, RSVP, odendi isaretleme, kadro kilitleme.
- Amac: temel urun islevleri (mac olusturma, katilim yonetimi, takim kurma).
- Hukuki dayanak: 6(1)(b), hile/istismar onleme gibi guvenlik ihtiyaclari icin 6(1)(f).
- Saklama yeri: Supabase veri tabani + cihazda onbellek/persist.
- Alicilar/isleyenler: Supabase (isleyen), ilgili mac katilimcilari.
- Saklama: urun deneyimi/sicil butunlugu icin gerekli sure boyunca; kullanici talebi ve yasal yukumluluklere gore silme/anonimlestirme.

## 4) Performans ve istatistik verileri

- Veri alanlari: gol, asist, mac sonucu, galibiyet/maglubiyet/beraberlik toplamlari, oz-bildirim talepleri.
- Kaynak: skor girisi, self-report akisi, istatistik yeniden hesaplama.
- Amac: liderlik tablosu ve oyuncu performans ozetleri.
- Hukuki dayanak: 6(1)(b) (hizmetin cekirdek parcasi), 6(1)(f) (oyun deneyimini gelistirme).
- Saklama yeri: Supabase tablolari + cihazda persist edilen uygulama durumu.
- Alicilar/isleyenler: Supabase (isleyen), ilgili kullanicilar.
- Saklama: hesap aktifligi ve spor kayit butunlugu ihtiyacina bagli; talep halinde silme/degerlendirme.

## 5) Yerel cihaz saklama (AsyncStorage)

- Veri alanlari: oyuncular, maclar ve bunlara bagli alt alanlarin yerel kopyasi.
- Kaynak: Zustand persist mekanizmasi.
- Amac: hizli acilis, cevrimdishiye yakin deneyim, gecici senkron kolayligi.
- Hukuki dayanak: 6(1)(b) ve 6(1)(f).
- Saklama yeri: kullanicinin cihazi (uygulama sandbox).
- Alicilar/isleyenler: dogrudan aktarim yok; cihaz guvenligi kullanicinin kontrolundedir.
- Saklama: uygulama kaldirilana, veriler temizlenene veya surum gecislerinde migrate/reset calisana kadar.

## 6) Alici ve aktarim ozeti

- Birincil hizmet saglayici/isleyen: Supabase (kimlik dogrulama + veritabani + iliskili altyapi bilesenleri).
- Ucuncu taraf reklam/analitik: kod tabaninda zorunlu bir reklam SDK'si veya davranissal analitik SDK'si tespit edilmemistir.
- Sinir otesi aktarim: Supabase altyapisinin bolgesine ve alt-isleyenlerine bagli olabilir; politika metninde uygun guvence mekanizmalari (SCC vb.) belirtilmelidir.

## 7) Yuke duyarlilik ve risk notu

- `iban` alani finansal baglam nedeniyle yuksek dikkat gerektirir; erisim kisitlamasi, maskeleme ve minimum gorunurluk ilkesi uygulanmalidir.
- `join_code` izinsiz katilim riskini azaltacak sekilde yeterli rastgelelikte uretilmeli ve paylasim kullanici kontrolunde olmalidir.

## 8) Onerilen saklama politikasi iskeleti

- Hesap/profil: hesap aktifligi boyunca.
- Mac kayitlari ve skorlar: spor kayit butunlugu icin gerekli sure boyunca, sonrasinda silme/anonimlestirme degerlendirmesi.
- Destek/hukuki kayitlar: yasal zorunluluk veya uyusmazlik savunmasi suresi boyunca.

Bu dokuman hukuki tavsiye degildir; yayin oncesi hukuk danismani tarafindan gozden gecirilmesi onerilir.
