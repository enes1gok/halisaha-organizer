import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  HomeMain: undefined;
  JoinMatch: undefined;
  MatchDetail: { matchId: string };
  EditMatch: { matchId: string };
  LineupBuilder: { matchId: string };
  MatchSummary: { matchId: string };
  MatchRatingFlow: { matchId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  NotificationSettings: undefined;
  PrivacyPolicy: undefined;
  TermsOfUse: undefined;
  Licenses: undefined;
};

export type OnboardingStackParamList = {
  AuthWelcome: undefined;
  SignIn: { prefilledEmail?: string };
  SignUp: undefined;
  VerifyEmail: { email: string };
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
  EditMatch: { matchId: string };
  LineupBuilder: { matchId: string };
  MatchSummary: { matchId: string };
  MatchRatingFlow: { matchId: string };
  GroupSettings: { groupId: string };
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  CreateTab: undefined;
  GroupsTab: NavigatorScreenParams<GroupsStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};
