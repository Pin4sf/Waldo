/**
 * Waldo Brand Tokens — Mobile
 * Sourced from WALDO_BRAND_STANDARDS_V2.md (April 2026)
 * Cherry-picked from waldo-dev-review into main repo.
 *
 * Rules enforced here:
 * - #FAFAF8 not #FFFFFF (warm off-white, never cold white)
 * - #1A1A1A not #000000 (near-black, never pure black)
 * - DM Sans: 400, 400i, 500 only. Bold is forbidden.
 * - Corben: 400 only. Never bold Corben.
 * - Zone text colours are exact brand spec — not approximations.
 */

export const colors = {
  // ─── Core surfaces ──────────────────────────────────────────────
  background:    '#FAFAF8',
  surface:       '#F4F3F0',
  surfaceRaised: '#EEECEA',
  surfaceInset:  '#EEEDE9',

  // ─── Text ────────────────────────────────────────────────────────
  textPrimary:   '#1A1A1A',
  textSecondary: '#6B6B68',
  textMuted:     '#9A9A96',
  textDisabled:  '#C4C3BF',

  // ─── Accent ──────────────────────────────────────────────────────
  accent:     '#F97316',
  accentHover:'#EA6C0A',
  accentSoft: 'rgba(249,115,22,0.10)',

  // ─── Borders ─────────────────────────────────────────────────────
  border:       'rgba(26,26,26,0.08)',
  borderStrong: 'rgba(26,26,26,0.18)',
  trackColor:   'rgba(26,26,26,0.08)',

  // ─── Semantic ────────────────────────────────────────────────────
  dark:  '#1A1A1A',
  white: '#FAFAF8',

  // ─── Nap Score zone system (exact brand spec) ────────────────────
  zone: {
    peak:     '#D1FAE5',
    steady:   '#FEF3C7',
    flagging: '#FEE2E2',
    depleted: '#F3F4F6',
  },
  zoneText: {
    peak:     '#065F46',
    steady:   '#92400E',
    flagging: '#991B1B',
    depleted: '#374151',
  },
  zoneBorder: {
    peak:     'rgba(6,95,70,0.2)',
    steady:   'rgba(146,64,14,0.2)',
    flagging: 'rgba(153,27,27,0.2)',
    depleted: 'rgba(55,65,81,0.2)',
  },

  // ─── Chat (iMessage register) ────────────────────────────────────
  chat: {
    waldoBubble: '#F4F3F0',
    userBubble:  '#1A1A1A',
    userText:    '#FAFAF8',
    waldoText:   '#1A1A1A',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────────────
export const fonts = {
  corben:       'Corben_400Regular',
  dmSans:       'DMSans_400Regular',
  dmSansItalic: 'DMSans_400Regular_Italic',
  dmSansMedium: 'DMSans_500Medium',
} as const;

// ─── Spacing (8px base grid) ─────────────────────────────────────────
export const spacing = {
  xxs: 4,
  xs:  8,
  sm:  12,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 40,
} as const;

// ─── Border radius ────────────────────────────────────────────────────
export const borderRadius = {
  xs:   6,
  sm:   10,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 999,
} as const;

// ─── Type scale ───────────────────────────────────────────────────────
export const fontSize = {
  xs:      11,
  sm:      13,
  md:      16,
  lg:      22,
  xl:      32,
  display: 52,
  giant:   72,
} as const;

// ─── Zone system ──────────────────────────────────────────────────────
export type Zone = 'peak' | 'steady' | 'flagging' | 'depleted';

export function getZoneFromScore(score: number): Zone {
  if (score >= 80) return 'peak';
  if (score >= 60) return 'steady';
  if (score >= 40) return 'flagging';
  return 'depleted';
}

export function getZoneLabel(zone: Zone): string {
  const labels: Record<Zone, string> = {
    peak:     'Peak',
    steady:   'Steady',
    flagging: 'Flagging',
    depleted: 'Depleted',
  };
  return labels[zone];
}

export function getZoneTone(zone: Zone) {
  return {
    surface: colors.zone[zone],
    text:    colors.zoneText[zone],
    border:  colors.zoneBorder[zone],
  };
}
