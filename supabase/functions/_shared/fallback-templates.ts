/**
 * Waldo — Fallback Templates
 * Pre-built messages used when Claude is skipped (pre-filter / circuit breaker).
 * Ported from agent/soul/FALLBACK_TEMPLATES.md for Edge Function runtime.
 */

export type FallbackZone = 'peak' | 'steady' | 'flagging' | 'depleted' | 'no_data';
export type FallbackTrigger = 'morning_wag' | 'fetch_alert' | 'evening_review' | 'data_sparse';

export interface TemplateVars {
  crs?: number;
  sleep_hours?: number | null;
  sleep_debt?: number | null;
  sleep_target?: number;
  sleep_avg?: number | null;
  hrv_baseline?: number | null;
  hrv_drop_pct?: number | null;
  hr_current?: number | null;
  hr_baseline?: number | null;
  peak_start?: string;
  peak_end?: string;
  strain?: number | null;
  meeting_count?: number | null;
}

function fill(template: string, vars: TemplateVars): string {
  return template
    .replace('{crs}', vars.crs != null ? String(vars.crs) : '—')
    .replace('{sleep_hours}', vars.sleep_hours != null ? vars.sleep_hours.toFixed(1) + 'h' : '?')
    .replace('{sleep_debt}', vars.sleep_debt != null ? vars.sleep_debt.toFixed(1) + 'h' : '?')
    .replace('{sleep_target}', String(vars.sleep_target ?? '7-8'))
    .replace('{sleep_avg}', vars.sleep_avg != null ? vars.sleep_avg.toFixed(1) + 'h' : '—')
    .replace('{hrv_baseline}', vars.hrv_baseline != null ? Math.round(vars.hrv_baseline) + 'ms' : '—')
    .replace('{hrv_drop_pct}', vars.hrv_drop_pct != null ? Math.round(vars.hrv_drop_pct) + '%' : '?')
    .replace('{hr_current}', vars.hr_current != null ? Math.round(vars.hr_current) + 'bpm' : '—')
    .replace('{hr_baseline}', vars.hr_baseline != null ? Math.round(vars.hr_baseline) + 'bpm' : '—')
    .replace('{peak_start}', vars.peak_start ?? 'mid-morning')
    .replace('{peak_end}', vars.peak_end ?? 'midday')
    .replace('{meeting_count}', String(vars.meeting_count ?? 'several'));
}

const MORNING_WAG_TEMPLATES: Record<FallbackZone, string> = {
  peak:     '{crs}. Solid night — sleep was good ({sleep_hours}). This is a strong baseline.',
  steady:   'Nap Score: {crs}. Decent night ({sleep_hours}). Peak window {peak_start}–{peak_end} if you have anything hard.',
  flagging: 'Nap Score: {crs}. Sleep was short ({sleep_hours}) — {sleep_debt} in the hole. Take it a notch easier.',
  depleted: 'Nap Score: {crs}. Rough night — {sleep_hours}, recovery numbers low. Rest where you can.',
  no_data:  "Couldn't pull your data this morning — watch sync may be delayed. Check back in a bit.",
};

const EVENING_REVIEW_TEMPLATES: Record<FallbackZone, string> = {
  peak:     'Solid day — score held at {crs}. Sleep well tonight and you carry momentum into tomorrow.',
  steady:   'Day {crs}. Even day. Try to hit {sleep_target}h tonight to keep the baseline steady.',
  flagging: 'Tough day ({crs}). Tonight matters — aim for {sleep_target}h. Tomorrow\'s score depends on it.',
  depleted: 'Hard day ({crs}). Body\'s been asking for rest. Wind down early — {sleep_target}h would help a lot.',
  no_data:  'Quiet on data today. Make sure your watch charged overnight.',
};

