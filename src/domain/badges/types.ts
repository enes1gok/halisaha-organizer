/** Rozet kataloğu ve hesaplama girdileri — kapsam: tüm bitmiş maçlar (grup filtresi yok). */

export type BadgeCategoryId = 'career' | 'streak' | 'peak_match' | 'rating';

export type BadgeRule =
  | { type: 'threshold'; field: keyof PlayerBadgeInputs; target: number }
  | {
      type: 'rating_gate';
      minAvg100: number;
      minVotes: number;
    }
  | { type: 'max_single_match'; field: 'maxGoalsSingleMatch' | 'maxAssistsSingleMatch'; target: number };

export interface BadgeDefinition {
  id: string;
  category: BadgeCategoryId;
  title: string;
  description: string;
  rule: BadgeRule;
}

/** Sunucu RPC `get_my_player_badge_inputs` ve yerel `computeLocalBadgeInputs` çıktısı ile uyumlu. */
export interface PlayerBadgeInputs {
  careerGoals: number;
  careerAssists: number;
  finishedMatchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  motmCount: number;
  goalMatchStreakCurrent: number;
  goalMatchStreakBest: number;
  avgPeerRating100: number | null;
  peerRatingVoteCount: number;
  maxGoalsSingleMatch: number;
  maxAssistsSingleMatch: number;
}

export interface BadgeTileVm {
  id: string;
  category: BadgeCategoryId;
  title: string;
  description: string;
  earned: boolean;
  /** 0–1; seri rozetlerinde “şu anki seri” üzerinden */
  progress01: number;
}
