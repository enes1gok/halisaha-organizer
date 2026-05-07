import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { MatchPostgameScreen } from '../screens/MatchPostgameScreen';
import { MatchPregameScreen } from '../screens/MatchPregameScreen';
import { MatchRatingsScreen } from '../screens/MatchRatingsScreen';
import { MatchSummaryScreen } from '../screens/MatchSummaryScreen';
import { MyMatchesScreen } from '../screens/MyMatchesScreen';
import { defaultStackScreenOptions } from './defaultStackScreenOptions';
import type { MyMatchesStackParamList } from './types';

const Stack = createStackNavigator<MyMatchesStackParamList>();

export function MyMatchesStackNav() {
  return (
    <Stack.Navigator screenOptions={defaultStackScreenOptions}>
      <Stack.Screen
        name="MyMatchesMain"
        component={MyMatchesScreen}
        options={{ title: 'Maçlarım' }}
      />
      <Stack.Screen
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{ title: 'Maç Detayı' }}
      />
      <Stack.Screen
        name="LineupBuilder"
        component={LineupBuilderScreen}
        options={{ title: 'Kadro Kur' }}
      />
      <Stack.Screen
        name="MatchPregame"
        component={MatchPregameScreen}
        options={{ title: 'Maç Öncesi' }}
      />
      <Stack.Screen
        name="MatchPostgame"
        component={MatchPostgameScreen}
        options={{ title: 'Maç Sonrası' }}
      />
      <Stack.Screen
        name="MatchSummary"
        component={MatchSummaryScreen}
        options={{ title: 'Maçın özeti' }}
      />
      <Stack.Screen
        name="MatchRatings"
        component={MatchRatingsScreen}
        options={{ title: 'Oyuncu derecelendirme' }}
      />
    </Stack.Navigator>
  );
}
