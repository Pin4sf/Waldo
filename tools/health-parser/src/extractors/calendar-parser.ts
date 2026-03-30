/**
 * Google Calendar ICS parser.
 * Extracts events with: start/end, title, attendees, recurrence, location.
 * Computes Meeting Load Score per day.
 */
import * as fs from 'node:fs';

export interface CalendarEvent {
  uid: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  attendeeCount: number;
  isRecurring: boolean;
  location: string;
  status: string;
  transp: 'OPAQUE' | 'TRANSPARENT'; // busy vs free
}

export interface DayMeetingData {
  date: string;
  events: CalendarEvent[];
  meetingLoadScore: number;
  focusGaps: Array<{ start: string; end: string; durationMinutes: number; quality: number }>;
  totalMeetingMinutes: number;
  backToBackCount: number;
  boundaryViolations: number;
}

/**
 * Parse a .ics file into CalendarEvent array.
 */
export function parseICS(filePath: string): CalendarEvent[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const events: CalendarEvent[] = [];

  // Split into VEVENT blocks
  const eventBlocks = raw.split('BEGIN:VEVENT');

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i]!.split('END:VEVENT')[0] ?? '';

    // Unfold lines (ICS wraps long lines with leading space)
    const unfolded = block.replace(/\r?\n[ \t]/g, '');

    const getField = (name: string): string => {
      const match = unfolded.match(new RegExp(`^${name}[;:](.*)`, 'm'));
      return match?.[1]?.trim() ?? '';
    };

    const dtstart = getField('DTSTART');
    const dtend = getField('DTEND');
    const summary = getField('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const location = getField('LOCATION').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    const status = getField('STATUS');
    const transp = (getField('TRANSP') || 'OPAQUE') as 'OPAQUE' | 'TRANSPARENT';
    const uid = getField('UID');

    // Count attendees
    const attendeeCount = (unfolded.match(/^ATTENDEE/gm) || []).length;

    // Check recurrence
    const isRecurring = unfolded.includes('RRULE:');

    // Parse dates
    const startDate = parseICSDate(dtstart);
    const endDate = parseICSDate(dtend);

    if (!startDate || !endDate) continue;

    const durationMinutes = (endDate.getTime() - startDate.getTime()) / 60000;

    // Skip all-day events that span multiple days (like holidays/birthdays)
    if (durationMinutes > 1440) continue;
    // Skip cancelled events
    if (status === 'CANCELLED') continue;

    events.push({
      uid,
      summary,
      startDate,
      endDate,
      durationMinutes,
      attendeeCount,
      isRecurring,
      location,
      status,
      transp,
    });
  }

  return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

/**
 * Parse ICS date format.
 * Formats: "20260325T160000Z", "VALUE=DATE:20260325", "TZID=Asia/Kolkata:20260325T213000"
 */
function parseICSDate(raw: string): Date | null {
  if (!raw) return null;

  // All-day event: VALUE=DATE:20260325
  const allDayMatch = raw.match(/(\d{8})$/);
  if (raw.includes('VALUE=DATE') && allDayMatch) {
    const d = allDayMatch[1]!;
    return new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00`);
  }

  // With timezone: TZID=Asia/Kolkata:20260325T213000 or UTC: 20260325T160000Z
  const tzMatch = raw.match(/(\d{8}T\d{6})Z?$/);
  if (tzMatch) {
    const d = tzMatch[1]!;
    const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}`;

    if (raw.endsWith('Z')) {
      return new Date(iso + 'Z');
    }
    // Assume IST if timezone specified or no Z
    return new Date(iso + '+05:30');
  }

  return null;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  const local = new Date(d.getTime() + IST_OFFSET_MS);
  return local.toISOString().slice(0, 10);
}

/**
 * Compute Meeting Load Score for a set of events on one day.
 * MLS = sum per meeting: (duration/30) × adjacency × attendees × time_factor
 */
