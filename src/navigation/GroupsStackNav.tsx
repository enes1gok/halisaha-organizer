import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { MatchPostgameScreen } from '../screens/MatchPostgameScreen';
import { MatchPregameScreen } from '../screens/MatchPregameScreen';
import { MatchRatingsScreen } from '../screens/MatchRatingsScreen';
import { MatchSummaryScreen } from '../screens/MatchSummaryScreen';
import { defaultStackScreenOptions } from './defaultStackScreenOptions';
import type { GroupsStackParamList } from './types';

const Stack = createStackNavigator<GroupsStackParamList>();

export function GroupsStackNav() {
  return (
    <Stack.Navigator screenOptions={defaultStackScreenOptions}>
      <Stack.Screen name="GroupsMain" component={GroupsScreen} options={{ title: 'Gruplarım' }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Grup Detayı' }} />
      <Stack.Screen
        name="GroupLeaderboard"
        component={LeaderboardScreen}
        options={{ title: 'Grup Liderligi' }}
      />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Grup Oluştur' }} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: 'Gruba Katıl' }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Maç Detayı' }} />
      <Stack.Screen name="LineupBuilder" component={LineupBuilderScreen} options={{ title: 'Kadro Kur' }} />
      <Stack.Screen name="MatchPregame" component={MatchPregameScreen} options={{ title: 'Maç Öncesi' }} />
      <Stack.Screen name="MatchPostgame" component={MatchPostgameScreen} options={{ title: 'Maç Sonrası' }} />
      <Stack.Screen name="MatchSummary" component={MatchSummaryScreen} options={{ title: 'Maçın özeti' }} />
      <Stack.Screen
        name="MatchRatings"
        component={MatchRatingsScreen}
        options={{ title: 'Oyuncu derecelendirme' }}
      />
    </Stack.Navigator>
  );
}
