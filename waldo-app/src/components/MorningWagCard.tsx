import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing, borderRadius, getZoneFromScore, getZoneTone } from '@/theme';
import { InteractiveCard } from './ui/InteractiveCard';

interface MorningWagCardProps {
  message: string;
  time: string;
  score: number;
  onPress?: () => void;
}

const ZONE_SUMMARIES = {
  peak:     'Ready for the hard thing.',
  steady:   'A solid start.',
  flagging: 'A protective start.',
  depleted: 'A gentler day.',
} as const;

export function MorningWagCard({ message, time, score, onPress }: MorningWagCardProps) {
  const zone     = getZoneFromScore(score);
  const zoneTone = getZoneTone(zone);

  return (
    <InteractiveCard onPress={onPress} style={[styles.card, { backgroundColor: colors.surfaceRaised }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Morning Wag</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      <Text style={[styles.summary, { color: zoneTone.text }]}>
        {ZONE_SUMMARIES[zone]}
      </Text>
      <Text style={styles.message}>{message}</Text>
    </InteractiveCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  eyebrow: { color: colors.textMuted, fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm },
  time:    { color: colors.textMuted, fontFamily: fonts.dmSans, fontSize: fontSize.sm },
  summary: { fontFamily: fonts.corben, fontSize: fontSize.lg, lineHeight: 30, marginBottom: spacing.sm },
  message: { color: colors.textSecondary, fontFamily: fonts.dmSans, fontSize: fontSize.md, lineHeight: 28 },
});
