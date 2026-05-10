import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { typography } from '../theme';
import type { ThemeColors } from '../theme/ThemeContext';
import { Durations } from '../utils/animations';

function nativeStackBase(colors: ThemeColors) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { ...typography.subtitle },
    contentStyle: { backgroundColor: colors.background },
  } satisfies NativeStackNavigationOptions;
}

export function getDefaultNativeStackScreenOptions(
  reduceMotion: boolean,
  colors: ThemeColors,
): NativeStackNavigationOptions {
  return {
    ...nativeStackBase(colors),
    animation: reduceMotion ? 'fade' : 'slide_from_right',
    animationDuration: Durations.normal,
  };
}
