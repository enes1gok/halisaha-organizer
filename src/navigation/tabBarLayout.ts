/**
 * Shared layout for the floating pill tab bar. Keep scroll `paddingBottom` on tab-root screens in sync.
 */
export const TAB_BAR_FLOAT_MARGIN_H = 16;
export const TAB_BAR_FLOAT_MARGIN_BOTTOM = 4;
/** Shell padding + pill row; snackbar clears above floating tab bar. */
export const TAB_BAR_FLOATING_BLOCK_HEIGHT = 78;
/** Small top inset so the bar shadow is not clipped (no FAB). */
export const TAB_BAR_OVERFLOW_TOP = 8;

/**
 * Green “Maça katıl / Maçı kur” strip (two columns, vertical padding).
 * Sync with [`HomeActionCard`](../components/HomeActionCard.tsx) `minHeight` / padding when changing layout.
 */
export const HOME_ACTION_STRIP_HEIGHT = 72;

/** Gap between green strip and scroll content / inner spacing. */
export const HOME_ACTION_STRIP_GAP = 8;

/**
 * Bottom distance of the action strip from screen bottom — positions it flush
 * against the floating tab bar pill. TAB_BAR_OVERFLOW_TOP (8px shadow area)
 * provides the natural breathing gap between strip and pill.
 */
export function getHomeActionStripBottom(insetsBottom: number): number {
  return (
    TAB_BAR_FLOATING_BLOCK_HEIGHT +
    TAB_BAR_FLOAT_MARGIN_BOTTOM +
    Math.max(insetsBottom, 8)
  );
}

/** Home liste alt dolgusu — içerik hem şerit hem de tab bar'ın altında kalacak şekilde hesaplanır. */
export function getHomeListPaddingBottom(insetsBottom: number): number {
  return getHomeActionStripBottom(insetsBottom) + HOME_ACTION_STRIP_HEIGHT + HOME_ACTION_STRIP_GAP + 16;
}

/**
 * Dynamic bottom padding for FlatList/ScrollView on any screen inside the tab navigator.
 * Clears the floating pill tab bar + device safe area inset.
 * Pass `useSafeAreaInsets().bottom` as the argument.
 */
export function getTabBarListPaddingBottom(insetsBottom: number): number {
  return (
    TAB_BAR_FLOATING_BLOCK_HEIGHT +
    TAB_BAR_FLOAT_MARGIN_BOTTOM +
    Math.max(insetsBottom, 8) +
    8
  );
}

/** @deprecated Use getTabBarListPaddingBottom(insets.bottom) instead. */
export const TAB_BAR_LIST_PADDING_BOTTOM = 96;

/** Leaderboard: extra list padding when the pinned “you” strip is visible. */
export const TAB_BAR_LIST_PADDING_PINNED_EXTRA = 36;
