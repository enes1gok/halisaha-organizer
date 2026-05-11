---
name: add-domain-feature
description: Halisaha Organizer domain mantığını genişletir — maçlar, oyuncular, RSVP, ödemeler, kadro, öz-raporlar, skor, liderlik tablosu istatistikleri. Zustand store davranışı, domain tipleri veya seed verisi değiştirildiğinde kullan.
---

# Add domain feature (Halisaha Organizer)

## Domain map

| Concern | Primary locations |
|---------|-------------------|
| Types (`Player`, `Match`, `ScoreResult`, …) | [src/types/domain.ts](src/types/domain.ts) |
| CRUD + business rules + persistence | [src/store/useAppStore.ts](src/store/useAppStore.ts) (composer), [src/store/slices/](src/store/slices/), [src/store/helpers.ts](src/store/helpers.ts); UI imports domain hooks from [src/store/index.ts](src/store/index.ts) |
| Derived stats (goals, assists, W/L/D) | [src/utils/stats.ts](src/utils/stats.ts) (`recomputePlayerStatsFromMatches`, etc.) |
| Leaderboard ordering / display helpers | [src/utils/leaderboard.ts](src/utils/leaderboard.ts) |
| Roster / team split helpers | [src/utils/matchRoster.ts](src/utils/matchRoster.ts) |
| IDs / join codes | [src/utils/id.ts](src/utils/id.ts) |
| Demo / bootstrap data | [src/data/seed.ts](src/data/seed.ts) |
| UI by flow | [src/screens/](src/screens/) — e.g. `CreateMatchTabScreen`, `MatchDetailScreen`, `LineupBuilderScreen`, `ScoreEntryScreen`, `LeaderboardScreen`, `ProfileScreen` |

There is no `src/features/` split: **store (slices + helpers + composer) + types + screens** carry the product.

## Pre-flight

1. Decide whether the change is **model** (types), **store** (actions, persist), **derived** (stats), **UI**, or several — touch layers together so the app stays consistent.
2. If you add fields to `Player` or `Match`, plan **`STORE_VERSION`** and a **`migrate`** path in `persist` config when persistence must survive the change.

## Store patterns

- **Single store:** all mutations go through the composed store (`useAppStore` / domain hooks); avoid parallel ad-hoc caches of `matches` / `players`.
- **Immutability:** follow existing `map` / spread patterns when updating nested `matches` or `attendees`.
- **Scores:** `submitScore` merges approved self-reports into stat lines — keep behavior aligned with product expectations when changing reporting or scoring.
- **Stats sync:** player `stats` are recomputed from matches where the code path requires it (`withSyncedStats` pattern in the store).

## Where to put new code

| Kind | Put it in |
|------|-----------|
| Pure rules (no React) | `src/utils/` or [src/store/helpers.ts](src/store/helpers.ts) for merge/stats helpers shared by slices |
| AsyncStorage / persist / migrations | [src/store/useAppStore.ts](src/store/useAppStore.ts) `persist` options |
| React components used in one flow | `src/screens/` (or screen subfolder) |
| Reusable UI | `src/components/` |

## Post-change checklist

```
- [ ] src/types/domain.ts updated if the model changed
- [ ] Relevant store slice + `helpers.ts` + `useAppStore` persist/migrate if needed
- [ ] src/utils/stats.ts if aggregation rules change
- [ ] seed.ts if demo data should reflect new fields
- [ ] Screens + navigation types if new params or flows
- [ ] testID + a11y on new interactives (.claude/rules/ui-ux-design.md)
```

## Related

- New route shell → [.claude/skills/add-screen.md](.claude/skills/add-screen.md)
