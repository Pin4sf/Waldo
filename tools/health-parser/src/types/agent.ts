/**
 * Agent simulation types for Waldo.
 * Maps personality zones to CRS ranges and defines message modes.
 */

/** Waldo's personality zones — selected by CRS */
export type PersonalityZone = 'energized' | 'steady' | 'flagging' | 'depleted' | 'crisis';

/** Message mode — what kind of message Waldo is generating */
export type MessageMode = 'morning_wag' | 'fetch_alert' | 'conversational';

/** Zone thresholds */
export function getPersonalityZone(crs: number): PersonalityZone {
  if (crs < 0) return 'crisis';
  if (crs >= 80) return 'energized';
  if (crs >= 60) return 'steady';
  if (crs >= 40) return 'flagging';
  return 'depleted';
}

/** What the agent knows when generating a message */
export interface AgentContext {
  /** User profile */
  userName: string;
  age: number;
  /** Current CRS + zone */
  crs: number;
  zone: PersonalityZone;
  /** Biometric snapshot for prompt */
  biometricSummary: string;
  /** Sleep summary */
  sleepSummary: string;
  /** Stress events today */
  stressSummary: string;
  /** Activity summary */
  activitySummary: string;
  /** Environment context (weather, noise, daylight, wrist temp) */
  environmentSummary: string;
  /** Patterns Waldo has learned */
  patternsSummary: string;
  /** Cross-day user intelligence profile */
  userIntelligenceSummary: string;
  /** Onboarding profile (role, goals, communication style) */
  onboardingProfile: string;
  /** Data confidence tier */
  dataConfidence: string;
  /** Today vs history comparison */
  trendComparison: string;
  /** Spots Waldo already noticed today */
  spotsSummary: string;
  /** The specific date */
  date: string;
  /** Message mode */
  mode: MessageMode;
  /** Optional user question (for conversational mode) */
  userQuestion?: string;
}

/** Claude's response */
export interface AgentResponse {
  /** The message Waldo would send */
  message: string;
  /** Which zone/mode was used */
  zone: PersonalityZone;
  mode: MessageMode;
  /** Token usage */
  tokensIn: number;
  tokensOut: number;
  /** Response time */
  responseTimeMs: number;
}
