import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../theme';

type Props = {
  count: number;
  renderItem: (index: number) => React.ReactNode;
  itemGap?: number;
};

export function SkeletonList({ count, renderItem, itemGap = spacing.sm }: Props) {
  return (
    <View style={[styles.wrap, { gap: itemGap }]}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index}>{renderItem(index)}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
