/**
 * LoadCard — Day Strain / WHOOP-style Load card for mobile.
 * Matches Figma node 400:6097 (Load card, middle column).
 *
 * Compact: zone badge + "Load" + strain score + bar + yesterday comparison
 * Expanded: adds HR zone breakdown + "What is Load?" section
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { ZonePill } from './ZonePill';
import type { Zone } from '@/hooks/useWaldoData';

interface LoadCardProps {
  strain: number;       // 0-21 (WHOOP-style)
  strainLevel: string;  // 'rest', 'light', 'moderate', 'hard', 'all out'
  zone: Zone;
  avgStrain?: number;   // 7-day average for comparison
  peakHR?: number | null;
  exerciseMinutes?: number;
  activeMinutes?: number;
  lastRead?: string;
}

const ZONE_COLORS = ['#34D399', '#F97316', '#F59E0B', '#EF4444'];
const ZONE_LABELS = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4+'];

export function LoadCard({
  strain, strainLevel, zone, avgStrain, peakHR, exerciseMinutes = 0, activeMinutes = 0, lastRead,
}: LoadCardProps) {
  const [expanded, setExpanded] = useState(false);

  const strainPct = Math.min((strain / 21) * 100, 100);
  const strainColor = strain >= 15 ? '#EF4444' : strain >= 10 ? '#F59E0B' : strain >= 5 ? colors.accent : '#34D399';

  const summary = `Strain ${strain.toFixed(1)}/21 (${strainLevel} day).${peakHR ? ` Peak HR ${peakHR}.` : ''}${exerciseMinutes > 0 ? ` ${exerciseMinutes}min active.` : ''}`;

  if (!expanded) {
    return (
      <Pressable
        onPress={() => setExpanded(true)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.cardHeader}>
          <ZonePill zone={zone} />
        </View>

        <View style={styles.compactBody}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Load</Text>
            <Text style={styles.cardSummary}>{summary}</Text>
            <Text style={styles.cardMeta}>{lastRead ? `last read · ${lastRead}` : ''}</Text>
          </View>

          {/* Compact strain display */}
          <View style={styles.strainBadge}>
            <Text style={[styles.strainScore, { color: strainColor }]}>{strain.toFixed(1)}</Text>
            <Text style={styles.strainDenom}>/21</Text>
            {avgStrain !== undefined && (
              <Text style={styles.strainAvg}>avg {avgStrain.toFixed(0)}/21</Text>
            )}
          </View>
        </View>

        {/* Compact strain bar */}
        <View style={styles.strainTrackSmall}>
          <View style={[styles.strainFill, { width: `${strainPct}%` as any, backgroundColor: strainColor }]} />
        </View>
      </Pressable>
    );
  }

  // Expanded
  // Distribute exercise minutes across HR zones (approximation)
  const totalMins = Math.max(exerciseMinutes, activeMinutes, 1);
  const zone1 = Math.round(totalMins * 0.6);
  const zone2 = Math.round(totalMins * 0.25);
  const zone3 = Math.round(totalMins * 0.15);

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded(false)} hitSlop={12} style={styles.closeBtn}>
        <Text style={styles.closeTxt}>×</Text>
      </Pressable>

      <View style={styles.cardHeader}>
        <ZonePill zone={zone} />
      </View>

      {/* Score row */}
      <View style={styles.scoreRow}>
        <Text style={[styles.bigScore, { color: strainColor }]}>{strain.toFixed(1)}</Text>
        <Text style={styles.bigScoreDenom}>/21</Text>
        {avgStrain !== undefined && (
          <Text style={styles.avgLabel}> · avg {avgStrain.toFixed(0)}/21</Text>
        )}
      </View>

      <Text style={styles.expandedTitle}>Load</Text>
      <Text style={styles.expandedSummary}>{summary}</Text>

      {/* Strain bar */}
      <View style={styles.strainTrackLarge}>
        <View style={[styles.strainFill, { width: `${strainPct}%` as any, backgroundColor: strainColor }]} />
      </View>
      <View style={styles.strainLabels}>
        <Text style={styles.strainLabelL}>0</Text>
        <Text style={styles.strainLabelR}>21</Text>
      </View>

      {/* HR zone breakdown */}
      <View style={styles.hrZoneSection}>
        {[{ label: ZONE_LABELS[0], mins: zone1, color: ZONE_COLORS[0] },
          { label: ZONE_LABELS[1], mins: zone2, color: ZONE_COLORS[1] },
          { label: ZONE_LABELS[2], mins: zone3, color: ZONE_COLORS[2] }].map(z => (
          <View key={z.label} style={styles.zoneRow}>
            <View style={[styles.zoneColorDot, { backgroundColor: z.color ?? colors.accent }]} />
            <Text style={styles.zoneLabel}>{z.label}</Text>
            <View style={styles.zoneFlex}>
              <View style={styles.zoneTrack}>
                <View style={[styles.zoneFill, {
                  width: `${totalMins > 0 ? (z.mins / totalMins) * 100 : 0}%` as any,
                  backgroundColor: z.color ?? colors.accent,
                }]} />
              </View>
            </View>
            <Text style={styles.zoneMins}>{z.mins}m</Text>
          </View>
        ))}
      </View>

      {/* About */}
      <View style={styles.aboutBox}>
        <Text style={{ fontFamily: fonts.dmSansMedium, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 4 }}>About</Text>
        <Text style={styles.aboutTitle}>What is Load?</Text>
        <Text style={styles.aboutBody}>
          Load is how hard your body has worked today measured in time spent in each HR zone.{'\n\n'}
          High load means you moved hard and your heart worked for it. Make sure tonight's sleep is long — Waldo will check if your Form recovers by morning.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', marginBottom: spacing.xs },
  compactBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.corben, fontSize: 26, color: colors.textPrimary, lineHeight: 32, marginBottom: 4 },
  cardSummary: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },
  cardMeta: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' },
  strainBadge: { alignItems: 'center' },
  strainScore: { fontFamily: fonts.corben, fontSize: 32, lineHeight: 36 },
  strainDenom: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted },
  strainAvg: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  strainTrackSmall: { height: 4, backgroundColor: colors.trackColor, borderRadius: 2, marginTop: spacing.xs, overflow: 'hidden' },
  strainTrackLarge: { height: 8, backgroundColor: colors.trackColor, borderRadius: 4, marginTop: spacing.sm, overflow: 'hidden' },
  strainFill: { height: '100%', borderRadius: 4 },
  strainLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  strainLabelL: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted },
  strainLabelR: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted },
  closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 10, padding: 4 },
  closeTxt: { fontSize: 20, color: colors.textMuted, lineHeight: 24 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginBottom: 4 },
  bigScore: { fontFamily: fonts.corben, fontSize: 40, lineHeight: 46 },
  bigScoreDenom: { fontFamily: fonts.dmSans, fontSize: fontSize.md, color: colors.textMuted },
  avgLabel: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textMuted },
  expandedTitle: { fontFamily: fonts.corben, fontSize: 24, color: colors.textPrimary, marginBottom: 4 },
  expandedSummary: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },
  hrZoneSection: { marginTop: spacing.sm, gap: spacing.xs },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  zoneColorDot: { width: 8, height: 8, borderRadius: 4 },
  zoneLabel: { fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, color: colors.textPrimary, width: 50 },
  zoneFlex: { flex: 1 },
  zoneTrack: { height: 4, backgroundColor: colors.trackColor, borderRadius: 2, overflow: 'hidden' },
  zoneFill: { height: '100%', borderRadius: 2 },
  zoneMins: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, width: 30, textAlign: 'right' },
  aboutBox: { marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md },
  aboutTitle: { fontFamily: fonts.corben, fontSize: fontSize.lg, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
  aboutBody: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 20 },
});
