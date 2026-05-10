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
}: Props) {
  return (
    <>
      <ProfileIdentityHeader player={player} badgeTiles={badgeTiles} />
      <ProfileKpiStrip
        matchesPlayed={player.stats.matchesPlayed}
        goals={player.stats.goals}
        assists={player.stats.assists}
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
