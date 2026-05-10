import { BADGE_CATALOG } from './catalog';
import type { BadgeTileVm, BadgeDefinition, PlayerBadgeInputs } from './types';

function readField(inputs: PlayerBadgeInputs, field: keyof PlayerBadgeInputs): number {
  const v = inputs[field];
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

function evalBadge(def: BadgeDefinition, inputs: PlayerBadgeInputs): Pick<BadgeTileVm, 'earned' | 'progress01'> {
  const { rule } = def;
  if (rule.type === 'threshold') {
    const cur = readField(inputs, rule.field);
    const t = rule.target;
    const earned = cur >= t;
    const progress01 = t <= 0 ? 1 : Math.min(1, cur / t);
    return { earned, progress01 };
  }
  if (rule.type === 'max_single_match') {
    const cur = readField(inputs, rule.field);
    const t = rule.target;
    const earned = cur >= t;
    const progress01 = t <= 0 ? 1 : Math.min(1, cur / t);
    return { earned, progress01 };
  }
  if (rule.type === 'rating_gate') {
    const votes = inputs.peerRatingVoteCount;
    const avg = inputs.avgPeerRating100;
    if (votes < rule.minVotes || avg === null || avg === undefined) {
      const progressVotes = Math.min(1, votes / rule.minVotes);
      return { earned: false, progress01: progressVotes * 0.5 };
    }
    const earned = avg >= rule.minAvg100;
    const progressAvg = Math.min(1, avg / rule.minAvg100);
    const progress01 = Math.min(1, (progressAvg + Math.min(1, votes / rule.minVotes)) / 2);
    return { earned, progress01 };
  }
  return { earned: false, progress01: 0 };
}

/** Seri rozetleri için ilerleme: “şu anki seri” / hedef (kazanıldıysa 1). */
function streakProgress01(def: BadgeDefinition, inputs: PlayerBadgeInputs): number {
  if (def.rule.type !== 'threshold' || def.rule.field !== 'goalMatchStreakBest') {
    return evalBadge(def, inputs).progress01;
  }
  const target = def.rule.target;
  if (target <= 0) return 1;
  const cur = inputs.goalMatchStreakCurrent;
  const best = inputs.goalMatchStreakBest;
  if (best >= target) return 1;
  return Math.min(1, cur / target);
}

export function computeBadgeTiles(inputs: PlayerBadgeInputs): BadgeTileVm[] {
  return BADGE_CATALOG.map((def) => {
    const base = evalBadge(def, inputs);
    const isStreakGoal =
      def.rule.type === 'threshold' && def.rule.field === 'goalMatchStreakBest';
    const progress01 = isStreakGoal ? streakProgress01(def, inputs) : base.progress01;
    return {
      id: def.id,
      category: def.category,
      title: def.title,
      description: def.description,
      earned: base.earned,
      progress01,
    };
  });
}

export function computeEarnedBadges(inputs: PlayerBadgeInputs): BadgeTileVm[] {
  return computeBadgeTiles(inputs).filter((b) => b.earned);
}
