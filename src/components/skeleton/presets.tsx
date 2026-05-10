import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { SkeletonBlock } from './SkeletonBlock';
import { SkeletonList } from './SkeletonList';
import { SkeletonText } from './SkeletonText';

export function MatchCardSkeleton() {
  return (
    <View style={styles.matchCard}>
      <View style={styles.matchRow}>
        <View style={styles.matchMain}>
          <SkeletonText variant="subtitle" width="70%" />
          <SkeletonText variant="caption" width="42%" style={styles.topGap4} />
        </View>
        <SkeletonBlock width={54} height={30} radius={12} />
      </View>
    </View>
  );
}

/** Ana sayfa — hero altı “Son maç” kartı iskeleti. */
export function HomeLastMatchSkeleton() {
  return (
    <View style={styles.lastMatchOuter}>
      <View style={styles.lastMatchCard}>
        <SkeletonText variant="caption" width={72} />
        <SkeletonText variant="subtitle" width="58%" style={styles.topGap4} />
        <SkeletonText variant="caption" width={128} style={styles.topGap4} />
        <View style={styles.lastMatchScoreRow}>
          <SkeletonBlock width={132} height={34} radius={8} />
          <SkeletonBlock width={92} height={28} radius={radius.pill} />
        </View>
      </View>
    </View>
  );
}

export function HomeHeroSkeleton() {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <SkeletonText variant="caption" width={80} />
        <SkeletonText variant="caption" width={56} />
      </View>
      <SkeletonText variant="title" width="68%" />
      <SkeletonText variant="body" width="48%" />
      <View style={styles.heroDivider} />
      <View style={styles.heroBottom}>
        <SkeletonBlock width={44} height={20} radius={radius.pill} />
        <SkeletonBlock width={44} height={20} radius={radius.pill} />
      </View>
    </View>
  );
}

export function HomeActionStripSkeleton() {
  return (
    <View style={styles.actionStrip}>
      <View style={styles.actionCell}>
        <SkeletonText variant="body" width="56%" />
      </View>
      <View style={styles.actionDivider} />
      <View style={styles.actionCell}>
        <SkeletonText variant="body" width="56%" />
      </View>
    </View>
  );
}

export function SettingsSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.settingsSection}>
      <SkeletonText variant="subtitle" width="42%" />
      <SkeletonList
        count={rows}
        itemGap={spacing.sm}
        renderItem={() => (
          <View style={styles.settingsRow}>
            <View style={styles.settingsText}>
              <SkeletonText variant="body" width="66%" />
              <SkeletonText variant="caption" width="84%" />
            </View>
            <SkeletonBlock width={44} height={24} radius={radius.pill} />
          </View>
        )}
      />
    </View>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.profileHeader}>
      <SkeletonBlock width={88} height={88} radius={44} />
      <SkeletonText variant="title" width={180} />
      <View style={styles.profileBadges}>
        <SkeletonBlock width={56} height={24} radius={radius.pill} />
      </View>
    </View>
  );
}

/** KPI şeridi + performans kartı iskeleti (Profil / İstatistikler ekranı). */
export function ProfileStatsHeroSkeleton() {
  return (
    <View style={styles.profileStatsHero}>
      <View style={styles.kpiStripSkeleton}>
        {Array.from({ length: 3 }, (_, i) => (
          <View key={i} style={[styles.kpiCellSkeleton, i === 2 && styles.kpiCellSkeletonLast]}>
            <SkeletonText variant="title" width="48%" />
            <SkeletonText variant="caption" width="56%" />
          </View>
        ))}
      </View>
      <View style={styles.performanceCardSkeleton}>
        <SkeletonText variant="subtitle" width="42%" />
        <SkeletonBlock width="100%" height={6} radius={3} />
        <SkeletonText variant="body" width="72%" />
        <SkeletonText variant="body" width="88%" />
        <SkeletonText variant="body" width="64%" />
      </View>
    </View>
  );
}

/** @deprecated Yerine `ProfileStatsHeroSkeleton` kullanın. */
export function ProfileStatsGridSkeleton() {
  return <ProfileStatsHeroSkeleton />;
}

export function LeaderboardRowSkeleton() {
  return (
    <View style={styles.leaderRow}>
      <SkeletonText variant="body" width={24} />
      <SkeletonBlock width={40} height={40} radius={20} />
      <SkeletonText variant="body" width="42%" />
      <SkeletonText variant="subtitle" width={42} />
    </View>
  );
}

export function MyMatchesCalendarSkeleton() {
  return (
    <View style={styles.calendarShell}>
      <View style={styles.calendarHeader}>
        <SkeletonBlock width={36} height={36} radius={radius.pill} />
        <View style={styles.calendarTitleStack}>
          <SkeletonText variant="subtitle" width={120} />
          <SkeletonText variant="micro" width={64} style={styles.topGap4} />
        </View>
        <SkeletonBlock width={36} height={36} radius={radius.pill} />
      </View>
      <View style={styles.calendarWeekRow}>
        {Array.from({ length: 7 }, (_, idx) => (
          <View key={idx} style={styles.calendarWeekCell}>
            <SkeletonText variant="micro" width={20} />
          </View>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, rowIdx) => (
        <View key={rowIdx} style={styles.calendarGridRow}>
          {Array.from({ length: 7 }, (_, colIdx) => (
            <View key={colIdx} style={styles.calendarDayCell}>
              <SkeletonBlock width={28} height={28} radius={14} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function GroupCardSkeleton() {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupCardHeaderRow}>
        <SkeletonText variant="subtitle" width="58%" />
        <SkeletonBlock width={36} height={20} radius={radius.pill} />
      </View>
      <View style={styles.groupCardChipsRow}>
        <SkeletonBlock width={92} height={22} radius={radius.pill} />
        <SkeletonBlock width={104} height={22} radius={radius.pill} />
        <SkeletonBlock width={108} height={22} radius={radius.pill} />
      </View>
      <SkeletonText variant="caption" width="40%" />
    </View>
  );
}

const styles = StyleSheet.create({
  topGap4: { marginTop: 4 },
  lastMatchOuter: {
    marginTop: spacing.md,
  },
  lastMatchCard: {
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    gap: 4,
  },
  lastMatchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  heroBottom: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  matchMain: {
    flex: 1,
  },
  actionStrip: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCell: {
    flex: 1,
    alignItems: 'center',
  },
  actionDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.accent,
    opacity: 0.3,
  },
  settingsSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  settingsText: {
    flex: 1,
    gap: 6,
  },
  profileHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileStatsHero: {
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  kpiStripSkeleton: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  kpiCellSkeleton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  kpiCellSkeletonLast: {
    borderRightWidth: 0,
  },
  performanceCardSkeleton: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surfaceGlass,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  groupCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  groupCardChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  calendarShell: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  calendarTitleStack: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  calendarWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarGridRow: {
    flexDirection: 'row',
  },
  calendarDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
});
