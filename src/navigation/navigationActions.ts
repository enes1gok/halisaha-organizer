import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootTabParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootTabParamList>();

export function openMatchDetail(matchId: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('HomeTab', {
    screen: 'MatchDetail',
    params: { matchId },
  });
}

export function openGroupDetail(groupId: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('GroupsTab', {
    screen: 'GroupDetail',
    params: { groupId },
  });
}

export function openProfileMain() {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('ProfileTab', {
    screen: 'ProfileMain',
  });
}
