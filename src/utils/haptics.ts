import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function noopAsync(): Promise<void> {
  return Promise.resolve();
}

/** Light tap — buttons, list rows, tabs */
export function lightImpact(): Promise<void> {
  if (Platform.OS === 'web') return noopAsync();
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Toggles, segmented controls, picker ticks */
export function selectionTick(): Promise<void> {
  if (Platform.OS === 'web') return noopAsync();
  return Haptics.selectionAsync();
}

/** Success / warning toast companion (use sparingly) */
export function notifySuccess(): Promise<void> {
  if (Platform.OS === 'web') return noopAsync();
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
