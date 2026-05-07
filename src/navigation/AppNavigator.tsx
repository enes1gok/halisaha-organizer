import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, type LinkingOptions, type NavigationState } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography } from '../theme';
import { TabSceneTransitionProvider } from './TabSceneTransitionContext';
import {
  CreateTabWithTransition,
  GroupsTabWithTransition,
  HomeTabWithTransition,
  MyMatchesTabWithTransition,
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

function HalisaTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = TAB_BAR_FLOAT_MARGIN_BOTTOM + Math.max(insets.bottom, 8);

  const activeRouteName = state.routes[state.index]?.name;

  const visibleRoutes = state.routes.filter((r) => r.name !== 'CreateTab');

  const label = (name: string) => {
    switch (name) {
      case 'HomeTab':
        return 'Ana Sayfa';
      case 'MyMatchesTab':
        return 'Maçlarım';
      case 'GroupsTab':
        return 'Gruplar';
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
      case 'GroupsTab':
        return <Ionicons name="people-outline" size={size} color={c} />;
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
                {icon(route.name, focused)}
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

export function AppNavigator() {
  const [activeTabName, setActiveTabName] = useState<string | undefined>(undefined);
  const activeTabRef = useRef<string | undefined>(undefined);

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
      theme={NavTheme}
      onStateChange={onNavigationStateChange}
    >
      <TabSceneTransitionProvider activeTabName={activeTabName}>
        <Tab.Navigator
          tabBar={(p) => <HalisaTabBar {...p} />}
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopWidth: 0,
              elevation: 0,
            },
          }}
        >
          <Tab.Screen name="HomeTab" component={HomeTabWithTransition} />
          <Tab.Screen name="MyMatchesTab" component={MyMatchesTabWithTransition} />
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

const barShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      }
    : { elevation: 14 };

const styles = StyleSheet.create({
  shell: {
    overflow: 'visible',
    paddingTop: TAB_BAR_OVERFLOW_TOP,
  },
  pill: {
    position: 'relative',
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
  tabLabel: {
    ...typography.micro,
  },
});
