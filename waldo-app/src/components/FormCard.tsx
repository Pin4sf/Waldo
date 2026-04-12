/**
 * FormCard — Figma-matching Form (CRS) card for mobile.
 *
 * Compact: zone badge + title + summary + NapScoreGauge
 * Expanded: gauge + component bars (Sleep/HRV/Circadian/Motion) + CRS day chart + About
 *
 * Matches Figma node 400:6097 (Form card design).
 */
import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { ZonePill } from './ZonePill';
import type { Zone } from '@/hooks/useWaldoData';

interface ComponentScore {
  score: number;
  label: string;
  weight: string;
}

interface FormCardProps {
  score: number;
  zone: Zone;
  summary: string;
  components?: { sleep: number; hrv: number; circadian: number; activity: number } | null;
  lastRead?: string;
  pillarDrag?: string | null;
}

function componentStatus(score: number): string {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'on track';
  if (score >= 50) return 'dipping';
  return 'low';
}

function ComponentBar({ label, score, weight }: ComponentScore) {
  const fillColor = score >= 80 ? '#34D399' : score >= 60 ? colors.accent : '#EF4444';
  const status = componentStatus(score);
  return (
    <View style={styles.compRow}>
      <View style={styles.compLabelCol}>
        <Text style={styles.compName}>{label}</Text>
        <Text style={[styles.compStatus, { color: fillColor }]}>{status}</Text>
      </View>
      <View style={styles.compValueCol}>
        <Text style={styles.compScore}>{score}</Text>
        <View style={styles.compTrack}>
          <View style={[styles.compFill, { width: `${Math.min(score, 100)}%` as any, backgroundColor: fillColor }]} />
        </View>
      </View>
      <Text style={styles.compWeight}>{weight}</Text>
    </View>
  );
}

/** Mini arc gauge — compact version for the card header */
function MiniGauge({ score, zone }: { score: number; zone: Zone }) {
  const size = 80;
  const cx = size / 2, cy = size / 2;
  const r = 28;
  const startAngle = -130, totalAngle = 260;
  const fillAngle = score >= 0 ? startAngle + (score / 100) * totalAngle : startAngle;

  const polar = (a: number) => ({
    x: cx + r * Math.cos(((a - 90) * Math.PI) / 180),
    y: cy + r * Math.sin(((a - 90) * Math.PI) / 180),
  });

  const arcD = (start: number, end: number) => {
    const s = polar(end), e = polar(start);
    const large = end - start <= 180 ? '0' : '1';
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
  };

  const zoneColor = zone === 'peak' ? '#34D399' : zone === 'steady' ? colors.accent : zone === 'flagging' ? '#F59E0B' : '#9CA3AF';

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Path d={arcD(startAngle, startAngle + totalAngle)} stroke={colors.trackColor} strokeWidth={5} fill="none" strokeLinecap="round" />
        {score >= 0 && <Path d={arcD(startAngle, fillAngle)} stroke={zoneColor} strokeWidth={5} fill="none" strokeLinecap="round" />}
        {/* Center score */}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: fonts.corben, fontSize: 22, color: colors.textPrimary, lineHeight: 26 }}>{score >= 0 ? score : '—'}</Text>
      </View>
    </View>
  );
}

const DRAG_LABEL: Record<string, string> = {
  sleep: 'sleep dragging',
  hrv: 'HRV dragging',
  circadian: 'body clock dragging',
  activity: 'low activity dragging',
};

