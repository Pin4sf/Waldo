import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';

interface HealthStatCardProps {
  label: string;
  value: number | string;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  context: string;
}

const TREND_META = {
  up:     { symbol: '↑', color: colors.zoneText.peak,     bg: colors.zone.peak },
  down:   { symbol: '↓', color: colors.zoneText.flagging, bg: colors.zone.flagging },
  stable: { symbol: '→', color: colors.textSecondary,     bg: colors.surfaceInset },
} as const;

export function HealthStatCard({ label, value, unit, trend, context }: HealthStatCardProps) {
  const meta = TREND_META[trend];
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <View style={[styles.trendPill, { backgroundColor: meta.bg }]}>
        <Text style={[styles.trendText, { color: meta.color }]}>
          {meta.symbol} {context}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  label:    { color: colors.textMuted, fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, marginBottom: spacing.xs },
  valueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, marginBottom: spacing.sm },
  value:    { color: colors.textPrimary, fontFamily: fonts.dmSansMedium, fontSize: fontSize.xl, lineHeight: 38 },
  unit:     { color: colors.textMuted, fontFamily: fonts.dmSans, fontSize: fontSize.sm },
  trendPill: { alignSelf: 'flex-start', borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  trendText: { fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs },
});
