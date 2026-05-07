import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';
import { CreateMatchTabScreen } from '../screens/CreateMatchTabScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { HomeStackNav } from './HomeStackNav';
import { MyMatchesStackNav } from './MyMatchesStackNav';
import { ProfileStackNav } from './ProfileStackNav';
import type { RootTabParamList } from './types';
import {
  TAB_BAR_FAB_OVERFLOW_TOP,
  TAB_BAR_FAB_SIZE,
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOAT_MARGIN_H,
} from './tabBarLayout';

const Tab = createBottomTabNavigator<RootTabParamList>();

const NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    primary: colors.accent,
    text: colors.text,
    border: colors.border,
  },
};

const FAB_TOP = -TAB_BAR_FAB_OVERFLOW_TOP;
const FAB_RADIUS = TAB_BAR_FAB_SIZE / 2;

function HalisaTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = TAB_BAR_FLOAT_MARGIN_BOTTOM + Math.max(insets.bottom, 8);

  const label = (name: string) => {
    switch (name) {
      case 'HomeTab':
        return 'Ana Sayfa';
      case 'MyMatchesTab':
        return 'Maçlarım';
      case 'CreateTab':
        return '';
      case 'LeaderTab':
        return 'Sıralama';
      case 'ProfileTab':
        return 'Profil';
      default:
        return '';
    }
  };

  const icon = (routeName: string, focused: boolean) => {
    const c = focused ? colors.accent : colors.textMuted;
    const size = 22;
    switch (routeName) {
      case 'HomeTab':
        return <Ionicons name="home-outline" size={size} color={c} />;
      case 'MyMatchesTab':
        return <Ionicons name="football-outline" size={size} color={c} />;
      case 'LeaderTab':
        return <Ionicons name="trophy-outline" size={size} color={c} />;
      case 'ProfileTab':
        return <Ionicons name="person-outline" size={size} color={c} />;
      default:
        return null;
    }
  };

  return (
    <View style={[styles.shell, { marginHorizontal: TAB_BAR_FLOAT_MARGIN_H, marginBottom: bottomInset }]}>
      <View style={styles.pill}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;

            if (route.name === 'CreateTab') {
              return <View key={route.key} style={[styles.tab, styles.createSpacer]} pointerEvents="none" />;
            }

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                onPress={onPress}
                style={styles.tab}
              >
                {icon(route.name, focused)}
                <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.textMuted }]}>
                  {label(route.name)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.fabWrap} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Maç oluştur"
            hitSlop={12}
            onPress={() => navigation.navigate('CreateTab')}
            style={styles.fab}
          >
            <Ionicons name="add" size={30} color="#0A0A0A" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={NavTheme}>
      <Tab.Navigator
        tabBar={(p) => <HalisaTabBar {...p} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="HomeTab" component={HomeStackNav} />
        <Tab.Screen name="MyMatchesTab" component={MyMatchesStackNav} />
        <Tab.Screen name="CreateTab" component={CreateMatchTabScreen} />
        <Tab.Screen name="LeaderTab" component={LeaderboardScreen} />
        <Tab.Screen name="ProfileTab" component={ProfileStackNav} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const barShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      }
    : { elevation: 14 };

const fabShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      }
    : { elevation: 10 };

const styles = StyleSheet.create({
  shell: {
    overflow: 'visible',
    paddingTop: TAB_BAR_FAB_OVERFLOW_TOP,
  },
  pill: {
    position: 'relative',
    flexDirection: 'column',
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'visible',
    paddingVertical: 10,
    paddingHorizontal: 4,
    ...barShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  createSpacer: {
    minHeight: 50,
  },
  tabLabel: {
    ...typography.micro,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: FAB_TOP,
    height: TAB_BAR_FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: TAB_BAR_FAB_SIZE,
    height: TAB_BAR_FAB_SIZE,
    borderRadius: FAB_RADIUS,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...fabShadow,
  },
});
