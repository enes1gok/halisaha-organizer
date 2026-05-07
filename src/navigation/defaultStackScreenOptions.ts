import type { StackNavigationOptions } from '@react-navigation/stack';
import { CardStyleInterpolators } from '@react-navigation/stack';

export const defaultStackScreenOptions: StackNavigationOptions = {
  headerStyle: { backgroundColor: '#0A0A0A' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
  cardStyle: { backgroundColor: '#0A0A0A' },
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
};