const FETCH_ALERT_TEMPLATES: Record<string, string> = {
  hrv_drop:      'HRV dipped {hrv_drop_pct}% from your usual. Short break if you can.',
  elevated_hr:   'Resting HR elevated ({hr_current}bpm vs your usual {hr_baseline}bpm). Worth stepping away for a few minutes.',
  combined:      'A few stress signals at once — HRV down, HR elevated. Take 5 if you can.',
  meeting_load:  'You\'ve got {meeting_count} meetings packed in today. That kind of density tends to hit your score by evening.',
  default:       'Stress signal detected. Short break if you can.',
};

const DATA_SPARSE_TEMPLATES: Record<string, string> = {
  day1:      'Morning — first day of data coming in. Still building your baselines. Check back in a week for a real read.',
  day3:      'Nap Score: {crs}. Early days — need about a week to get your baselines right. Sleep so far averaging {sleep_avg}.',
  day7:      'Nap Score: {crs}. First full week in — baselines established. Sleep average: {sleep_avg}, HRV baseline: {hrv_baseline}. Getting a real picture.',
  building:  'Nap Score: {crs}. Still calibrating — baselines sharpen over the next week.',
};

/**
 * Get the pre-filter template for a trigger + zone combination.
 * Returns null if no template applies (send to Claude instead).
 */
export function getPreFilterTemplate(
  triggerType: FallbackTrigger,
  zone: FallbackZone,
  vars: TemplateVars,
  stressSignalType?: string,
  daysOfData?: number,
): string | null {
  if (triggerType === 'morning_wag') {
    // Data sparse: different templates for first week
    if (daysOfData != null && daysOfData < 7) {
      const key = daysOfData <= 1 ? 'day1' : daysOfData <= 3 ? 'day3' : 'building';
      return fill(DATA_SPARSE_TEMPLATES[key], vars);
    }
    const template = MORNING_WAG_TEMPLATES[zone];
    return fill(template, vars);
  }

  if (triggerType === 'evening_review') {
    const template = EVENING_REVIEW_TEMPLATES[zone];
    return fill(template, vars);
  }

  if (triggerType === 'fetch_alert') {
    const key = stressSignalType ?? 'default';
    const template = FETCH_ALERT_TEMPLATES[key] ?? FETCH_ALERT_TEMPLATES.default;
    return fill(template, vars);
  }

  return null;
}

/**
 * Pre-filter decision: should we skip Claude for this invocation?
 * Returns the template string to send, or null to proceed with Claude.
 */
export function runPreFilter(params: {
  triggerType: string;
  zone: FallbackZone;
  crsScore: number;
  stressConfidence: number;
  vars: TemplateVars;
  stressSignalType?: string;
  daysOfData?: number;
  baselinesEstablished?: boolean;
}): string | null {
  const { triggerType, zone, crsScore, stressConfidence, vars, stressSignalType, daysOfData, baselinesEstablished } = params;

  // Conversational and onboarding always go to Claude
  if (triggerType === 'conversational' || triggerType === 'onboarding') return null;

  // Data sparse: new user without baselines (morning_wag + evening_review only)
  if (baselinesEstablished === false && triggerType !== 'fetch_alert') {
    return getPreFilterTemplate(triggerType as FallbackTrigger, zone, vars, undefined, daysOfData);
  }

  // Morning wag + evening review: send template when CRS is normal and no stress
  if (
    (triggerType === 'morning_wag' || triggerType === 'evening_review') &&
    crsScore > 60 &&
    stressConfidence < 0.30
  ) {
    return getPreFilterTemplate(triggerType as FallbackTrigger, zone, vars);
  }

  // Fetch alert: always has a signal (stress_confidence >= 0.60 already checked by check-triggers)
  // Still use template for common signal types, let Claude handle complex/combined signals
  if (triggerType === 'fetch_alert' && stressConfidence < 0.80) {
    return getPreFilterTemplate('fetch_alert', zone, vars, stressSignalType);
  }

  return null; // Send to Claude
}
