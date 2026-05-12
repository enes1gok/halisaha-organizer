import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useThemeColors } from '../theme/ThemeContext';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { MatchFinalScreen } from '../screens/MatchFinalScreen';
import { MatchRatingFlowScreen } from '../screens/MatchRatingFlowScreen';
import { MyMatchesScreen } from '../screens/MyMatchesScreen';
import { getDefaultNativeStackScreenOptions } from './defaultNativeStackScreenOptions';
import type { MyMatchesStackParamList } from './types';

const Stack = createNativeStackNavigator<MyMatchesStackParamList>();

export function MyMatchesStackNav() {
  const reduceMotion = useReduceMotion();
  const colors = useThemeColors();
  const screenOptions = useMemo(
    () => getDefaultNativeStackScreenOptions(reduceMotion, colors),
    [colors, reduceMotion],
  );
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="MyMatchesMain"
        component={MyMatchesScreen}
        options={{ title: 'Maçlar' }}
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
        name="MatchSummary"
        component={MatchFinalScreen}
        options={{ title: 'Maç Sonucu' }}
      />
      <Stack.Screen
        name="MatchRatingFlow"
        component={MatchRatingFlowScreen}
        options={{ title: 'Oyuncuları Derecelendir' }}
      />
    </Stack.Navigator>
  );
}
