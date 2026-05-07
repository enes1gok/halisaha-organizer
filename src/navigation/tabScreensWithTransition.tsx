import React from 'react';
import { CreateMatchTabScreen } from '../screens/CreateMatchTabScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { AnimatedTabScene } from './TabSceneTransitionContext';
import { HomeStackNav } from './HomeStackNav';
import { MyMatchesStackNav } from './MyMatchesStackNav';
import { ProfileStackNav } from './ProfileStackNav';

export function HomeTabWithTransition() {
  return (
    <AnimatedTabScene>
      <HomeStackNav />
    </AnimatedTabScene>
  );
}

export function MyMatchesTabWithTransition() {
  return (
    <AnimatedTabScene>
      <MyMatchesStackNav />
    </AnimatedTabScene>
  );
}

export function CreateTabWithTransition() {
  return (
    <AnimatedTabScene>
      <CreateMatchTabScreen />
    </AnimatedTabScene>
  );
}

export function LeaderTabWithTransition() {
  return (
    <AnimatedTabScene>
      <LeaderboardScreen />
    </AnimatedTabScene>
  );
}

export function ProfileTabWithTransition() {
  return (
    <AnimatedTabScene>
      <ProfileStackNav />
    </AnimatedTabScene>
  );
}
