import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { I18nManager, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { Durations, EasingPresets, TabSlide } from '../utils/animations';

/** Must match `Tab.Screen` order in `AppNavigator.tsx`. */
export const TAB_ROUTE_ORDER = [
  'HomeTab',
  'MyMatchesTab',
  'CreateTab',
  'GroupsTab',
  'ProfileTab',
] as const;
export type TabRouteName = (typeof TAB_ROUTE_ORDER)[number];

function isTabRouteName(name: string): name is TabRouteName {
  return (TAB_ROUTE_ORDER as readonly string[]).includes(name);
}

type TabSceneTransitionContextValue = {
  /** +1 = enter from right, -1 = from left, 0 = no slide (initial or unknown). */
  direction: -1 | 0 | 1;
};

const TabSceneTransitionContext = createContext<TabSceneTransitionContextValue>({
  direction: 0,
});

type TabSceneTransitionProviderProps = {
  children: React.ReactNode;
  /** Current root tab route name from `NavigationContainer` `onStateChange`. */
  activeTabName: string | undefined;
};

export function TabSceneTransitionProvider({
  children,
  activeTabName,
}: TabSceneTransitionProviderProps) {
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);
  const prevIndexRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!activeTabName || !isTabRouteName(activeTabName)) {
      setDirection(0);
      return;
    }
    const newIndex = TAB_ROUTE_ORDER.indexOf(activeTabName);
    const prev = prevIndexRef.current;

    if (prev === undefined) {
      prevIndexRef.current = newIndex;
      setDirection(0);
      return;
    }

    if (prev === newIndex) {
      return;
    }

    const rtl = I18nManager.isRTL ? -1 : 1;
    const slide = newIndex > prev ? 1 : -1;
    setDirection((slide * rtl) as -1 | 0 | 1);
    prevIndexRef.current = newIndex;
  }, [activeTabName]);

  const value = useMemo(() => ({ direction }), [direction]);

  return (
    <TabSceneTransitionContext.Provider value={value}>{children}</TabSceneTransitionContext.Provider>
  );
}

export function useTabSceneTransition() {
  return useContext(TabSceneTransitionContext);
}

type AnimatedTabSceneProps = {
  children: React.ReactNode;
};

/**
 * Wrap each tab route root so the screen slides horizontally when the tab gains focus.
 */
export function AnimatedTabScene({ children }: AnimatedTabSceneProps) {
  const { direction } = useTabSceneTransition();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const reduceMotion = useReduceMotion();
  const layoutMeta = useRef({ width: 0, direction: 0 as -1 | 0 | 1, isFocused: false });

  useLayoutEffect(() => {
    if (!isFocused) {
      cancelAnimation(translateX);
      cancelAnimation(opacity);
      opacity.value = 1;
      layoutMeta.current = { ...layoutMeta.current, isFocused: false };
      return;
    }

    const { width: prevW, direction: prevD, isFocused: wasFocused } = layoutMeta.current;
    const rotationOnly =
      wasFocused &&
      prevW > 0 &&
      width > 0 &&
      prevW !== width &&
      prevD === direction &&
      direction !== 0;

    layoutMeta.current = { width, direction, isFocused: true };

    if (rotationOnly) {
      return;
    }

    if (reduceMotion) {
      cancelAnimation(translateX);
      translateX.value = 0;
      if (direction !== 0) {
        cancelAnimation(opacity);
        opacity.value = 0;
        opacity.value = withTiming(1, {
          duration: Durations.normal,
          easing: EasingPresets.easeOutCubic,
        });
      } else {
        cancelAnimation(opacity);
        opacity.value = 1;
      }
      return;
    }

    cancelAnimation(opacity);
    opacity.value = 1;

    if (direction !== 0 && width > 0) {
      cancelAnimation(translateX);
      translateX.value = direction * width;
      translateX.value = withTiming(0, {
        duration: TabSlide.duration,
        easing: EasingPresets.easeOutCubic,
      });
    } else {
      cancelAnimation(translateX);
      translateX.value = 0;
    }
  }, [isFocused, direction, width, reduceMotion, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.clip}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    flex: 1,
    overflow: 'hidden',
  },
});
