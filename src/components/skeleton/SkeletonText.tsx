import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { typography } from '../../theme';
import { SkeletonBlock } from './SkeletonBlock';

type Variant = 'title' | 'subtitle' | 'body' | 'caption' | 'micro';

type Props = {
  variant?: Variant;
  width?: ViewStyle['width'];
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
};

const heights: Record<Variant, number> = {
  title: typography.title.fontSize,
  subtitle: typography.subtitle.fontSize,
  body: typography.body.fontSize,
  caption: typography.caption.fontSize,
  micro: typography.micro.fontSize,
};

export function SkeletonText({ variant = 'body', width = '100%', style, animated }: Props) {
  return (
    <SkeletonBlock width={width} height={heights[variant]} radius={6} style={style} animated={animated} />
  );
}
