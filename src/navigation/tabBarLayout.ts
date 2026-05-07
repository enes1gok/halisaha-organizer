/**
 * Shared layout for the floating pill tab bar. Keep scroll `paddingBottom` on tab-root screens in sync.
 */
export const TAB_BAR_FLOAT_MARGIN_H = 16;
export const TAB_BAR_FLOAT_MARGIN_BOTTOM = 12;
/** Small top inset so the bar shadow is not clipped (no FAB). */
export const TAB_BAR_OVERFLOW_TOP = 8;

/** Green “Maça katıl / Maçı kur” strip (two columns, vertical padding). Sync with HomeActionCard. */
export const HOME_ACTION_STRIP_HEIGHT = 72;

/** Gap between green strip and scroll content / inner spacing. */
export const HOME_ACTION_STRIP_GAP = 8;

/**
 * Extra bottom padding for Home FlatList so content clears the fixed action strip
 * (tab bar is outside the scene; only the strip overlaps scroll area).
 */
export const HOME_LIST_PADDING_BOTTOM_EXTRA =
  HOME_ACTION_STRIP_HEIGHT + HOME_ACTION_STRIP_GAP + 8 + 16;

/** Bottom padding for FlatList/ScrollView on tab screens that do not pin a home action strip. */
export const TAB_BAR_LIST_PADDING_BOTTOM = 96;

/** Leaderboard: extra list padding when the pinned “you” strip is visible. */
export const TAB_BAR_LIST_PADDING_PINNED_EXTRA = 36;
