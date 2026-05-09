import type { StackNavigationOptions } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';
import { colors, typography } from '../theme';

export const defaultStackScreenOptions: StackNavigationOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerTitleStyle: { ...typography.subtitle },
  cardStyle: { backgroundColor: colors.background },
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
};
