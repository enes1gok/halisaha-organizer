import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import {
  RefreshControl,
  SectionList,
  type SectionListData,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import type { EmptyStateVariant } from '../../../components/emptyIllustrations/types';
import { MatchCard } from '../../../components/MatchCard';
import { MatchCardListRow } from '../../../components/MatchCardListRow';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../../../navigation/tabBarLayout';
import { letterSpacing, radius, spacing, typography } from '../../../theme';
import { makeStyles, useThemeColors } from '../../../theme/ThemeContext';
import type { Match } from '../../../types/domain';
import { countGoing } from '../../../utils/matchRoster';
import type { AgendaSection, SegmentValue } from '../adapters/groupMatchesByDay';

type EmptyAction = {
  label: string;
  onPress: () => void;
} | null;

type Props = {
  sections: AgendaSection[];
  segment: SegmentValue;
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  userId: string;
  selectedDateKey: string | null;
  /** When true, ignore viewability updates (calendar-driven agenda scroll in progress). */
  suppressPrimaryVisibleSyncRef?: React.MutableRefObject<boolean>;
  onPrimaryVisibleDateKeyChange?: (dateKey: string) => void;
  ListHeaderComponent?: React.ReactElement | null;
  onPressMatch: (match: Match) => void;
  emptyAction: EmptyAction;
};

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 15,
  minimumViewTime: 80,
  waitForInteraction: true,
};

export type MyMatchesAgendaHandle = {
  scrollToDateKey: (dateKey: string) => void;
};

const SEGMENT_TO_EMPTY_VARIANT: Record<SegmentValue, EmptyStateVariant> = {
  upcoming: 'matches_upcoming',
  past: 'matches_past',
  all: 'matches',
};

const EMPTY_COPY: Record<SegmentValue, { title: string; subtitle: string }> = {
  upcoming: {
    title: 'Yaklaşan maçın yok',
    subtitle: 'Yeni bir maç oluştur ya da ana sayfadan bir maça katıl.',
  },
  past: {
    title: 'Henüz oynanmış maçın yok',
    subtitle: 'İlk maçını oynadıktan sonra burada görünecek.',
  },
  all: {
    title: 'Henüz maçın yok',
    subtitle: 'Ana sayfadan bir maça katıl ya da yeni maç oluştur.',
  },
};

export const MyMatchesAgenda = forwardRef<MyMatchesAgendaHandle, Props>(function MyMatchesAgenda(
  {
    sections,
    segment,
    refreshing,
    onRefresh,
    userId,
    selectedDateKey,
    suppressPrimaryVisibleSyncRef,
    onPrimaryVisibleDateKeyChange,
    ListHeaderComponent,
    onPressMatch,
    emptyAction,
  },
  ref,
) {
  const styles = useAgendaStyles();
  const colors = useThemeColors();
  const listRef = useRef<SectionList<Match, AgendaSection>>(null);
  const indexByKey = useMemo(() => {
    const map = new Map<string, number>();
    sections.forEach((section, index) => map.set(section.dateKey, index));
    return map;
  }, [sections]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToDateKey: (dateKey) => {
        const index = indexByKey.get(dateKey);
        if (index === undefined) return;
        try {
          listRef.current?.scrollToLocation({
            sectionIndex: index,
            itemIndex: 0,
            animated: true,
            viewOffset: 8,
            viewPosition: 0,
          });
        } catch {
          // ignore — scrollToLocation can throw before layout
        }
      },
    }),
    [indexByKey],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (suppressPrimaryVisibleSyncRef?.current) return;
      if (!onPrimaryVisibleDateKeyChange || sections.length === 0) return;

      let bestIdx = Number.POSITIVE_INFINITY;
      let bestKey: string | null = null;

      for (const v of viewableItems) {
        if (!v.isViewable || v.section == null) continue;
        const sec = v.section as AgendaSection;
        const dateKey = sec.dateKey;
        const idx = sections.findIndex((s) => s.dateKey === dateKey);
        if (idx >= 0 && idx < bestIdx) {
          bestIdx = idx;
          bestKey = dateKey;
        }
      }

      if (bestKey == null || bestKey === selectedDateKey) return;
      onPrimaryVisibleDateKeyChange(bestKey);
    },
    [
      onPrimaryVisibleDateKeyChange,
      sections,
      selectedDateKey,
      suppressPrimaryVisibleSyncRef,
    ],
  );

  const empty = EMPTY_COPY[segment];

  return (
    <SectionList
      ref={listRef}
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={
        sections.length === 0 ? styles.emptyContent : styles.content
      }
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          progressViewOffset={spacing.sm}
        />
      }
      renderSectionHeader={({ section }) => (
        <SectionHeader
          section={section}
          highlighted={section.dateKey === selectedDateKey}
        />
      )}
      renderItem={({ item }) => {
        const goingCount = countGoing(item);
        const att = item.attendees.find((a) => a.playerId === userId);
        return (
          <MatchCardListRow matchId={item.id}>
            <MatchCard
              match={item}
              goingCount={goingCount}
              userRsvp={att?.status ?? null}
              onPress={() => onPressMatch(item)}
            />
          </MatchCardListRow>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          variant={SEGMENT_TO_EMPTY_VARIANT[segment]}
          title={empty.title}
          subtitle={empty.subtitle}
          actionLabel={emptyAction?.label}
          onAction={emptyAction?.onPress}
          heroTestID="myMatches:agenda:empty:hero"
        />
      }
      onScrollToIndexFailed={() => {
        // fall back silently
      }}
      viewabilityConfig={VIEWABILITY_CONFIG}
      onViewableItemsChanged={onViewableItemsChanged}
    />
  );
});

type SectionHeaderProps = {
  section: SectionListData<Match, AgendaSection>;
  highlighted: boolean;
};

function SectionHeader({ section, highlighted }: SectionHeaderProps) {
  const styles = useAgendaStyles();
  return (
    <View
      style={[styles.sectionHeader, highlighted && styles.sectionHeaderActive]}
      testID={`myMatches:agenda:section:${section.dateKey}`}
    >
      <Text style={[styles.sectionTitle, highlighted && styles.sectionTitleActive]}>
        {section.title}
      </Text>
      <View style={[styles.subtitlePill, highlighted && styles.subtitlePillActive]}>
        <Text style={[styles.sectionSubtitle, highlighted && styles.sectionSubtitleActive]}>
          {section.subtitle}
        </Text>
      </View>
    </View>
  );
}

const useAgendaStyles = makeStyles((t) =>
  StyleSheet.create({
    content: {
      padding: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
    },
    emptyContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
      justifyContent: 'flex-start',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: t.colors.background,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      borderRadius: radius.sm,
    },
    sectionHeaderActive: {
      backgroundColor: t.colors.accentMuted,
      paddingHorizontal: spacing.sm,
    },
    sectionTitle: {
      ...typography.subtitle,
      color: t.colors.text,
      letterSpacing: letterSpacing.tight,
    },
    sectionTitleActive: {
      color: t.colors.accent,
    },
    subtitlePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.colors.glassBorder,
      backgroundColor: t.colors.surfaceGlass,
    },
    subtitlePillActive: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accent,
    },
    sectionSubtitle: {
      ...typography.micro,
      color: t.colors.textMuted,
      letterSpacing: letterSpacing.normal,
    },
    sectionSubtitleActive: {
      color: t.colors.textOnAccent,
    },
  }),
);
