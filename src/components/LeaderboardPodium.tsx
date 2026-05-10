import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlayerAvatar } from './PlayerAvatar';
import { useFontScale } from '../hooks/useFontScale';
import { colors, radius, shadows, spacing, typography } from '../theme';

export type PodiumLeaderRow = {
  playerId: string;
  value: number;
  rank: number;
};

type Medal = 'gold' | 'silver' | 'bronze';

const MEDAL_STYLES: Record<
  Medal,
  { accent: string; surface: string; border: string; minHeight: number; avatar: number; testSuffix: string }
> = {
  silver: {
    accent: colors.leaderboard.silverAccent,
    surface: colors.leaderboard.silverSurface,
    border: colors.leaderboard.silverBorder,
    minHeight: 132,
    avatar: 44,
    testSuffix: 'rank-2',
  },
  gold: {
    accent: colors.leaderboard.goldAccent,
    surface: colors.leaderboard.goldSurface,
    border: colors.leaderboard.goldBorder,
    minHeight: 168,
    avatar: 52,
    testSuffix: 'rank-1',
  },
  bronze: {
    accent: colors.leaderboard.bronzeAccent,
    surface: colors.leaderboard.bronzeSurface,
    border: colors.leaderboard.bronzeBorder,
    minHeight: 116,
    avatar: 44,
    testSuffix: 'rank-3',
  },
};

type Props = {
  /** İlk üç sıra (sıralı: 1., 2., 3.) */
  entries: PodiumLeaderRow[];
  resolvePlayer: (playerId: string) => { name: string; photoUri?: string | null } | undefined;
  formatValue: (value: number) => string;
};

