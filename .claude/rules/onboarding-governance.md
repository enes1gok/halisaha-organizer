# Onboarding governance

Kapsam: oturum öncesi **ürün hikâyesi** ([AppIntroScreen.tsx](../../src/screens/AppIntroScreen.tsx)), **navigator kapısı** ([OnboardingStackNav.tsx](../../src/navigation/OnboardingStackNav.tsx)), **tanıtım görselleri** ([src/components/app-intro/](../../src/components/app-intro/)), **tamamlanma bayrağı** ([useAppIntroCompletion.ts](../../src/hooks/useAppIntroCompletion.ts)), ilk karşılama ([AuthWelcomeScreen.tsx](../../src/screens/AuthWelcomeScreen.tsx)). Genel giriş/kayıt formları (`SignIn`, `SignUp`, `VerifyEmail`) bu dosyanın kapsamında değildir.

## Flow ve kota

1. **Üst sınır (3 hikâye + 1 karşılama):** Oturum öncesi ürün hikâyesi **en fazla 3 slayt** — sabit liste [AppIntroScreen.tsx](../../src/screens/AppIntroScreen.tsx) içinde. Bunu izleyen **tek** ana karşılama ekranı [AuthWelcomeScreen.tsx](../../src/screens/AuthWelcomeScreen.tsx). Ek **ürün tanıtımı tam ekranı** (ör. dördüncü hikâye route'u, ekstra marketing stack ekranı) eklenmemeli. `SignIn` / `SignUp` / `VerifyEmail` işlevsel kimlik akışıdır; bu kotanın "hikâye" katmanına dahil edilmez.

## Atlama (Skip)

2. **Atla zorunlu:** Tanıtım sırasında kullanıcı zorla tüm slaytları izletilmemeli. [AppIntroScreen](../../src/screens/AppIntroScreen.tsx) üzerinde **her zaman** erişilebilir bir **Atla** kontrolü bulunmalı (`testID`: `onboarding:intro:skip:press`). Yeni tanıtım yüzeyi eklenirse atlama, [`markAppIntroCompleteInStorage`](../../src/hooks/useAppIntroCompletion.ts) ile **tamamlanmış** intro durumuna bağlanmalı ([STORAGE_KEYS.appIntroCompleted](../../src/constants/storageKeys.ts)).

## Beklenti yönetimi (görseller)

3. **Gerçek UI ile uyum:** Tanıtım görselleri ana uygulamanın görsel dilini yansıtmalı; tema token'ları [src/theme/index.ts](../../src/theme/index.ts) (`colors`, `typography`, `spacing`, `radius`, `shadows`). Taktik önizlemede [`colors.pitch`](../../src/theme/index.ts) ve şablon konumları [lineupFormations.ts](../../src/data/lineupFormations.ts) ile tutarlı kal. Ana üründe olmayan özellik vaadi veya alakasız stock tasarım kullanılmamalı. Referans bileşenler: [CalendarNotificationHero.tsx](../../src/components/app-intro/CalendarNotificationHero.tsx), [TacticalPreviewHero.tsx](../../src/components/app-intro/TacticalPreviewHero.tsx), [StatsLeaderboardHero.tsx](../../src/components/app-intro/StatsLeaderboardHero.tsx).

## Hareket

4. **Reduce motion:** Sistem tercihi açıksa [useReduceMotion](../../src/hooks/useReduceMotion.ts) ile döngü animasyonlarını sınırla veya statik vurguya geç; ayrıntılar için [motion-governance.md](motion-governance.md).

## Cross-links

- Tipografi ve spacing: [ui-ux-design.md](ui-ux-design.md)
- Dokunma hedefleri ve kart derinliği: [modern-ui-standards.md](modern-ui-standards.md)
- Tam taktik tahta davranışı (intro önizlemesi değil): [tactical-board-governance.md](tactical-board-governance.md)
