import React from 'react';
import type { BadgeTileVm } from '../../domain/badges';
import type { Player } from '../../types/domain';
import { ProfileIdentityHeader } from './ProfileIdentityHeader';
import { ProfileKpiStrip } from './ProfileKpiStrip';
import { ProfilePerformanceCard } from './ProfilePerformanceCard';

type Props = {
  player: Player;
  winRatePct: number;
  winStreak: number;
  levelLabel: string;
  tierProgress01: number;
  compositeScore: number;
  sparklinePoints: number[];
  badgeTiles?: BadgeTileVm[];
  weeklyMatchStreakEffective?: number | null;
  showEditControls?: boolean;
  emailVerified?: boolean;
  onEditPress?: () => void;
};

export function ProfileStatsHero({
  player,
  winRatePct,
  winStreak,
  levelLabel,
  tierProgress01,
  compositeScore,
  sparklinePoints,
  badgeTiles,
  weeklyMatchStreakEffective,
  showEditControls,
  emailVerified,
  onEditPress,
}: Props) {
  return (
    <>
      <ProfileIdentityHeader
        player={player}
        badgeTiles={badgeTiles}
        showEditControls={showEditControls}
        emailVerified={emailVerified}
        onEditPress={onEditPress}
      />
      <ProfileKpiStrip
        matchesPlayed={player.stats.matchesPlayed}
        goals={player.stats.goals}
        assists={player.stats.assists}
        weeklyMatchStreakEffective={weeklyMatchStreakEffective}
      />
      <ProfilePerformanceCard
        player={player}
        winRatePct={winRatePct}
        winStreak={winStreak}
        levelLabel={levelLabel}
        tierProgress01={tierProgress01}
        compositeScore={compositeScore}
        sparklinePoints={sparklinePoints}
      />
    </>
  );
}