/** Solda 2., ortada 1., sağda 3. — klasik podyum düzeni; aşırı büyük yazı ölçeğinde dikey listeye düşer */
export function LeaderboardPodium({ entries, resolvePlayer, formatValue }: Props) {
  const first = entries[0];
  const second = entries[1];
  const third = entries[2];
  const { fontScale, isHuge } = useFontScale();

  if (isHuge) {
    return (
      <View style={styles.stackedWrap}>
        <PodiumStackedRow
          medal="gold"
          row={first}
          resolvePlayer={resolvePlayer}
          formatValue={formatValue}
        />
        <PodiumStackedRow
          medal="silver"
          row={second}
          resolvePlayer={resolvePlayer}
          formatValue={formatValue}
        />
        <PodiumStackedRow
          medal="bronze"
          row={third}
          resolvePlayer={resolvePlayer}
          formatValue={formatValue}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <PodiumColumn
        medal="silver"
        row={second}
        resolvePlayer={resolvePlayer}
        formatValue={formatValue}
        fontScale={fontScale}
      />
      <PodiumColumn
        medal="gold"
        row={first}
        resolvePlayer={resolvePlayer}
        formatValue={formatValue}
        fontScale={fontScale}
      />
      <PodiumColumn
        medal="bronze"
        row={third}
        resolvePlayer={resolvePlayer}
        formatValue={formatValue}
        fontScale={fontScale}
      />
    </View>
  );
}

function PodiumColumn({
  medal,
  row,
  resolvePlayer,
  formatValue,
  fontScale,
}: {
  medal: Medal;
  row: PodiumLeaderRow | undefined;
  resolvePlayer: Props['resolvePlayer'];
  formatValue: Props['formatValue'];
  fontScale: number;
}) {
  const m = MEDAL_STYLES[medal];
  const p = row ? resolvePlayer(row.playerId) : undefined;
  const filled = !!(row && p);
  const label =
    medal === 'gold' ? '1' : medal === 'silver' ? '2' : '3';
  const a11y = filled
    ? `${label}. sıra, ${p!.name}, ${formatValue(row!.value)}`
    : `${label}. sıra, boş`;
  // Sabit minHeight, font ölçeği büyüdükçe metni kırptığı için ölçeğe göre büyütüyoruz.
  // 1.6 tavanı `App.tsx`'teki `maxFontSizeMultiplier` ile uyumludur.
  const scaledMinHeight = Math.round(m.minHeight * Math.min(Math.max(fontScale, 1), 1.6));

  return (
    <View style={styles.col} accessibilityLabel={a11y} testID={`leaderboard:podium:${m.testSuffix}`}>
      <View
        style={[
          styles.pedestal,
          {
            minHeight: scaledMinHeight,
            borderColor: filled ? m.border : colors.leaderboard.placeholderBorder,
            backgroundColor: filled ? m.surface : colors.leaderboard.placeholderSurface,
          },
          shadows.sm,
        ]}
      >
        <Text style={[styles.rankBadge, { color: m.accent }]}>{label}</Text>
        {filled ? (
          <>
            <PlayerAvatar name={p!.name} uri={p!.photoUri ?? undefined} size={m.avatar} />
            <Text style={styles.name} numberOfLines={2}>
              {p!.name}
            </Text>
            <Text style={[styles.val, { color: m.accent }]}>{formatValue(row!.value)}</Text>
          </>
        ) : (
          <>
            <View style={[styles.avatarPh, { width: m.avatar, height: m.avatar, borderRadius: m.avatar / 2 }]} />
            <Text style={styles.placeholderTxt}>—</Text>
            <Text style={styles.placeholderSub}>—</Text>
          </>
        )}
      </View>
    </View>
  );
}

/**
 * Aşırı büyük yazı ölçeğinde 3 sütun yatay düzen okunaksız kalır; bu yüzden
 * `useFontScale().isHuge` durumunda madalya rozetli dikey bir listeye geçeriz.
 */
function PodiumStackedRow({
  medal,
  row,
  resolvePlayer,
  formatValue,
}: {
  medal: Medal;
  row: PodiumLeaderRow | undefined;
  resolvePlayer: Props['resolvePlayer'];
  formatValue: Props['formatValue'];
}) {
  const m = MEDAL_STYLES[medal];
  const p = row ? resolvePlayer(row.playerId) : undefined;
  const filled = !!(row && p);
  const label = medal === 'gold' ? '1' : medal === 'silver' ? '2' : '3';
  const a11y = filled
    ? `${label}. sıra, ${p!.name}, ${formatValue(row!.value)}`
    : `${label}. sıra, boş`;

  return (
    <View
      style={[
        styles.stackedRow,
        {
          borderColor: filled ? m.border : colors.leaderboard.placeholderBorder,
          backgroundColor: filled ? m.surface : colors.leaderboard.placeholderSurface,
        },
        shadows.sm,
      ]}
      accessibilityLabel={a11y}
      testID={`leaderboard:podium:${m.testSuffix}`}
    >
      <View style={styles.stackedRank}>
        <Text style={[styles.rankBadge, { color: m.accent }]}>{label}</Text>
      </View>
      {filled ? (
        <>
          <PlayerAvatar name={p!.name} uri={p!.photoUri ?? undefined} size={m.avatar} />
          <View style={styles.stackedMeta}>
            <Text style={styles.name} numberOfLines={3}>
              {p!.name}
            </Text>
            <Text style={[styles.val, { color: m.accent }]}>{formatValue(row!.value)}</Text>
          </View>
        </>
      ) : (
        <>
          <View
            style={[styles.avatarPh, { width: m.avatar, height: m.avatar, borderRadius: m.avatar / 2 }]}
          />
          <View style={styles.stackedMeta}>
            <Text style={styles.placeholderTxt}>—</Text>
            <Text style={styles.placeholderSub}>—</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  stackedWrap: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  stackedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  stackedRank: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  col: {
    flex: 1,
    maxWidth: 120,
  },
  pedestal: {
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  rankBadge: {
    ...typography.title,
    fontFamily: 'Inter_900Black',
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  val: {
    ...typography.subtitle,
    fontFamily: 'Inter_700Bold',
  },
  avatarPh: {
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  placeholderTxt: {
    ...typography.caption,
    color: colors.textMuted,
  },
  placeholderSub: {
    ...typography.micro,
    color: colors.textMuted,
  },
});