function computeMLS(events: CalendarEvent[]): number {
  if (events.length === 0) return 0;

  let mls = 0;
  const sorted = [...events].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    if (ev.transp === 'TRANSPARENT') continue; // Free/available, not a real meeting

    const durationFactor = ev.durationMinutes / 30;

    // Adjacency: gap to previous meeting
    let adjacencyFactor = 1.0;
    if (i > 0) {
      const prevEnd = sorted[i - 1]!.endDate.getTime();
      const gapMinutes = (ev.startDate.getTime() - prevEnd) / 60000;
      if (gapMinutes < 5) adjacencyFactor = 1.8;
      else if (gapMinutes < 15) adjacencyFactor = 1.4;
    }

    // Attendees
    const attendeeFactor = 1.0 + 0.05 * Math.max(ev.attendeeCount - 3, 0);

    // Time of day (IST)
    const hour = new Date(ev.startDate.getTime() + IST_OFFSET_MS).getHours();
    let timeFactor = 1.0;
    if (hour >= 8 && hour < 12) timeFactor = 0.8;      // Morning peak
    else if (hour >= 13 && hour < 15) timeFactor = 1.2; // Post-lunch trough
    else if (hour >= 18) timeFactor = 1.1;               // Evening boundary

    mls += durationFactor * adjacencyFactor * attendeeFactor * timeFactor;
  }

  return Math.round(mls * 10) / 10;
}

/**
 * Organize calendar events by day and compute metrics.
 */
export function organizeCalendarByDay(events: CalendarEvent[]): Map<string, DayMeetingData> {
  const days = new Map<string, CalendarEvent[]>();

  for (const ev of events) {
    const dk = dateKey(ev.startDate);
    if (!days.has(dk)) days.set(dk, []);
    days.get(dk)!.push(ev);
  }

  const result = new Map<string, DayMeetingData>();

  for (const [date, dayEvents] of days) {
    const busyEvents = dayEvents.filter(e => e.transp === 'OPAQUE');
    const sorted = busyEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // Back-to-back count
    let backToBack = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i]!.startDate.getTime() - sorted[i - 1]!.endDate.getTime()) / 60000;
      if (gap < 5) backToBack++;
    }

    // Boundary violations (before 8am or after 7pm IST, or weekends)
    const dow = new Date(date + 'T00:00:00').getDay();
    let violations = 0;
    for (const ev of busyEvents) {
      const hour = new Date(ev.startDate.getTime() + IST_OFFSET_MS).getHours();
      if (hour < 8 || hour >= 19) violations++;
    }
    if (dow === 0 || dow === 6) violations += busyEvents.length; // Weekend meetings

    // Focus gaps (≥60 min between meetings, 8am-7pm)
    const focusGaps: DayMeetingData['focusGaps'] = [];
    const workStart = new Date(date + 'T02:30:00Z'); // 8am IST
    const workEnd = new Date(date + 'T13:30:00Z');   // 7pm IST

    const boundaries = [workStart, ...sorted.flatMap(e => [e.startDate, e.endDate]), workEnd];
    for (let i = 0; i < boundaries.length - 1; i += 2) {
      const gapStart = boundaries[i]!;
      const gapEnd = boundaries[i + 1]!;
      const gap = (gapEnd.getTime() - gapStart.getTime()) / 60000;
      if (gap >= 60) {
        focusGaps.push({
          start: gapStart.toISOString(),
          end: gapEnd.toISOString(),
          durationMinutes: Math.round(gap),
          quality: gap >= 120 ? 1.0 : gap >= 90 ? 0.8 : 0.6,
        });
      }
    }

    result.set(date, {
      date,
      events: dayEvents,
      meetingLoadScore: computeMLS(dayEvents),
      focusGaps,
      totalMeetingMinutes: Math.round(busyEvents.reduce((s, e) => s + e.durationMinutes, 0)),
      backToBackCount: backToBack,
      boundaryViolations: violations,
    });
  }

  return result;
}
