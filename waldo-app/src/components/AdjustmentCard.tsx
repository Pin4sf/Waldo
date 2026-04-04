import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { InteractiveCard } from './ui/InteractiveCard';

interface AdjustmentCardProps {
  action: string;
  reason: string;
  undoable?: boolean;
}

export function AdjustmentCard({ action, reason, undoable = false }: AdjustmentCardProps) {
  return (
    <InteractiveCard style={styles.card} scaleAmount={0.99}>
      <Text style={styles.eyebrow}>The Adjustment</Text>
      <Text style={styles.action}>{action}</Text>
      <Text style={styles.reason}>{reason}</Text>
      {undoable && (
        <InteractiveCard style={styles.undoButton} scaleAmount={0.94}>
          <Text style={styles.undoText}>Undo</Text>
        </InteractiveCard>
      )}
    </InteractiveCard>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised, borderColor: colors.border,
    borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md,
  },
  eyebrow: { color: colors.textMuted, fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, marginBottom: spacing.xs },
  action:  { color: colors.textPrimary, fontFamily: fonts.corben, fontSize: fontSize.lg, lineHeight: 30, marginBottom: spacing.xs },
  reason:  { color: colors.textSecondary, fontFamily: fonts.dmSans, fontSize: fontSize.md, lineHeight: 26, marginBottom: spacing.md },
  undoButton: {
    alignSelf: 'flex-start', backgroundColor: colors.surfaceInset,
    borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  undoText: { color: colors.textPrimary, fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm },
});
