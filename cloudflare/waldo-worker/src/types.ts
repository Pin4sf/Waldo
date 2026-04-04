/** Cloudflare Worker environment bindings */
export interface Env {
  WALDO_AGENT: DurableObjectNamespace;

  // Secrets (set via wrangler secret put)
  ANTHROPIC_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  DEEPSEEK_API_KEY?: string;       // optional — enables cheap provider for generation

  // Vars (in wrangler.toml)
  SUPABASE_URL: string;
  ENVIRONMENT: string;
}

/** User profile loaded from Supabase */
export interface UserProfile {
  id: string;
  name: string;
  timezone: string;
  wakeTimeEstimate: string;       // 'HH:MM'
  preferredEveningTime: string;   // 'HH:MM'
  wearableType: string;
  telegramChatId: number | null;
  isAdmin: boolean;
}

/** CRS score row from Supabase */
export interface CrsScore {
  date: string;
  score: number;
  zone: 'peak' | 'moderate' | 'low';
  sleepJson: Record<string, unknown> | null;
  hrvJson: Record<string, unknown> | null;
}

/** Health snapshot row from Supabase */
export interface HealthSnapshot {
  date: string;
  hrv_rmssd: number | null;
  resting_hr: number | null;
  sleep_duration_hours: number | null;
  sleep_efficiency: number | null;
  steps: number | null;
  data_tier: 'rich' | 'partial' | 'sparse' | 'empty';
}

/** Trigger type for the agent */
export type TriggerType = 'morning_wag' | 'fetch_alert' | 'evening_review' | 'conversational' | 'patrol' | 'weekly_compaction';

/** Agent state persisted in memory_blocks */
export interface AgentState {
  userId: string;
  provisioned: boolean;
  lastMorningWagDate: string | null;
  lastFetchAlertAt: string | null;
  fetchAlertsTodayCount: number;
  lastEveningDate: string | null;
  currentZone: string;
  currentScore: number;
}
