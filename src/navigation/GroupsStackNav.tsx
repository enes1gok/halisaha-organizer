import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useThemeColors } from '../theme/ThemeContext';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { GroupDetailScreen } from '../screens/GroupDetailScreen';
import { GroupWeeklySeriesScreen } from '../screens/GroupWeeklySeriesScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { JoinGroupScreen } from '../screens/JoinGroupScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { LineupBuilderScreen } from '../screens/LineupBuilderScreen';
import { MatchDetailScreen } from '../screens/MatchDetailScreen';
import { EditMatchScreen } from '../screens/EditMatchScreen';
import { MatchFinalScreen } from '../screens/MatchFinalScreen';
import { MatchRatingFlowScreen } from '../screens/MatchRatingFlowScreen';
import { GroupSettingsScreen } from '../screens/GroupSettingsScreen';
import { getDefaultNativeStackScreenOptions } from './defaultNativeStackScreenOptions';
import type { GroupsStackParamList } from './types';

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export function GroupsStackNav() {
  const reduceMotion = useReduceMotion();
  const colors = useThemeColors();
  const screenOptions = useMemo(
    () => getDefaultNativeStackScreenOptions(reduceMotion, colors),
    [colors, reduceMotion],
  );
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="GroupsMain" component={GroupsScreen} options={{ title: 'Gruplarım' }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Grup Detayı' }} />
      <Stack.Screen
        name="GroupWeeklySeries"
        component={GroupWeeklySeriesScreen}
        options={{ title: 'Haftalık maç tekrarı' }}
      />
      <Stack.Screen
        name="GroupLeaderboard"
        component={LeaderboardScreen}
        options={{ title: 'Grup Liderligi' }}
      />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Grup Oluştur' }} />
      <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ title: 'Gruba Katıl' }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Maç Detayı' }} />
      <Stack.Screen name="EditMatch" component={EditMatchScreen} options={{ title: 'Maçı Düzenle' }} />
      <Stack.Screen name="LineupBuilder" component={LineupBuilderScreen} options={{ title: 'Kadro Kur' }} />
      <Stack.Screen name="MatchSummary" component={MatchFinalScreen} options={{ title: 'Maç Sonucu' }} />
      <Stack.Screen
        name="MatchRatingFlow"
        component={MatchRatingFlowScreen}
        options={{ title: 'Oyuncuları Derecelendir' }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ title: 'Grup Ayarları' }}
      />
    </Stack.Navigator>
  );
}
