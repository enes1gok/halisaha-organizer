import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarNotificationHero,
  StatsLeaderboardHero,
  TacticalPreviewHero,
} from '../components/app-intro';
import { PillButton } from '../components/PillButton';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors, spacing, typography } from '../theme';

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

export function AppIntroScreen({ onComplete }: AppIntroScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const listRef = useRef<FlatList<Slide>>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const slideWidth = windowWidth;

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / slideWidth);
      setPageIndex(Math.min(Math.max(idx, 0), SLIDES.length - 1));
    },
    [slideWidth],
  );

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

  const dots = useMemo(
    () =>
      SLIDES.map((s, i) => (
        <View
          key={s.key}
          style={[styles.dot, i === pageIndex ? styles.dotActive : undefined]}
          accessibilityElementsHidden
        />
      )),
    [pageIndex],
  );

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

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
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
        <View style={styles.dotsRow}>{dots}</View>
        {isLast ? (
          <PillButton
            title="Başla"
            onPress={finish}
            loading={finishing}
            disabled={finishing}
            testID="onboarding:intro:finish:press"
            accessibilityLabel="Tanıtımı bitir ve devam et"
          />
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
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textMuted,
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
    color: colors.text,
    letterSpacing: 0.2,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 22,
    borderRadius: 4,
  },
  finishingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
