import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarNotificationHero,
  IntroFinishBurst,
  IntroProgressBar,
  StatsLeaderboardHero,
  TacticalPreviewHero,
} from '../components/app-intro';
import { PillButton } from '../components/PillButton';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { spacing, typography } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { Durations, Springs } from '../utils/animations';

export type AppIntroScreenProps = {
  onComplete: () => void | Promise<void>;
};

type Slide = {
  key: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'organize',
    title: 'Kaosu Bitir, Maçı Kur.',
    body:
      'WhatsApp gruplarında kaybolma. Maçını saniyeler içinde oluştur, katılımı anlık takip et.',
  },
  {
    key: 'lineup',
    title: 'Kadro Kurmak Hiç Bu Kadar Keyifli Olmamıştı.',
    body:
      'Dizilimini seç, oyuncuları sürükle ve profesyonel kadronu tüm takımla paylaş.',
  },
  {
    key: 'stats',
    title: 'Sahanın Yıldızı Ol.',
    body:
      'Maç sonu oylamalara katıl, istatistiklerini tut ve grubunun liderlik tablosunda zirveye oyna.',
  },
];

const AnimatedFlatList = Animated.FlatList<Slide>;

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      minHeight: 44,
      alignItems: 'center',
    },
    skipBtn: {
      minWidth: 44,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipPressed: {
      opacity: 0.75,
    },
    skipLabel: {
      ...typography.subtitle,
      color: t.colors.textMuted,
    },
    list: {
      flex: 1,
    },
    listContent: {
      flexGrow: 1,
    },
    slide: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    copyBlock: {
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    title: {
      ...typography.headlineStrong,
      color: t.colors.text,
      letterSpacing: 0.2,
    },
    body: {
      ...typography.body,
      color: t.colors.textMuted,
      lineHeight: 22,
    },
    footer: {
      position: 'relative',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.lg,
    },
    finishingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,10,10,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  }),
);

export function AppIntroScreen({ onComplete }: AppIntroScreenProps) {
  const styles = useStyles();
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const listRef = useRef<FlatList<Slide>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [burstVisible, setBurstVisible] = useState(false);
  const celebrationPlayedRef = useRef(false);

  const scrollX = useSharedValue(0);
  const slideWidthSV = useSharedValue(windowWidth);
  const ctaScale = useSharedValue(1);
  const ctaOpacity = useSharedValue(1);

  const slideWidth = windowWidth;

  useEffect(() => {
    slideWidthSV.value = slideWidth;
  }, [slideWidth, slideWidthSV]);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / slideWidth);
      setPageIndex(Math.min(Math.max(idx, 0), SLIDES.length - 1));
    },
    [slideWidth],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const goNext = useCallback(() => {
    if (pageIndex >= SLIDES.length - 1) return;
    const next = pageIndex + 1;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setPageIndex(next);
  }, [pageIndex]);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await Promise.resolve(onComplete());
    } finally {
      setFinishing(false);
    }
  }, [finishing, onComplete]);

  useEffect(() => {
    if (pageIndex !== SLIDES.length - 1) return;
    if (celebrationPlayedRef.current) return;
    celebrationPlayedRef.current = true;

    let burstTimer: ReturnType<typeof setTimeout> | undefined;

    if (reduceMotion) {
      ctaOpacity.value = withSequence(
        withTiming(0.9, { duration: Durations.fast }),
        withTiming(1, { duration: Durations.fast }),
      );
    } else {
      ctaScale.value = withSequence(
        withSpring(1.045, Springs.interactive),
        withSpring(1, Springs.interactive),
      );
      setBurstVisible(true);
      burstTimer = setTimeout(() => setBurstVisible(false), 720);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    return () => {
      if (burstTimer) clearTimeout(burstTimer);
    };
  }, [pageIndex, reduceMotion]);

  const renderHero = useCallback(
    (key: string) => {
      switch (key) {
        case 'organize':
          return <CalendarNotificationHero reduceMotion={reduceMotion} />;
        case 'lineup':
          return <TacticalPreviewHero reduceMotion={reduceMotion} />;
        case 'stats':
          return <StatsLeaderboardHero reduceMotion={reduceMotion} />;
        default:
          return null;
      }
    },
    [reduceMotion],
  );

  const renderItem: ListRenderItem<Slide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width: slideWidth }]}>
        {renderHero(item.key)}
        <View style={styles.copyBlock}>
          <Text style={styles.title} accessibilityRole="header">
            {item.title}
          </Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      </View>
    ),
    [renderHero, slideWidth],
  );

  const keyExtractor = useCallback((item: Slide) => item.key, []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: slideWidth,
      offset: slideWidth * index,
      index,
    }),
    [slideWidth],
  );

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ scale: ctaScale.value }],
  }));

  const isLast = pageIndex === SLIDES.length - 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={finish}
          disabled={finishing}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.skipPressed]}
          accessibilityRole="button"
          accessibilityLabel="Tanıtımı atla"
          testID="onboarding:intro:skip:press"
          hitSlop={8}
        >
          <Text style={styles.skipLabel}>Atla</Text>
        </Pressable>
      </View>

      <AnimatedFlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 120);
        }}
        accessibilityRole="adjustable"
        accessibilityLabel={`Tanıtım slaytı ${pageIndex + 1} / ${SLIDES.length}`}
        testID="onboarding:intro:pager"
      />

      <View style={styles.footer}>
        <IntroProgressBar
          scrollX={scrollX}
          slideWidth={slideWidthSV}
          slideCount={SLIDES.length}
          pageIndex={pageIndex}
        />

        {isLast && !reduceMotion ? <IntroFinishBurst visible={burstVisible} /> : null}

        {isLast ? (
          <Animated.View style={ctaAnimatedStyle}>
            <PillButton
              title="Başla"
              onPress={finish}
              loading={finishing}
              disabled={finishing}
              testID="onboarding:intro:finish:press"
              accessibilityLabel="Tanıtımı bitir ve devam et"
            />
          </Animated.View>
        ) : (
          <PillButton
            title="İleri"
            onPress={goNext}
            testID="onboarding:intro:next:press"
            accessibilityLabel="Sonraki slayt"
          />
        )}
      </View>

      {finishing ? (
        <View style={styles.finishingOverlay} pointerEvents="none">
          <ActivityIndicator color={themeColors.accent} size="large" />
        </View>
      ) : null}
    </View>
  );
}
