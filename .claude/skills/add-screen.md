---
name: add-screen
description: Halisaha Organizer'da yeni ekran veya route ekler — doğru stack/tab kaydı, tipler, tema ve erişilebilirlik. Yeni stack ekranı, yeni tab yüzeyi veya yeni tam ekran akışı eklerken kullan.
---

# Add screen (Halisaha Organizer)

## Choose where the screen lives

| Goal | What to change |
|------|----------------|
| Home tab flow (ana sayfa → detay → kadro → skor) | [../../src/navigation/HomeStackNav.tsx](../../src/navigation/HomeStackNav.tsx) + [`HomeStackParamList`](../../src/navigation/types.ts) |
| Maçlarım flow | [../../src/navigation/MyMatchesStackNav.tsx](../../src/navigation/MyMatchesStackNav.tsx) + [`MyMatchesStackParamList`](../../src/navigation/types.ts) |
| Profil flow | [../../src/navigation/ProfileStackNav.tsx](../../src/navigation/ProfileStackNav.tsx) + [`ProfileStackParamList`](../../src/navigation/types.ts) |
| Groups tab flow (gruplarım → grup detay → haftalık seri → liderboard → maç akışı) | [../../src/navigation/GroupsStackNav.tsx](../../src/navigation/GroupsStackNav.tsx) + [`GroupsStackParamList`](../../src/navigation/types.ts) — see [.claude/rules/groups-and-series-governance.md](../rules/groups-and-series-governance.md) for role/permission constraints |
| Ortak ekran iki veya daha fazla stack'te aynı bileşen | Tek implementation in [../../src/screens/](../../src/screens/); register in **each** stack that needs it (see `MatchDetail`, `LineupBuilder`, `MatchPostgame`, `MatchSummary`, `MatchRatings` pattern) |
| Ana tab bar'da yeni sekme veya tam ekran (stack yok) | [../../src/navigation/AppNavigator.tsx](../../src/navigation/AppNavigator.tsx) + [../../src/navigation/tabScreensWithTransition.tsx](../../src/navigation/tabScreensWithTransition.tsx) + [`RootTabParamList`](../../src/navigation/types.ts) |

## Implementation steps

1. **Implement UI** in [../../src/screens/{Name}Screen.tsx](../../src/screens/) (or a subfolder if the screen is large).
2. **Add route params** to the correct `*ParamList` in [../../src/navigation/types.ts](../../src/navigation/types.ts) (`undefined` if no params).
3. **Register** `<Stack.Screen name="..." component={...} options={{ title: '...' }} />` in the matching stack navigator.
4. **Navigate** with typed `navigation.navigate('RouteName', params?)` from existing screens; import param list types via React Navigation's generated patterns already used in the repo.

## Tab transitions

Tabs wrap stack content in [`AnimatedTabScene`](../../src/navigation/TabSceneTransitionContext.tsx) via [tabScreensWithTransition.tsx](../../src/navigation/tabScreensWithTransition.tsx). New tab entries should follow the same wrapper pattern as `HomeTabWithTransition`, etc.

## UI and quality bar

1. **Theme:** use [../../src/theme/index.ts](../../src/theme/index.ts) (`colors`, `spacing`, `typography`, `radius`) — see [../rules/ui-ux-design.md](../rules/ui-ux-design.md).
2. **testID** on pressables/inputs: `{domain}:{component}:{action}`.
3. **a11y:** `accessibilityRole` + `accessibilityLabel` (Turkish, matching visible copy).
4. **Copy:** Turkish inline strings are fine until i18n exists.

## State

- Read/write match and player data through domain hooks from [../../src/store/index.ts](../../src/store/index.ts) (`useMatchesStore`, `usePlayersStore`, `useGroupsStore`, `usePreferencesStore`, `useMatchTemplatesStore`, …) with **atomic selectors** and `useShallow` when selecting multiple actions/fields — see [../rules/technical-excellence.md](../rules/technical-excellence.md).

## Groups flow screens

If the screen lives in `GroupsStackNav`, also read [../rules/groups-and-series-governance.md](../rules/groups-and-series-governance.md) and use [../skills/add-group-feature.md](../skills/add-group-feature.md) for the full checklist.

## When behavior touches domain rules

If the screen adds fields, status transitions, or persistence, follow [../skills/add-domain-feature.md](../skills/add-domain-feature.md) as well.
