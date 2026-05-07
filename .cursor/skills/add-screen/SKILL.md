---
name: add-screen
description: Adds a new screen or route in Halisaha Organizer with React Navigation — correct stack/tab registration, types, theme, and accessibility. Use when adding a stack screen, a new tab surface, or a new full-page flow.
---

# Add screen (Halisaha Organizer)

## Choose where the screen lives

| Goal | What to change |
|------|----------------|
| Home tab flow (ana sayfa → detay → kadro → skor) | [`src/navigation/HomeStackNav.tsx`](src/navigation/HomeStackNav.tsx) + [`HomeStackParamList`](src/navigation/types.ts) |
| Maçlarım flow | [`src/navigation/MyMatchesStackNav.tsx`](src/navigation/MyMatchesStackNav.tsx) + [`MyMatchesStackParamList`](src/navigation/types.ts) |
| Profil flow | [`src/navigation/ProfileStackNav.tsx`](src/navigation/ProfileStackNav.tsx) + [`ProfileStackParamList`](src/navigation/types.ts) |
| Ortak ekran iki stack’te de aynı bileşen | Tek implementation in [`src/screens/`](src/screens/); register in **each** stack that needs it (see `MatchDetail`, `LineupBuilder`, `ScoreEntry` pattern) |
| Ana tab bar’da yeni sekme veya tam ekran (stack yok) | [`src/navigation/AppNavigator.tsx`](src/navigation/AppNavigator.tsx) + [`src/navigation/tabScreensWithTransition.tsx`](src/navigation/tabScreensWithTransition.tsx) + [`RootTabParamList`](src/navigation/types.ts) |

## Implementation steps

1. **Implement UI** in [`src/screens/{Name}Screen.tsx`](src/screens/) (or a subfolder if the screen is large).
2. **Add route params** to the correct `*ParamList` in [`src/navigation/types.ts`](src/navigation/types.ts) (`undefined` if no params).
3. **Register** `<Stack.Screen name="..." component={...} options={{ title: '...' }} />` in the matching stack navigator.
4. **Navigate** with typed `navigation.navigate('RouteName', params?)` from existing screens; import param list types via React Navigation’s generated patterns already used in the repo.

## Tab transitions

Tabs wrap stack content in [`AnimatedTabScene`](src/navigation/TabSceneTransitionContext.tsx) via [`tabScreensWithTransition.tsx`](src/navigation/tabScreensWithTransition.tsx). New tab entries should follow the same wrapper pattern as `HomeTabWithTransition`, etc.

## UI and quality bar

1. **Theme:** use [`src/theme/index.ts`](src/theme/index.ts) (`colors`, `spacing`, `typography`, `radius`) — see [`ui-ux-design.mdc`](../../rules/ui-ux-design.mdc).
2. **testID** on pressables/inputs: `{domain}:{component}:{action}`.
3. **a11y:** `accessibilityRole` + `accessibilityLabel` (Turkish, matching visible copy).
4. **Copy:** Turkish inline strings are fine until i18n exists.

## State

- Read/write match and player data through [`useAppStore`](src/store/useAppStore.ts) with **atomic selectors** and `useShallow` when selecting multiple actions/fields — see [`technical-excellence.mdc`](../../rules/technical-excellence.mdc).

## When behavior touches domain rules

If the screen adds fields, status transitions, or persistence, follow [add-domain-feature](../add-domain-feature/SKILL.md) as well.
