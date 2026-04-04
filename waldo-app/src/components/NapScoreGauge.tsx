import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fonts, fontSize, getZoneFromScore, getZoneTone } from '@/theme';
import { ZonePill } from './ZonePill';
import { AnimatedNumber } from './ui/AnimatedNumber';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface NapScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { radius: 40,  stroke: 8,  scoreFontSize: 32 },
  md: { radius: 62,  stroke: 10, scoreFontSize: 48 },
  lg: { radius: 92,  stroke: 12, scoreFontSize: 72 },
} as const;

const SWEEP_DEG = 220;
const START_DEG = 160;
const END_DEG   = START_DEG + SWEEP_DEG;

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polarToCartesian(cx, cy, r, end);
  const e = polarToCartesian(cx, cy, r, start);
  const large = end - start <= 180 ? '0' : '1';
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export function NapScoreGauge({ score, size = 'lg' }: NapScoreGaugeProps) {
  const cfg      = SIZE_MAP[size];
  const svgSize  = cfg.radius * 2 + cfg.stroke * 2;
  const cx       = svgSize / 2;
  const cy       = svgSize / 2;
  const arcLen   = (SWEEP_DEG / 360) * 2 * Math.PI * cfg.radius;
  const trackPath = describeArc(cx, cy, cfg.radius, START_DEG, END_DEG);

  const animScore = useSharedValue(0);
  const zone      = getZoneFromScore(score);
  const zoneTone  = getZoneTone(zone);

  useEffect(() => {
    animScore.value = withSpring(score, { mass: 1, damping: 18, stiffness: 120 });
  }, [animScore, score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen - (arcLen * animScore.value) / 100,
  }));

  return (
    <View style={styles.container}>
      <View style={{ width: svgSize, height: svgSize }}>
        <Svg width={svgSize} height={svgSize}>
          {/* Track (background arc) */}
          <Path
            d={trackPath}
            stroke={colors.trackColor}
            strokeWidth={cfg.stroke}
            fill="none"
            strokeLinecap="round"
          />
          {/* Progress arc (animated) */}
          <AnimatedPath
            d={trackPath}
            stroke={colors.accent}
            strokeWidth={cfg.stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${arcLen}`}
            animatedProps={animatedProps}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <AnimatedNumber
            value={score}
            style={{ fontSize: cfg.scoreFontSize, color: colors.textPrimary, fontFamily: fonts.corben }}
          />
        </View>
      </View>

      <Text style={styles.label}>Nap Score</Text>
      <Text style={[styles.zoneCopy, { color: zoneTone.text }]}>
        {zone === 'peak' ? 'Ready for the hard thing.' : zone === 'steady' ? 'A solid start.' : zone === 'flagging' ? 'A protective start.' : 'A gentler day.'}
      </Text>
      <View style={styles.pillWrapper}>
        <ZonePill zone={zone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { alignItems: 'center', paddingVertical: 16 },
  center:      { alignItems: 'center', justifyContent: 'center' },
  label:       { marginTop: 8, color: colors.textMuted, fontFamily: fonts.dmSansMedium, fontSize: fontSize.sm },
  zoneCopy:    { marginTop: 4, fontFamily: fonts.dmSans, fontSize: fontSize.sm },
  pillWrapper: { marginTop: 10 },
});
