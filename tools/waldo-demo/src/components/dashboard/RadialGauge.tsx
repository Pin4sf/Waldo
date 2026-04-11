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
}

const ZONE_COLORS: Record<string, string> = {
  peak: '#34D399',
  moderate: '#7C6BF0', // purple-blue for steady
  low: '#F97316',
  nodata: '#9A9A96',
};

/** Generate a plausible energy curve from CRS + sleep data */
function defaultEnergyCurve(score: number): number[] {
  const curve: number[] = [];
  const normalized = score / 100;
  for (let h = 0; h < 24; h++) {
    let energy: number;
    if (h >= 0 && h < 6) {
      // Sleep hours — low
      energy = 0.15 + Math.random() * 0.1;
    } else if (h >= 6 && h < 8) {
      // Waking up — ramping
      energy = 0.3 + (h - 6) * 0.2 + Math.random() * 0.1;
    } else if (h >= 8 && h < 12) {
      // Morning peak
      energy = 0.7 + normalized * 0.3 + Math.random() * 0.05;
    } else if (h >= 12 && h < 14) {
      // Post-lunch dip
      energy = 0.5 + normalized * 0.15 + Math.random() * 0.05;
    } else if (h >= 14 && h < 18) {
      // Afternoon — moderate
      energy = 0.45 + normalized * 0.2 + Math.random() * 0.05;
    } else if (h >= 18 && h < 21) {
      // Evening wind-down
      energy = 0.35 + (21 - h) * 0.05 + Math.random() * 0.05;
    } else {
      // Late night
      energy = 0.2 + Math.random() * 0.1;
    }
    curve.push(Math.min(1, Math.max(0.1, energy)));
  }
  return curve;
}

export function RadialGauge({ score, zone, hourlyEnergy, size = 200, compact = false }: RadialGaugeProps) {
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
  const fontSize = compact ? 10 : 12;

  const timeLabels = compact ? [] : [
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
