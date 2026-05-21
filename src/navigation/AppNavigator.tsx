import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type LinkingOptions,
  type NavigationState,
} from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { letterSpacing, shadows, typography } from '../theme';
import { makeStyles, useTheme, type ThemeColors } from '../theme/ThemeContext';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Durations, EasingPresets } from '../utils/animations';
import { TabSceneTransitionProvider } from './TabSceneTransitionContext';
import {
  CreateTabWithTransition,
  GroupsTabWithTransition,
  HomeTabWithTransition,
  ProfileTabWithTransition,
} from './tabScreensWithTransition';
import type { RootTabParamList } from './types';
import {
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOAT_MARGIN_H,
  TAB_BAR_OVERFLOW_TOP,
} from './tabBarLayout';
import { navigationRef } from './navigationActions';

const Tab = createBottomTabNavigator<RootTabParamList>();
const linking: LinkingOptions<RootTabParamList> = {
  prefixes: ['halisaha://'],
  config: {
    screens: {
      HomeTab: {
        screens: {
          MatchDetail: 'match/:matchId',
        },
      },
      GroupsTab: {
        screens: {
          GroupDetail: 'group/:groupId',
        },
      },
    },
  },
};

const ACTIVE_SCALE = 1.2;
const INACTIVE_SCALE = 1;

type TabIconRouteName = 'HomeTab' | 'GroupsTab' | 'ProfileTab';

type AnimatedTabIconProps = {
  routeName: string;
  focused: boolean;
};

function renderIonicon(routeName: string, color: string) {
  const size = 22;
  switch (routeName as TabIconRouteName) {
    case 'HomeTab':
      return <Ionicons name="home-outline" size={size} color={color} />;
    case 'GroupsTab':
      return <Ionicons name="people-outline" size={size} color={color} />;
    case 'ProfileTab':
      return <Ionicons name="person-outline" size={size} color={color} />;
    default:
      return null;
  }
}

function AnimatedTabIcon({ routeName, focused }: AnimatedTabIconProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(focused ? ACTIVE_SCALE : INACTIVE_SCALE);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const target = focused ? ACTIVE_SCALE : INACTIVE_SCALE;
    if (reduceMotion) {
      scale.value = target;
      return;
    }
    scale.value = withTiming(target, {
      duration: Durations.fast,
      easing: EasingPresets.easeOutCubic,
    });
  }, [focused, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const color = focused ? colors.accent : colors.textMuted;

  return <Animated.View style={animatedStyle}>{renderIonicon(routeName, color)}</Animated.View>;
}

function HalisaTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = useTabBarStyles();
  const insets = useSafeAreaInsets();
  const bottomInset = TAB_BAR_FLOAT_MARGIN_BOTTOM + Math.max(insets.bottom, 8);

  const activeRouteName = state.routes[state.index]?.name;

  const visibleRoutes = state.routes.filter((r) => r.name !== 'CreateTab');

  const label = (name: string) => {
    switch (name) {
      case 'HomeTab':
        return 'Ana Sayfa';
      case 'GroupsTab':
        return 'Gruplar';
      case 'ProfileTab':
        return 'Profil';
      default:
        return '';
    }
  };

  return (
    <View style={[styles.shell, { marginHorizontal: TAB_BAR_FLOAT_MARGIN_H, bottom: bottomInset }]}>
      <View style={styles.pill}>
        <View style={styles.row}>
          {visibleRoutes.map((route) => {
            const focused = activeRouteName === route.name;

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
                <AnimatedTabIcon routeName={route.name} focused={focused} />
                <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.textMuted }]}>
                  {label(route.name)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function buildNavTheme(scheme: 'light' | 'dark', colors: ThemeColors) {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.background,
      primary: colors.accent,
      text: colors.text,
      border: colors.border,
    },
  };
}

export function AppNavigator() {
  const { scheme, colors } = useTheme();
  const [activeTabName, setActiveTabName] = useState<string | undefined>(undefined);
  const activeTabRef = useRef<string | undefined>(undefined);

  const navTheme = useMemo(() => buildNavTheme(scheme, colors), [scheme, colors]);

  const onNavigationStateChange = useCallback((state: NavigationState | undefined) => {
    const name = state?.routes[state?.index ?? 0]?.name;
    if (name === undefined || name === activeTabRef.current) return;
    activeTabRef.current = name;
    setActiveTabName(name);
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={navTheme}
      onStateChange={onNavigationStateChange}
    >
      <TabSceneTransitionProvider activeTabName={activeTabName}>
        <Tab.Navigator
          tabBar={(p) => <HalisaTabBar {...p} />}
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
            },
          }}
        >
          <Tab.Screen name="HomeTab" component={HomeTabWithTransition} />
          <Tab.Screen
            name="CreateTab"
            component={CreateTabWithTransition}
            options={{ tabBarButton: () => null }}
          />
          <Tab.Screen name="GroupsTab" component={GroupsTabWithTransition} />
          <Tab.Screen name="ProfileTab" component={ProfileTabWithTransition} />
        </Tab.Navigator>
      </TabSceneTransitionProvider>
    </NavigationContainer>
  );
}

const useTabBarStyles = makeStyles((t) =>
  StyleSheet.create({
    shell: {
      position: 'absolute',
      left: 0,
      right: 0,
      overflow: 'visible',
      paddingTop: TAB_BAR_OVERFLOW_TOP,
    },
    pill: {
      position: 'relative',
      borderRadius: 32,
      backgroundColor: t.colors.surfaceGlass,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      overflow: 'visible',
      paddingVertical: 10,
      paddingHorizontal: 4,
      ...shadows.lg,
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
    tabLabel: {
      ...typography.micro,
      letterSpacing: letterSpacing.normal,
    },
  }),
);
