/**
 * SleepStagesCard — Sleep stages hypnogram card for mobile.
 * Matches Figma node 400:6097 (Sleep stages card, right column).
 *
 * Shows: zone badge + title + narrative + bedtime→wake times + hypnogram SVG
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Text as SvgText, Line } from 'react-native-svg';
import { colors, fonts, fontSize, spacing, borderRadius } from '@/theme';
import { ZonePill } from './ZonePill';
import type { Zone } from '@/hooks/useWaldoData';

interface SleepStages {
  core: number;   // 0-1 fraction
  deep: number;
  rem: number;
  awake: number;
}

interface SleepStagesCardProps {
  zone: Zone;
  durationHours: number;
  stages: SleepStages;
  bedtime?: string;   // ISO or "11:23pm"
  wakeTime?: string;
  summary?: string;
  sleepScore?: number;
  lastRead?: string;
}

const STAGE_CONFIG = [
  { key: 'awake', label: 'awake', bg: 'rgba(255,47,0,0.08)',  line: '#ff7c25' },
  { key: 'rem',   label: 'REM',   bg: 'rgba(59,249,211,0.08)', line: '#07bea6' },
  { key: 'core',  label: 'core',  bg: 'rgba(243,107,239,0.08)', line: '#ff60fa' },
  { key: 'deep',  label: 'deep',  bg: 'rgba(25,117,255,0.08)', line: '#3485ff' },
];

function formatSleepTime(raw: string): string {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase().replace(':00', '');
  } catch { return raw; }
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function buildHypnogram(stages: SleepStages, width: number, height: number): string {
  const stageY: Record<string, number> = {
    awake: height * 0.14,
    rem:   height * 0.36,
    core:  height * 0.61,
    deep:  height * 0.86,
  };
  const total = stages.awake + stages.rem + stages.core + stages.deep || 1;
  const segs = 20;
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = t * width;
    const cyclePos = (t * 4) % 1;
    let stage: string;

    if (t < 0.04 || t > 0.96) stage = 'awake';
    else if (cyclePos < 0.12) stage = 'core';
    else if (cyclePos < 0.30) stage = t < 0.5 ? 'deep' : 'core';
    else if (cyclePos < 0.50) stage = 'core';
    else if (cyclePos < 0.72) stage = 'rem';
    else stage = Math.random() < 0.12 ? 'awake' : 'core';

    const rand = Math.random();
    if (rand < stages.awake / total * 0.3) stage = 'awake';
    if (rand < stages.deep / total * 0.4) stage = 'deep';
    pts.push({ x, y: stageY[stage]! });
  }

  let path = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    path += ` H ${pts[i]!.x} V ${pts[i]!.y}`;
  }
  return path;
}

export function SleepStagesCard({
  zone, durationHours, stages, bedtime, wakeTime, summary, sleepScore,
}: SleepStagesCardProps) {
  const [expanded, setExpanded] = useState(false);

  const durationStr = formatDuration(durationHours);
  const bedtimeStr  = formatSleepTime(bedtime ?? '');
  const wakeStr     = formatSleepTime(wakeTime ?? '');
  const narrative   = summary ?? `${durationStr} total sleep.`;
  const cleanNarrative = narrative.replace(/Nap Score/gi, 'Form');

  const chartW = 180, chartH = 80;
  const bandH  = chartH / 4;
  const hypnogram = buildHypnogram(stages, chartW, chartH);

  const compactHypno = (
    <View style={styles.hypnoWrap}>
      <Svg width={chartW + 24} height={chartH + 16}>
        {STAGE_CONFIG.map((band, i) => (
          <Rect key={band.key} x={0} y={i * bandH} width={chartW} height={bandH} fill={band.bg} />
        ))}
        <Path
          d={hypnogram}
          fill="none"
          stroke={colors.textPrimary}
          strokeWidth={1.5}
          opacity={0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Time labels */}
        <SvgText x={0} y={chartH + 12} fill={colors.textMuted} fontSize={8} fontFamily="DMSans">
          {bedtimeStr || '11pm'}
        </SvgText>
        <SvgText x={chartW} y={chartH + 12} textAnchor="end" fill={colors.textMuted} fontSize={8} fontFamily="DMSans">
          {wakeStr || '7am'}
        </SvgText>
      </Svg>
    </View>
  );

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
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={styles.cardTitle}>Sleep stages</Text>
            <Text style={styles.cardSummary} numberOfLines={2}>{cleanNarrative}</Text>
            <Text style={styles.cardMeta}>Last night · {durationStr} total</Text>
          </View>
          {compactHypno}
        </View>
      </Pressable>
    );
  }

  // Expanded
  const stageRows = [
    { key: 'deep',  label: 'Deep',  pct: Math.round(stages.deep  * 100), color: '#3485ff' },
    { key: 'rem',   label: 'REM',   pct: Math.round(stages.rem   * 100), color: '#07bea6' },
    { key: 'core',  label: 'Core',  pct: Math.round(stages.core  * 100), color: '#ff60fa' },
    { key: 'awake', label: 'Awake', pct: Math.round(stages.awake * 100), color: '#ff7c25' },
  ];

  return (
    <View style={styles.card}>
      <Pressable onPress={() => setExpanded(false)} hitSlop={12} style={styles.closeBtn}>
        <Text style={styles.closeTxt}>×</Text>
      </Pressable>

      <View style={styles.cardHeader}>
        <ZonePill zone={zone} />
        {sleepScore !== undefined && (
          <Text style={[styles.cardMeta, { marginLeft: 8 }]}>Sleep score: {sleepScore}</Text>
        )}
      </View>

      <Text style={styles.expandedTitle}>Sleep stages</Text>
      <Text style={styles.expandedSummary}>{cleanNarrative}</Text>
      <Text style={styles.cardMeta}>Last night · {durationStr} total</Text>

      {/* Full hypnogram */}
      <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
        <Svg width={chartW + 28} height={chartH + 24}>
          {STAGE_CONFIG.map((band, i) => (
            <Rect key={band.key} x={14} y={i * bandH} width={chartW} height={bandH} fill={band.bg} />
          ))}
          {STAGE_CONFIG.map((band, i) => (
            <SvgText key={`lbl-${band.key}`} x={chartW / 2 + 14} y={i * bandH + bandH / 2 + 4}
              textAnchor="middle" fill={colors.textMuted} fontSize={7} fontFamily="DMSans">
              {band.label}
            </SvgText>
          ))}
          <Line x1={14} y1={0} x2={14} y2={chartH} stroke={colors.border} strokeWidth={0.8} />
          <Line x1={chartW + 14} y1={0} x2={chartW + 14} y2={chartH} stroke={colors.border} strokeWidth={0.8} />
          <Path
            d={`M ${hypnogram.slice(2)}`}
            fill="none" stroke={colors.textPrimary} strokeWidth={1.5}
            opacity={0.55} strokeLinecap="round" strokeLinejoin="round"
            transform="translate(14, 0)"
          />
          <SvgText x={14} y={chartH + 14} fill={colors.textMuted} fontSize={8} fontFamily="DMSans">
            {bedtimeStr || '11pm'}
          </SvgText>
          <SvgText x={chartW + 14} y={chartH + 14} textAnchor="end" fill={colors.textMuted} fontSize={8} fontFamily="DMSans">
            {wakeStr || '7am'}
          </SvgText>
        </Svg>
      </View>

      {/* Stage breakdown bars */}
      <View style={styles.stageBreakdown}>
        {stageRows.map(s => (
          <View key={s.key} style={styles.stageRow}>
            <View style={[styles.stageDot, { backgroundColor: s.color }]} />
            <Text style={styles.stageName}>{s.label}</Text>
            <View style={styles.stageBarTrack}>
              <View style={[styles.stageBarFill, { width: `${s.pct}%` as any, backgroundColor: s.color }]} />
            </View>
            <Text style={styles.stagePct}>{s.pct}%</Text>
          </View>
        ))}
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
  compactBody: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.corben, fontSize: 26, color: colors.textPrimary, lineHeight: 32, marginBottom: 4 },
  cardSummary: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },
  cardMeta: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' },
  hypnoWrap: { alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 10, padding: 4 },
  closeTxt: { fontSize: 20, color: colors.textMuted, lineHeight: 24 },
  expandedTitle: { fontFamily: fonts.corben, fontSize: 24, color: colors.textPrimary, marginBottom: 4 },
  expandedSummary: { fontFamily: fonts.dmSans, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22, marginBottom: 4 },
  stageBreakdown: { marginTop: spacing.sm, gap: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  stageName: { fontFamily: fonts.dmSansMedium, fontSize: fontSize.xs, color: colors.textPrimary, width: 40 },
  stageBarTrack: { flex: 1, height: 4, backgroundColor: colors.trackColor, borderRadius: 2, overflow: 'hidden' },
  stageBarFill: { height: '100%', borderRadius: 2 },
  stagePct: { fontFamily: fonts.dmSans, fontSize: fontSize.xs, color: colors.textMuted, width: 32, textAlign: 'right' },
});
