import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../components/Card';
import { getTabBarListPaddingBottom } from '../navigation/tabBarLayout';
import { OPEN_SOURCE_LICENSES_SUMMARY } from '../legal/openSourceLicensesBundled';
import { spacing, typography } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

export function LicensesScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: getTabBarListPaddingBottom(insets.bottom) }]}
    >
      <Card>
        <Text style={styles.title}>Açık kaynak yazılımlar</Text>
        <Text style={styles.body}>{OPEN_SOURCE_LICENSES_SUMMARY}</Text>
      </Card>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: spacing.md,
      gap: spacing.md,
    },
    title: {
      ...typography.subtitle,
      color: t.colors.text,
      marginBottom: spacing.sm,
    },
    body: {
      ...typography.caption,
      color: t.colors.textMuted,
      lineHeight: 20,
    },
  }),
);
