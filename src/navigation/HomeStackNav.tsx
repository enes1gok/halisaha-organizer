import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useThemeColors } from '../theme/ThemeContext';
import { JoinMatchScreen } from '../screens/JoinMatchScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { EditMatchScreen } from '../screens/EditMatchScreen';
import { MatchFinalScreen } from '../screens/MatchFinalScreen';
import { MatchRatingFlowScreen } from '../screens/MatchRatingFlowScreen';
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
        name="EditMatch"
        component={EditMatchScreen}
        options={{ title: 'Maçı Düzenle' }}
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
