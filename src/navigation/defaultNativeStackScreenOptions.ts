import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, typography } from '../theme';
import { NavDurations } from '../utils/animations';

/** Shared by Home / Maçlarım / Gruplar native stacks (shared element transitions require native-stack). */
export const defaultNativeStackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { ...typography.subtitle },
  contentStyle: { backgroundColor: colors.background },
  animation: 'slide_from_right',
  animationDuration: NavDurations.nativeStack,
};
