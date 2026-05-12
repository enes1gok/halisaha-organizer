import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { SkeletonBlock, SkeletonText } from '../../components/skeleton';
import type { RootTabParamList } from '../../navigation/types';
import { fetchPlayerLeaderboardStats } from '../../services/supabase/leaderboard';
import { spacing, typography } from '../../theme';
import { makeStyles, useThemeColors } from '../../theme/ThemeContext';

type Props = {
  userId: string;
  remoteUserId: string | null;
  refreshKey: number;
};

export function ProfileGlobalRankCard({ userId, remoteUserId, refreshKey }: Props) {
  const styles = useGlobalRankStyles();
  const themeColors = useThemeColors();
  const navigation = useNavigation();
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!remoteUserId) {
      setRank(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchPlayerLeaderboardStats('all', new Date().toISOString(), null, 'goals')
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort((a, b) => b.goals - a.goals);
        const idx = sorted.findIndex((r) => r.player_id === userId);
        setRank(idx >= 0 ? idx + 1 : null);
      })
      .catch(() => {
        if (cancelled) return;
        setRank(null);
      })
      .finally(() => {
        if (cancelled) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [remoteUserId, userId, refreshKey]);

  if (!remoteUserId) return null;

  const openGroups = () => {
    navigation
      .getParent<BottomTabNavigationProp<RootTabParamList>>()
      ?.navigate('GroupsTab');
  };

  return (
    <View style={styles.outer}>
      <Card variant="glass" style={styles.card}>
        <Text style={styles.title}>Genel gol sıralaması</Text>
        {loading ? (
          <View style={styles.skeletonRow}>
            <SkeletonText variant="body" width="62%" />
            <SkeletonBlock width={56} height={20} radius={6} />
          </View>
        ) : rank != null ? (
          <>
            <Text style={styles.rankLine}>
              Tüm oyuncular arasında{' '}
              <Text style={styles.rankNum}>#{rank}</Text>
            </Text>
            <Text style={styles.hint}>Grup bazlı tablolar için Gruplar sekmesine gidin.</Text>
          </>
        ) : (
          <Text style={styles.hint}>Sıralama verisi şu an gösterilemiyor.</Text>
        )}
        <Pressable
          onPress={openGroups}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Gruplar sekmesine git"
          testID="profile:stats:open-groups:press"
          hitSlop={4}
        >
          <Text style={styles.ctaTxt}>Gruplara git</Text>
          <Ionicons name="chevron-forward" size={18} color={themeColors.accent} />
        </Pressable>
      </Card>
    </View>
  );
}

const useGlobalRankStyles = makeStyles((t) =>
  StyleSheet.create({
    outer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    card: {
      gap: spacing.sm,
    },
    title: {
      ...typography.subtitle,
      color: t.colors.text,
    },
    rankLine: {
      ...typography.body,
      color: t.colors.textMuted,
    },
    rankNum: {
      ...typography.title,
      color: t.colors.accent,
      fontFamily: 'Inter_700Bold',
    },
    hint: {
      ...typography.caption,
      color: t.colors.textMuted,
    },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
    },
    ctaPressed: {
      opacity: 0.85,
    },
    ctaTxt: {
      ...typography.body,
      color: t.colors.accent,
      fontFamily: 'Inter_600SemiBold',
    },
  }),
);
