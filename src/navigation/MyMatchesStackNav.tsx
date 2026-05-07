import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { MyMatchesScreen } from '../screens/MyMatchesScreen';
import { ScoreEntryScreen } from '../screens/ScoreEntryScreen';
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
        name="ScoreEntry"
        component={ScoreEntryScreen}
        options={{ title: 'Skor Gir' }}
      />
    </Stack.Navigator>
  );
}
