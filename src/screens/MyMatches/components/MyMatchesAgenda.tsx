import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  RefreshControl,
  SectionList,
  type SectionListData,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '../../../components/EmptyState';
import { MatchCard } from '../../../components/MatchCard';
import { MatchCardListRow } from '../../../components/MatchCardListRow';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../../../navigation/tabBarLayout';
import { colors, letterSpacing, radius, spacing, typography } from '../../../theme';
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
  ListHeaderComponent?: React.ReactElement | null;
  onPressMatch: (match: Match) => void;
  emptyAction: EmptyAction;
};

export type MyMatchesAgendaHandle = {
  scrollToDateKey: (dateKey: string) => void;
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
    ListHeaderComponent,
    onPressMatch,
    emptyAction,
  },
  ref,
) {
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
        const userGoing = att?.status === 'going';
        return (
          <MatchCardListRow matchId={item.id}>
            <MatchCard
              match={item}
              goingCount={goingCount}
              userGoing={userGoing}
              onPress={() => onPressMatch(item)}
            />
          </MatchCardListRow>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          title={empty.title}
          subtitle={empty.subtitle}
          actionLabel={emptyAction?.label}
          onAction={emptyAction?.onPress}
        />
      }
      onScrollToIndexFailed={() => {
        // fall back silently
      }}
    />
  );
});

type SectionHeaderProps = {
  section: SectionListData<Match, AgendaSection>;
  highlighted: boolean;
};

function SectionHeader({ section, highlighted }: SectionHeaderProps) {
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
  },
  sectionHeaderActive: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    letterSpacing: letterSpacing.tight,
  },
  sectionTitleActive: {
    color: colors.accent,
  },
  subtitlePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceGlass,
  },
  subtitlePillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  sectionSubtitle: {
    ...typography.micro,
    color: colors.textMuted,
    letterSpacing: letterSpacing.normal,
  },
  sectionSubtitleActive: {
    color: colors.background,
  },
});
