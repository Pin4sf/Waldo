/**
 * CRS Gauge — SVG arc displaying the Nap Score (0-100).
 *
 * Visual design: semi-circular arc with zone colour, score in center,
 * "Nap Score" label below. Matches Waldo brand palette.
 */

import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

interface CrsGaugeProps {
  score: number;        // 0-100, or -1 for insufficient
  zone: 'peak' | 'moderate' | 'low' | null;
  size?: number;
}

const ZONE_COLORS = {
  peak: '#22C55E',      // green
  moderate: '#F97316',  // orange
  low: '#EF4444',       // red
  null: '#E5E5E3',      // grey (loading/insufficient)
};

const ZONE_LABELS = {
  peak: 'Peak',
  moderate: 'Moderate',
  low: 'Low',
  null: '—',
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function CrsGauge({ score, zone, size = 220 }: CrsGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.07;

  // Arc spans from -135° to +135° (270° total)
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;

  // Score fill (0-100 → 0-270°)
  const fillAngle = score >= 0 ? startAngle + (score / 100) * totalAngle : startAngle;

  const bgPath = arcPath(cx, cy, r, startAngle, endAngle);
  const fillPath = score >= 0 && score > 0 ? arcPath(cx, cy, r, startAngle, fillAngle) : null;

  const color = ZONE_COLORS[zone ?? 'null'];
  const displayScore = score >= 0 ? String(score) : '—';
  const zoneLabel = ZONE_LABELS[zone ?? 'null'];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Path
          d={bgPath}
          stroke="#E5E5E3"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Score fill */}
        {fillPath && (
          <Path
            d={fillPath}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Score number */}
        <SvgText
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill={score >= 0 ? color : '#9CA3AF'}
          fontFamily="DMSans"
        >
          {displayScore}
        </SvgText>

        {/* "Nap Score" label */}
        <SvgText
          x={cx}
          y={cy + size * 0.10}
          textAnchor="middle"
          fontSize={size * 0.07}
          fill="#737373"
          fontFamily="DMSans"
        >
          Nap Score
        </SvgText>

        {/* Zone label */}
        <SvgText
          x={cx}
          y={cy + size * 0.19}
          textAnchor="middle"
          fontSize={size * 0.065}
          fontWeight="600"
          fill={color}
          fontFamily="DMSans"
        >
          {zoneLabel}
        </SvgText>
      </Svg>
    </View>
  );
}
