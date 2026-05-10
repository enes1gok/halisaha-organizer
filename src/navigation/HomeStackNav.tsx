import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useThemeColors } from '../theme/ThemeContext';
import { JoinMatchScreen } from '../screens/JoinMatchScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { MatchPostgameScreen } from '../screens/MatchPostgameScreen';
import { MatchRatingsScreen } from '../screens/MatchRatingsScreen';
import { MatchSummaryScreen } from '../screens/MatchSummaryScreen';
import { getDefaultNativeStackScreenOptions } from './defaultNativeStackScreenOptions';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNav() {
  const reduceMotion = useReduceMotion();
  const colors = useThemeColors();
  const screenOptions = useMemo(
    () => getDefaultNativeStackScreenOptions(reduceMotion, colors),
    [colors, reduceMotion],
  );
  return (
    <Stack.Navigator screenOptions={screenOptions}>
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
