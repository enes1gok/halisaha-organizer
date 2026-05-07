import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { JoinMatchScreen } from '../screens/JoinMatchScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { ScoreEntryScreen } from '../screens/ScoreEntryScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNav() {
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
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'HalıSaha' }}
      />
      <Stack.Screen
        name="JoinMatch"
        component={JoinMatchScreen}
        options={{ title: 'Maça katıl' }}
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
