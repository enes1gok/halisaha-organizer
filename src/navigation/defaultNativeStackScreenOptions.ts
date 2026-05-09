import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors, typography } from '../theme';
import { Durations } from '../utils/animations';

const nativeStackBase = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { ...typography.subtitle },
  contentStyle: { backgroundColor: colors.background },
} satisfies NativeStackNavigationOptions;

export function getDefaultNativeStackScreenOptions(
  reduceMotion: boolean,
): NativeStackNavigationOptions {
  return {
    ...nativeStackBase,
    animation: reduceMotion ? 'fade' : 'slide_from_right',
    animationDuration: Durations.normal,
  };
}
