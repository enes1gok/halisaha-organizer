# UI/UX and design hierarchy

Halisaha Organizer ships a **dark + light themed** UI (Sistem / Açık / Karanlık tercihi `Ayarlar > Görünüm` altında). Layout and copy should keep flows obvious (create → join → lineup → score → leaderboard).

## Visual hierarchy

- **Spacing:** Use [`spacing`](../../src/theme/index.ts) (`xs`–`xl`) and consistent `padding`/`margin`/`gap` rather than one-off magic numbers for new UI.
- **Contrast:** Do not rely on font size alone; use **weight** (`typography.title`, `subtitle`, …) and **color** (`text` vs `textMuted`) for hierarchy.
- **Surfaces:** Prefer `colors.background`, `colors.surface`, `colors.border` from theme — avoid ad-hoc hex that duplicates tokens.
- **Accent:** `colors.accent` for primary CTAs and active states; `accentMuted` for subtle fills.

## Design tokens (from theme)

| Role | Source |
|------|--------|
| Canvas / screen bg | `colors.background` |
| Cards / elevated panels | `colors.surface` |
| Borders | `colors.border` |
| Primary text / muted | `colors.text`, `colors.textMuted` |
| CTA / success accent | `colors.accent`, `colors.accentMuted` |
| Errors / destructive | `colors.danger` |
| Position chips | `colors.position.GK` … `FWD` |
| Corner radius | `radius.card`, `radius.pill`, `radius.sm` |
| Type scale | `typography.title`, `subtitle`, `body`, `caption`, `micro` |

Import from [src/theme/index.ts](../../src/theme/index.ts) (or a local relative path from the file).

## Theme awareness (light + dark)

- **Yeni veya yeniden yazılan yüzeyler `useTheme()` kullanmalı.** `colors` tokenını doğrudan import etmek yalnızca dokunulmamış legacy yüzeylerde kabul edilir; dokunulan dosyalar `useTheme()` veya `makeStyles()` ile temalanmalıdır.
- Hook ve yardımcılar [src/theme/ThemeContext.tsx](../../src/theme/ThemeContext.tsx) altında: `useTheme()`, `useThemeColors()`, `makeStyles((t) => StyleSheet.create({ ... }))`.
- Tema tercihi `usePreferencesStore((s) => s.themePreference)` ile okunur ve `setThemePreference('system' | 'light' | 'dark')` ile değişir; UI değişiklikleri bunu otomatik yansıtır.
- `darkColors` ve `lightColors` aynı şemaya sahip; bir token (örn. `colors.accent`) iki paletin de uygun değerine çözümlenir. Yeni renk token'ı eklerken her iki palete de değer girin.

## Styling approach

- **New UI:** Build with **`StyleSheet.create`** ve tema-bilinçli `makeStyles()` factory'sini tercih edin. Örüntüler için [Card.tsx](../../src/components/Card.tsx), [PillButton.tsx](../../src/components/PillButton.tsx) referans alınabilir.
- **Consistency:** Reuse shared components before adding new primitives.

## Motion (Reanimated)

Prefer **`react-native-reanimated`** for motion:

- `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming` for interactive feedback.
- Tab/scene transitions follow [TabSceneTransitionContext.tsx](../../src/navigation/TabSceneTransitionContext.tsx) — do not bypass the provider without a reason.
- Duration caps, spring presets, and reduce-motion slide→fade rules: [motion-governance.md](motion-governance.md).

For card depth, minimum touch-target sizing, and `Loading -> Success` transition requirements, follow [modern-ui-standards.md](modern-ui-standards.md). Reanimated is still preferred for complex motion, but `LayoutAnimation` is acceptable for simple state-transition polish.

## testID

Every interactive control (pressable, text input, switch) should expose **`testID`** for future E2E. Suggested format:

```
{domain}:{component}:{action}
```

Examples: `match:rsvp-going:press`, `lineup:lock:press`, `home:create-match:press`.

## Accessibility

For new or heavily touched interactives, set at least:

- `accessibilityRole` (`button`, `header`, `switch`, …)
- `accessibilityLabel` with the same language as on-screen copy (Turkish today)

## Component placement

| Scope | Path |
|--------|------|
| Shared (2+ screens) | [src/components/](../../src/components/) |
| Single screen | Colocate in the screen file or `src/screens/{Name}/` if the screen grows |

## Copy

There is **no i18n** layer yet — keep user-visible strings **Turkish** and consistent with existing screens. When i18n is added, migrate strings in a dedicated change.

## Cross-links

- Screen modular refactors: [.claude/skills/refactor-screen-to-modules.md](../skills/refactor-screen-to-modules.md)
- Module boundaries (where UI logic should live): [module-boundaries.md](module-boundaries.md)
- Test quality gates for interactives: [testing-quality-gate.md](testing-quality-gate.md)
