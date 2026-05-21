import React from 'react';
import { StyleSheet, View } from 'react-native';
import { makeStyles } from '../theme/ThemeContext';

type Props = {
  team: 'A' | 'B';
  size?: number;
};

export function TeamColorDot({ team, size = 16 }: Props) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: team === 'A' ? '#111111' : '#FFFFFF',
        },
      ]}
    />
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    dot: {
      borderWidth: 2,
      borderColor: t.colors.accent,
    },
  }),
);
