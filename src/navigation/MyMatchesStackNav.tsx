import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { MyMatchesScreen } from '../screens/MyMatchesScreen';
import { ScoreEntryScreen } from '../screens/ScoreEntryScreen';
import type { MyMatchesStackParamList } from './types';

const Stack = createNativeStackNavigator<MyMatchesStackParamList>();

export function MyMatchesStackNav() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0A0A' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        contentStyle: { backgroundColor: '#0A0A0A' },
      }}
    >
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