export function FormCard({ score, zone, summary, components, lastRead, pillarDrag }: FormCardProps) {
  const [expanded, setExpanded] = useState(false);

  const zoneLabel = zone === 'peak' ? 'Peak' : zone === 'steady' ? 'Steady' : zone === 'flagging' ? 'Flagging' : 'Depleted';
  const cleanSummary = summary.replace(/Nap Score/gi, 'Form').replace(/nap score/gi, 'Form');

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
            <Text style={styles.cardTitle}>Form</Text>
            <Text style={styles.cardSummary} numberOfLines={3}>{cleanSummary}</Text>
            <Text style={styles.cardMeta}>
              {lastRead ? `last read · ${lastRead}` : ''}
              {pillarDrag && score < 75 ? `  ·  ${DRAG_LABEL[pillarDrag] ?? pillarDrag}` : ''}
            </Text>
          </View>
          <MiniGauge score={score} zone={zone} />
        </View>
      </Pressable>
    );
  }

  // Expanded
  const comps: ComponentScore[] = components ? [
    { score: components.sleep,     label: 'Sleep',     weight: '35%' },
    { score: components.hrv,       label: 'HRV',       weight: '25%' },
    { score: components.circadian, label: 'Circadian', weight: '25%' },
    { score: components.activity,  label: 'Motion',    weight: '15%' },
  ] : [];

  return (
    <View style={styles.card}>
      {/* Close */}
      <Pressable onPress={() => setExpanded(false)} hitSlop={12} style={styles.closeBtn}>
        <Text style={styles.closeTxt}>×</Text>
      </Pressable>

      <View style={styles.cardHeader}>
        <ZonePill zone={zone} />
      </View>

      {/* Large gauge */}
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <MiniGauge score={score} zone={zone} />
      </View>

      <Text style={styles.expandedTitle}>Form</Text>
      <Text style={styles.expandedSummary}>{cleanSummary}</Text>
      {lastRead && <Text style={styles.cardMeta}>updated at {lastRead}</Text>}

      {/* Component bars */}
      {comps.length > 0 && (
        <View style={styles.compSection}>
          {comps.map(c => <ComponentBar key={c.label} {...c} />)}
        </View>
      )}

      {/* Insight */}
      <View style={styles.insightBox}>
        <Text style={styles.insightText}>
          {score >= 80
            ? 'Peak window right now. Your hardest thinking goes here.'
            : score >= 65
            ? 'Solid baseline. Watch cognitive load after 2pm.'
            : score >= 50
            ? 'Running a bit low. Protect your focus blocks.'
            : 'Rough day biologically. Defer heavy decisions where possible.'}
        </Text>
      </View>

      {/* About */}
      <View style={styles.aboutBox}>
        <Text style={{ fontFamily: fonts.dmSansMedium, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, marginBottom: 4 }}>About</Text>
        <Text style={styles.aboutTitle}>What is Form?</Text>
        <Text style={styles.aboutBody}>
          Form is the single number that tells you how sharp your brain is right now.
          Not how healthy you are. How ready you are, today, for things that require actual thinking.{'\n\n'}
          It's built from four signals — sleep quality, HRV, your body clock, and
          yesterday's movement. 80 and above is a day to do your hardest work. Below 50, protect your energy.
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  compactBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fonts.corben, fontSize: 26, color: colors.textPrimary, lineHeight: 32, marginBottom: 4 },
  cardSummary: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },
  cardMeta: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' },
  closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 10, padding: 4 },
  closeTxt: { fontSize: 20, color: colors.textMuted, lineHeight: 24 },
  expandedTitle: { fontFamily: fonts.corben, fontSize: 28, color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.xs },
  expandedSummary: { fontFamily: fonts.dmSans, fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  compSection: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  compRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.xs },
  compLabelCol: { width: 80 },
  compName: { fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm, color: colors.textPrimary },
  compStatus: { fontFamily: fonts.dmSans, fontSize: fontSize.xs },
  compValueCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  compScore: { fontFamily: fonts.corben, fontSize: fontSize.md, color: colors.textPrimary, width: 28 },
  compTrack: { flex: 1, height: 4, backgroundColor: colors.trackColor, borderRadius: 2, overflow: 'hidden' },
  compFill: { height: '100%', borderRadius: 2 },
  compWeight: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, width: 30, textAlign: 'right' },
  insightBox: { marginTop: spacing.sm, backgroundColor: colors.surfaceRaised, borderRadius: borderRadius.lg, padding: spacing.md },
  insightText: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  aboutBox: { marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md },
  aboutTitle: { fontFamily: fonts.corben, fontSize: fontSize.lg, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
  aboutBody: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 20 },
});
