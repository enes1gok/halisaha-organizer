# Accessibility (Erişilebilirlik) duman testi matrisi

Bu doküman, **renk kontrastı**, **screen reader desteği** ve **dynamic type / font scale** kapsamında uygulamanın elle dogrulanması gereken minimum test akışlarını listeler. Otomatik testlerle (`src/theme/__tests__/contrast.test.ts`) kapsanmayan UI ve gesture davranışları buradaki listeye göre el ile koşulmalıdır.

Bağlam: kabul kriterleri ve mimari kararlar için `.cursor/rules/modern-ui-standards.mdc`, `.cursor/rules/ui-ux-design.mdc` ve `.cursor/rules/onboarding-governance.mdc` dosyaları kaynaktır.

## Cihaz ön hazırlığı

### iOS (Simulator veya gerçek cihaz)

1. `Settings > Accessibility > Display & Text Size > Larger Text`
   - "Larger Accessibility Sizes" anahtarı **açık**.
   - Slider en sağa çekilir (`AX5`).
2. `Settings > Accessibility > VoiceOver` **açık**.
   - Triple-click home/side button kısayolu kurulu olabilir; testi hızlandırır.
3. (Opsiyonel) `Settings > Accessibility > Display & Text Size > Increase Contrast` **açık**.

### Android (Emulator veya gerçek cihaz)

1. `Settings > Display > Font size` → **Largest** (genellikle 1.30x–1.50x arası).
2. `Settings > Accessibility > Font size` ve `Display size`'ı maksimuma alın.
3. `Settings > Accessibility > TalkBack` **açık**.

## Beklenti tavanları

- Uygulama tarafında `App.tsx` içinde `Text.defaultProps.maxFontSizeMultiplier = 1.6` global tavan koyulmuştur.
- Layout kararları için `useFontScale()` hook'u kullanılır:
  - `isLarge` ≥ 1.3 → küçük etiketleri sadeleştir, `numberOfLines` esnet.
  - `isHuge` ≥ 1.5 → yatay düzenleri dikeye çevir (örn. `LeaderboardPodium`, `ProfileKpiStrip`).
- Tüm metinler 1x–1.6x arasında **kırpılmamalı**, dokunma hedefleri **44×44** altına düşmemeli.

## Test matrisi

Aşağıdaki ekranlar sırasıyla açılır; her ekran için **iOS Largest + VoiceOver** ve **Android Largest + TalkBack** kombinasyonu denenir.

| # | Ekran | Test odakları | Kabul kriteri |
|---|---|---|---|
| 1 | `HomeScreen` (`HomeUpcomingHeroCard`, `HomeLastMatchCard`) | Tarih, mekan adı, "Katıl" butonu | Mekan adı 1–2 satır; CTA tek dokunuşla erişilebilir; ekran okuyucu kart başlığını + RSVP durumunu bildirir |
| 2 | `MatchDetailScreen` (Hero, RosterPanel, PaymentPanel, SummaryPanel) | Segment kontrol, "Ödeme yaptım" butonu, kadro listesi | Segment etiketleri kırpılmaz (`adjustsFontSizeToFit` devrede); roster oyuncu adları ekran okuyucuyla teker teker okunur |
| 3 | **`MatchRatingsScreen`** (detaylı mod) | Stepper, quick-band chip'leri | "X oyuncu puanı, 70 puan" duyurusu; **VoiceOver yukarı kaydırma puanı 5 artırır**, aşağı kaydırma 5 azaltır; `+`/`-` butonları ekran okuyucudan gizli (importantForAccessibility=no-hide-descendants) |
| 4 | `LineupBuilderScreen` | Bench DraggableCard adları, pitch slot'ları | `isLarge` (≥1.3) durumunda kart adı 2 satıra geçer; sürükleme 44×44 dokunma hedefini sağlar; "Sürükleyerek sahaya veya havuza taşıyın" hint'i okunur |
| 5 | `LeaderboardScreen` (Podium) | İlk üç sıra | `isHuge` (≥1.5) durumunda 3 sütun yatay yerine **dikey listeye geçer**; her satır madalya numarası + isim + değer ile ekran okuyucuya tek bir item olarak duyurulur |
| 6 | `ProfileScreen` (KpiStrip, PerformanceCard) | Maç/Gol/Asist KPI'ları, ProgressBar | `isHuge` durumunda KPI strip dikey kolona düşer; `accessibilityRole="progressbar"` + `accessibilityValue` "min/max/now" değerlerini bildirir |
| 7 | `SettingsScreen` | Tema seçimi, bildirim ayarları, çıkış | Switch'ler `accessibilityState.checked` bildirir; kayıtlı `accessibilityLabel` Türkçe ve ekrandaki copy ile birebir |
| 8 | `CreateMatchTabScreen` | Tarih/saat picker, mekan input, max oyuncu | TextInput'lar büyük yazıda kırpılmaz; CTA ("Maç oluştur") sabit yerde durur |

## Gözlem şablonu

Her ekran için aşağıdaki kontrol listesi doldurulmalıdır. Sonuçları `git` PR açıklamasına veya issue'ya yapıştırın.

```
Ekran: <ad>
iOS AX5  + VoiceOver:
  - Yatay scroll: yok / var
  - Metin kırpma: yok / var (yer: ___)
  - Dokunma hedefi 44x44 altı: yok / var (kontrol: ___)
  - Ekran okuyucu duyurusu yeterli: evet / hayır (eksik: ___)

Android Largest + TalkBack:
  - Yatay scroll: yok / var
  - Metin kırpma: yok / var (yer: ___)
  - Dokunma hedefi 44x44 altı: yok / var (kontrol: ___)
  - Ekran okuyucu duyurusu yeterli: evet / hayır (eksik: ___)
```

## Bilinen sorunlar

> Bu bölüm, smoke test sırasında bulunan ancak henüz düzeltilmemiş sorunları izlemek içindir. Yeni gözlemleri tarihiyle birlikte ekleyin.

| Tarih | Ekran | Sorun | Takip |
|---|---|---|---|
| _Henüz bir kayıt yok._ | | | |

## Otomatize edilebilir parçalar

İleride CI'a eklenebilecek mekanik kontroller:

- **Kontrast guard:** `src/theme/__tests__/contrast.test.ts` (mevcut). Yeni bir tema token'ı eklenirse aynı kalıbı izleyin.
- **Snapshot fontScale:** `useFontScale().isHuge` davranışı için Detox/Maestro testlerinde `device.setLargeText()` benzeri adımlar düşünülmeli.
- **`accessibilityValue` smoke:** `MatchRatingsScreen` adjustable wrapper testID'si `ratings:score:adjustable:<id>`; e2e'de bu öğenin `min`/`max`/`now` değerleri kontrol edilebilir.
