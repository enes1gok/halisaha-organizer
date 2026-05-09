import type { StackNavigationOptions } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { colors, typography } from '../theme';
import { StackTransition } from '../utils/animations';

export const defaultStackScreenOptions: StackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { ...typography.subtitle },
  cardStyle: { backgroundColor: colors.background },
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: StackTransition.duration,
        easing: StackTransition.easing,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: StackTransition.duration,
        easing: StackTransition.easing,
      },
    },
  },
  cardOverlayEnabled: true,
};
