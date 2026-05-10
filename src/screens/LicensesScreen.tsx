import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Card } from '../components/Card';
import { TAB_BAR_LIST_PADDING_BOTTOM } from '../navigation/tabBarLayout';
import { OPEN_SOURCE_LICENSES_SUMMARY } from '../legal/openSourceLicensesBundled';
import { colors, spacing, typography } from '../theme';

export function LicensesScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>Açık kaynak yazılımlar</Text>
        <Text style={styles.body}>{OPEN_SOURCE_LICENSES_SUMMARY}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: TAB_BAR_LIST_PADDING_BOTTOM,
    gap: spacing.md,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
