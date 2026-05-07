import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  HomeMain: undefined;
  JoinMatch: undefined;
  MatchDetail: { matchId: string };
  LineupBuilder: { matchId: string };
  MatchPregame: { matchId: string };
  MatchPostgame: { matchId: string };
  MatchSummary: { matchId: string };
  MatchRatings: { matchId: string };
};

export type MyMatchesStackParamList = {
  MyMatchesMain: undefined;
  MatchDetail: { matchId: string };
  LineupBuilder: { matchId: string };
  MatchPregame: { matchId: string };
  MatchPostgame: { matchId: string };
  MatchSummary: { matchId: string };
  MatchRatings: { matchId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
  PrivacyPolicy: undefined;
  TermsOfUse: undefined;
};

export type GroupsStackParamList = {
  GroupsMain: undefined;
  GroupDetail: { groupId: string };
  GroupWeeklySeries: { groupId: string };
  GroupLeaderboard: { groupId: string };
  CreateGroup: undefined;
  JoinGroup: undefined;
  MatchDetail: { matchId: string };
  LineupBuilder: { matchId: string };
  MatchPregame: { matchId: string };
  MatchPostgame: { matchId: string };
  MatchSummary: { matchId: string };
  MatchRatings: { matchId: string };
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  MyMatchesTab: NavigatorScreenParams<MyMatchesStackParamList> | undefined;
  CreateTab: undefined;
  GroupsTab: NavigatorScreenParams<GroupsStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
