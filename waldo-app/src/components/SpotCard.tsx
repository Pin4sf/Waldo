import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { InteractiveCard } from './ui/InteractiveCard';

interface SpotCardProps {
  title: string;
  body: string;
  type: 'insight' | 'alert' | 'behaviour';
  date: string;
  onPress?: () => void;
}

const TYPE_STYLES = {
  insight:   { backgroundColor: colors.zone.steady,   label: 'Pattern',     textColor: colors.zoneText.steady },
  alert:     { backgroundColor: colors.zone.flagging,  label: 'Fetch alert', textColor: colors.zoneText.flagging },
  behaviour: { backgroundColor: colors.surfaceInset,   label: 'A Spot',      textColor: colors.textPrimary },
} as const;

export function SpotCard({ title, body, type, date, onPress }: SpotCardProps) {
  const style = TYPE_STYLES[type];
  return (
    <InteractiveCard onPress={onPress} style={[styles.card, { backgroundColor: style.backgroundColor }]}>
      <Text style={[styles.badge, { color: style.textColor }]}>{style.label}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body} numberOfLines={4}>{body}</Text>
      <Text style={styles.date}>{date}</Text>
    </InteractiveCard>
  );
}

const styles = StyleSheet.create({
  card:  { borderRadius: borderRadius.xl, marginRight: spacing.sm, minHeight: 220, padding: spacing.lg, width: 292 },
  badge: { fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontFamily: fonts.corben, fontSize: fontSize.lg, lineHeight: 30, marginBottom: spacing.sm },
  body:  { color: colors.textSecondary, flex: 1, fontFamily: fonts.dmSans, fontSize: fontSize.md, lineHeight: 26 },
  date:  { color: colors.textMuted, fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm, marginTop: spacing.md },
});
