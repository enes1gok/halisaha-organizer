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
        <SkeletonBlock width={56} height={24} radius={radius.pill} />
      </View>
      <SkeletonText variant="caption" width="44%" />
    </View>
  );
}

export function ProfileStatsGridSkeleton() {
  return (
    <View style={styles.grid}>
      {Array.from({ length: 6 }, (_, index) => (
        <View key={index} style={styles.gridCell}>
          <SkeletonText variant="title" width="52%" />
          <SkeletonText variant="caption" width="66%" />
        </View>
      ))}
    </View>
  );
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

export function GroupCardSkeleton() {
  return (
    <View style={styles.groupCard}>
      <SkeletonText variant="subtitle" width="58%" />
      <SkeletonText variant="caption" width="40%" />
    </View>
  );
}

const styles = StyleSheet.create({
  topGap4: { marginTop: 4 },
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
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  gridCell: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
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
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
