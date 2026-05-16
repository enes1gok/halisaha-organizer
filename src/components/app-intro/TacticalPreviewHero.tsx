import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getLineupFormationById, resolveSlotAnchor } from '../../data/lineupFormations';
import { radius, shadows, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';

type Props = {
  reduceMotion: boolean;
};

const FORMATION_ID = 'f14-231';
const TEAM_SLOTS = 7;

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 220,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    pitch: {
      width: '100%',
      maxWidth: 320,
      height: 200,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: t.colors.pitch.line,
      overflow: 'hidden',
      position: 'relative',
    },
    halfCircle: {
      position: 'absolute',
      alignSelf: 'center',
      bottom: 0,
      width: 120,
      height: 60,
      borderTopLeftRadius: 60,
      borderTopRightRadius: 60,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: t.colors.pitch.line,
      opacity: 0.7,
    },
    centerLine: {
      position: 'absolute',
      left: '50%',
      marginLeft: -0.5,
      top: '12%',
      bottom: '12%',
      width: 1,
      backgroundColor: t.colors.pitch.line,
      opacity: 0.6,
    },
    chip: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: 14,
      marginLeft: -14,
      marginBottom: -14,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
  }),
);

export function TacticalPreviewHero({ reduceMotion }: Props) {
  const styles = useStyles();
  const { colors: themeColors } = useTheme();
  const chipColors = [
    themeColors.position.GK,
    themeColors.position.DEF,
    themeColors.position.MID,
    themeColors.position.FWD,
    themeColors.position.DEF,
    themeColors.position.MID,
    themeColors.position.FWD,
  ];
  const formation = getLineupFormationById(FORMATION_ID);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, drift]);

  if (!formation) {
    return <View style={styles.wrap} />;
  }

  const slots = formation.slots.filter((s) => s.index < TEAM_SLOTS);

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Taktik saha önizlemesi">
      <LinearGradient
        colors={[themeColors.pitch.grassDeep, themeColors.pitch.grassMid, themeColors.pitch.grassLight]}
        style={[styles.pitch, shadows.md]}
      >
        <View style={styles.halfCircle} />
        <View style={styles.centerLine} />
        {slots.map((slot, i) => {
          const anchor = resolveSlotAnchor(slot, formation);
          return (
            <Chip
              key={slot.index}
              slotIndex={i}
              xNorm={anchor.xNorm}
              yNorm={anchor.yNorm}
              color={chipColors[i % chipColors.length]}
              drift={drift}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </LinearGradient>
    </View>
  );
}

function Chip({
  slotIndex,
  xNorm,
  yNorm,
  color,
  drift,
  reduceMotion,
}: {
  slotIndex: number;
  xNorm: number;
  yNorm: number;
  color: string;
  drift: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const styles = useStyles();
  const alt = slotIndex % 2 === 0 ? 1 : -1;
  const style = useAnimatedStyle(() => {
    const t = reduceMotion ? 0.5 : drift.value;
    const wobble = (t - 0.5) * 10 * alt;
    return {
      transform: [{ translateX: wobble }, { translateY: -wobble * 0.45 }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.chip,
        {
          left: `${xNorm * 100}%`,
          bottom: `${yNorm * 100}%`,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
