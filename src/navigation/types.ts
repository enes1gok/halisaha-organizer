import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  HomeMain: undefined;
  JoinMatch: undefined;
  MatchDetail: { matchId: string };
  LineupBuilder: { matchId: string };
  ScoreEntry: { matchId: string };
};

export type MyMatchesStackParamList = {
  MyMatchesMain: undefined;
  MatchDetail: { matchId: string };
  LineupBuilder: { matchId: string };
  ScoreEntry: { matchId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  MyMatchesTab: NavigatorScreenParams<MyMatchesStackParamList> | undefined;
  CreateTab: undefined;
  LeaderTab: undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
