/**
 * RadialGauge — 24-spoke circular CRS/Form visualization
 *
 * Matches Figma: spokes radiate from center, colored by zone,
 * length varies by energy estimate per hour, gray for no-data/future.
 * Score displayed in center.
 */

interface RadialGaugeProps {
  score: number;
  zone: 'peak' | 'moderate' | 'low' | 'nodata';
  /** Optional per-hour energy values (0-1), indices 0-23 for midnight-11pm */
  hourlyEnergy?: number[];
  size?: number;
  compact?: boolean;
  /** Show time labels (6pm, 12am, 6am, 12pm) — shown by default when size >= 180 */
  showLabels?: boolean;
}

const ZONE_COLORS: Record<string, string> = {
  peak: '#34D399',
  moderate: '#7C6BF0', // purple-blue for steady
  low: '#F97316',
  nodata: '#9A9A96',
};

/** Generate a plausible energy curve from CRS + sleep data */
function defaultEnergyCurve(score: number): number[] {
  const normalized = Math.max(0.2, score / 100);
  return Array.from({ length: 24 }, (_, h) => {
    const circadianWave = 0.5 + 0.5 * Math.sin(((h - 4) / 24) * Math.PI * 2);
    const afternoonDip = h >= 12 && h <= 14 ? 0.12 : 0;
    const eveningFade = h >= 18 ? (h - 18) * 0.035 : 0;
    const overnightFloor = h < 6 || h > 22 ? 0.18 : 0;
    const base = overnightFloor || (0.24 + circadianWave * 0.48 + normalized * 0.18 - afternoonDip - eveningFade);
    return Math.max(0.12, Math.min(1, parseFloat(base.toFixed(3))));
  });
}

export function RadialGauge({ score, zone, hourlyEnergy, size = 200, compact = false, showLabels }: RadialGaugeProps) {
  const shouldShowLabels = showLabels ?? size >= 180;
  const energy = hourlyEnergy ?? defaultEnergyCurve(score);
  const cx = size / 2;
  const cy = size / 2;
  const innerRadius = size * 0.22;
  const maxSpokeLen = size * 0.28;
  const minSpokeLen = size * 0.06;
  const spokeColor = ZONE_COLORS[zone] ?? ZONE_COLORS.nodata;
  const grayColor = '#D4D4D0';

  const now = new Date();
  const currentHour = now.getHours();

  const spokes = energy.map((e, hour) => {
    const angleDeg = (hour / 24) * 360 - 90; // 0h at top (12 o'clock)
    const angleRad = (angleDeg * Math.PI) / 180;
    const spokeLen = minSpokeLen + e * (maxSpokeLen - minSpokeLen);
    const isFuture = hour > currentHour;

    const x1 = cx + Math.cos(angleRad) * (innerRadius + 4);
    const y1 = cy + Math.sin(angleRad) * (innerRadius + 4);
    const x2 = cx + Math.cos(angleRad) * (innerRadius + spokeLen);
    const y2 = cy + Math.sin(angleRad) * (innerRadius + spokeLen);

    return (
      <line
        key={hour}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={isFuture ? grayColor : spokeColor}
        strokeWidth={size * 0.022}
        strokeLinecap="round"
        opacity={isFuture ? 0.4 : 0.85 + e * 0.15}
      />
    );
  });

  // Sub-ticks between spokes for richer visual
  const subticks = energy.map((e, hour) => {
    const nextE = energy[(hour + 1) % 24] ?? e;
    const midE = (e + nextE) / 2;
    const angleDeg = ((hour + 0.5) / 24) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const spokeLen = minSpokeLen + midE * (maxSpokeLen - minSpokeLen) * 0.5;
    const isFuture = hour >= currentHour;

    const x1 = cx + Math.cos(angleRad) * (innerRadius + 6);
    const y1 = cy + Math.sin(angleRad) * (innerRadius + 6);
    const x2 = cx + Math.cos(angleRad) * (innerRadius + spokeLen);
    const y2 = cy + Math.sin(angleRad) * (innerRadius + spokeLen);

    return (
      <line
        key={`sub-${hour}`}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={isFuture ? grayColor : spokeColor}
        strokeWidth={size * 0.012}
        strokeLinecap="round"
        opacity={isFuture ? 0.25 : 0.5}
      />
    );
  });

  const labelRadius = size * 0.47;
  const fontSize = size < 180 ? 8 : 12;

  const timeLabels = !shouldShowLabels ? [] : [
    { label: '12am', hour: 0 },
    { label: '6am', hour: 6 },
    { label: '12pm', hour: 12 },
    { label: '6pm', hour: 18 },
  ].map(({ label, hour }) => {
    const angleDeg = (hour / 24) * 360 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = cx + Math.cos(angleRad) * labelRadius;
    const y = cy + Math.sin(angleRad) * labelRadius;
    return (
      <text
        key={label}
        x={x} y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#9A9A96"
        fontSize={fontSize}
        fontFamily="'DM Sans', sans-serif"
      >
        {label}
      </text>
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {subticks}
      {spokes}
      {timeLabels}
      {/* Score in center */}
      <text
        x={cx} y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#1A1A1A"
        fontSize={compact ? size * 0.18 : size * 0.2}
        fontFamily="'DM Sans', sans-serif"
        fontWeight="500"
      >
        {score > 0 ? score : '--'}
      </text>
    </svg>
  );
}
