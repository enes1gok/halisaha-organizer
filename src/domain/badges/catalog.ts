import type { BadgeDefinition } from './types';

/** Katalog tek kaynak; sunucu yalın sayı döner — eşikler burada tutulur (global kapsam). */
export const BADGE_CATALOG: BadgeDefinition[] = [
  // MOTM
  {
    id: 'motm_1',
    category: 'career',
    title: 'Maçın Adamı',
    description: 'En az bir kez maçın adamı seçildin.',
    rule: { type: 'threshold', field: 'motmCount', target: 1 },
  },
  {
    id: 'motm_5',
    category: 'career',
    title: 'Maçın Adamı ×5',
    description: 'Beş kez maçın adamı seçildin.',
    rule: { type: 'threshold', field: 'motmCount', target: 5 },
  },
  {
    id: 'motm_15',
    category: 'career',
    title: 'Maçın Adamı ×15',
    description: 'On beş kez maçın adamı seçildin.',
    rule: { type: 'threshold', field: 'motmCount', target: 15 },
  },
  // Gol / asist kariyer
  {
    id: 'goals_10',
    category: 'career',
    title: 'Gol Bankası',
    description: 'Kariyerinde 10 gol.',
    rule: { type: 'threshold', field: 'careerGoals', target: 10 },
  },
  {
    id: 'goals_50',
    category: 'career',
    title: 'Golcü',
    description: 'Kariyerinde 50 gol.',
    rule: { type: 'threshold', field: 'careerGoals', target: 50 },
  },
  {
    id: 'goals_100',
    category: 'career',
    title: 'Gol Makinesi',
    description: 'Kariyerinde 100 gol.',
    rule: { type: 'threshold', field: 'careerGoals', target: 100 },
  },
  {
    id: 'assists_10',
    category: 'career',
    title: 'Asistçi',
    description: 'Kariyerinde 10 asist.',
    rule: { type: 'threshold', field: 'careerAssists', target: 10 },
  },
  {
    id: 'assists_50',
    category: 'career',
    title: 'Oyun Kurucu',
    description: 'Kariyerinde 50 asist.',
    rule: { type: 'threshold', field: 'careerAssists', target: 50 },
  },
  {
    id: 'matches_10',
    category: 'career',
    title: 'Düzenli',
    description: '10 bitmiş maça çıktın.',
    rule: { type: 'threshold', field: 'finishedMatchesPlayed', target: 10 },
  },
  {
    id: 'matches_50',
    category: 'career',
    title: 'Halısaha emekçisi',
    description: '50 bitmiş maça çıktın.',
    rule: { type: 'threshold', field: 'finishedMatchesPlayed', target: 50 },
  },
  {
    id: 'wins_10',
    category: 'career',
    title: 'Kazanan',
    description: '10 galibiyet.',
    rule: { type: 'threshold', field: 'wins', target: 10 },
  },
  // Seri (üst üste maçta en az 1 gol — özet DB’de)
  {
    id: 'streak_goals_3',
    category: 'streak',
    title: 'Seri Skorer',
    description: 'Üst üste 3 maçta gol attın.',
    rule: { type: 'threshold', field: 'goalMatchStreakBest', target: 3 },
  },
  {
    id: 'streak_goals_5',
    category: 'streak',
    title: 'Ateş Hattı',
    description: 'Üst üste 5 maçta gol attın.',
    rule: { type: 'threshold', field: 'goalMatchStreakBest', target: 5 },
  },
  {
    id: 'streak_goals_10',
    category: 'streak',
    title: 'Bitmez Gol Serisi',
    description: 'Üst üste 10 maçta gol attın.',
    rule: { type: 'threshold', field: 'goalMatchStreakBest', target: 10 },
  },
  // Tek maç
  {
    id: 'hat_trick',
    category: 'peak_match',
    title: 'Hat-trick',
    description: 'Tek maçta en az 3 gol.',
    rule: { type: 'max_single_match', field: 'maxGoalsSingleMatch', target: 3 },
  },
  {
    id: 'assist_hat',
    category: 'peak_match',
    title: 'Asist Şov',
    description: 'Tek maçta en az 3 asist.',
    rule: { type: 'max_single_match', field: 'maxAssistsSingleMatch', target: 3 },
  },
  // Rating
  {
    id: 'rating_star',
    category: 'rating',
    title: 'Yıldız',
    description: 'En az 20 oyla ortalama 8.0 üzeri (10 üzerinden).',
    rule: { type: 'rating_gate', minAvg100: 80, minVotes: 20 },
  },
];
