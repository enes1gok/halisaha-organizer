import React from 'react';
import { CreateMatchTabScreen } from '../screens/CreateMatchTabScreen';
import { AnimatedTabScene } from './TabSceneTransitionContext';
import { GroupsStackNav } from './GroupsStackNav';
import { HomeStackNav } from './HomeStackNav';
import { ProfileStackNav } from './ProfileStackNav';

export function HomeTabWithTransition() {
  return (
    <AnimatedTabScene>
      <HomeStackNav />
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

export function GroupsTabWithTransition() {
  return (
    <AnimatedTabScene>
      <GroupsStackNav />
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
