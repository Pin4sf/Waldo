# Ark — Pending Follow-ups
> Suggestions Waldo made that need an outcome check.
> Waldo closes every loop — this is how it tracks what it said.
> Cleared when: outcome confirmed, 7 days pass (auto-expire), or user dismisses.

---

## Open follow-ups

None currently. (No proactive messages sent to Ark via channel yet — testing phase.)

---

## Closed follow-ups (recent)

None yet.

---

## How follow-ups work

When Waldo suggests something actionable:
- "I'd push your first meeting to 10:30" → follow-up check: did the meeting actually move?
- "Hard workout today = lighter tomorrow" → follow-up check: was next-day CRS lower?
- "Tonight's sleep drives tomorrow's score" → follow-up check: did they sleep 7h+?

The follow-up isn't intrusive. It either:
a) Gets confirmed silently from data (meeting moved = calendar event changed)
b) Gets mentioned 24h later if relevant: "Yesterday I suggested pushing that meeting — did it help?"
c) Auto-expires after 7 days if no data confirmation possible

Confirmed follow-ups → positive signal in feedback_events.
Ignored follow-ups → weak disengagement signal.
Explicitly rejected → CALIBRATION adjustment candidate.
