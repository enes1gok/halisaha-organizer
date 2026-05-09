import type { StackNavigationOptions } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { colors, typography } from '../theme';
import { StackTransition } from '../utils/animations';

const stackTransitionSpec = {
  open: {
    animation: 'timing' as const,
    config: {
      duration: StackTransition.duration,
      easing: StackTransition.easing,
    },
  },
  close: {
    animation: 'timing' as const,
    config: {
      duration: StackTransition.duration,
      easing: StackTransition.easing,
    },
  },
};

export function getDefaultStackScreenOptions(reduceMotion: boolean): StackNavigationOptions {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { ...typography.subtitle },
    cardStyle: { backgroundColor: colors.background },
    cardStyleInterpolator: reduceMotion
      ? CardStyleInterpolators.forFadeFromCenter
      : CardStyleInterpolators.forHorizontalIOS,
    transitionSpec: stackTransitionSpec,
    cardOverlayEnabled: true,
  };
}
