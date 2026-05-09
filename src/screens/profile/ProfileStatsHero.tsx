import React from 'react';
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
};

export function ProfileStatsHero({
  player,
  winRatePct,
  winStreak,
  levelLabel,
  tierProgress01,
  compositeScore,
}: Props) {
  return (
    <>
      <ProfileIdentityHeader player={player} />
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
      />
    </>
  );
}
