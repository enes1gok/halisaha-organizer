# Skeleton Loading Usage Guide

This module standardizes first-load placeholders across screens.

## When to use skeleton

- Use skeletons for **initial screen loading** when real content is not available yet.
- Keep skeleton layout close to final content shape (hero/card/list rows).
- Prefer preset components in `src/components/skeleton/presets.tsx` for consistency.

## When to keep spinner

- Keep `ActivityIndicator` for **inline actions** (submit/save/toggle) where content is already visible.
- Keep pull-to-refresh indicators for list refresh; do not replace visible content with skeleton during refresh.

## Current implementation pattern

- `showInitialSkeleton = configured && loading && data.length === 0`
- Render skeleton only on first-load gap.
- After first content load, keep content visible for refresh and background fetches.

## Presets

- `HomeHeroSkeleton`, `HomeActionStripSkeleton`, `MatchCardSkeleton`
- `ProfileHeaderSkeleton`, `ProfileStatsGridSkeleton`
- `SettingsSectionSkeleton`
- `LeaderboardRowSkeleton`, `GroupCardSkeleton`

