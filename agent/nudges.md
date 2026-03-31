# Waldo nudge templates

These are templates for cross-source nudges — situations where BOTH health and work data contribute to the insight. The agent selects and personalizes these based on the user's data.

## Pre-meeting energy

**Trigger:** CRS < 50 + important meeting in 60min
**Template:** "[Score]. [Meeting name] in [time]. [One micro-action]. [Optional: I've prepped something]."
**Example:** "47 right now. Board review in an hour. Quick walk. I've prepped 3 talking points so you can coast."

## Back-to-back breaker

**Trigger:** 3+ consecutive meetings + HRV declining
**Template:** "[Count] meetings straight. [HRV change]. [The optional one]. [One action]."
**Example:** "Three meetings straight, HRV down 22%. Next one's optional standup. Skip it."

## Focus protection

**Trigger:** CRS 80+ + low MLS + new meeting invite in peak window
**Template:** "[Peak context]. [Who's booking]. [Suggest alternative]."
**Example:** "This is your deep work window. Someone wants to book 10am. Push to 1pm?"

## Sleep debt escalation

**Trigger:** Sleep debt > 3h + tomorrow has early meeting
**Template:** "[Debt amount]. [Tomorrow's first event]. [If you push → prediction]."
**Example:** "3.2h sleep debt. Tomorrow starts at 8am. Push to 10am — predicted CRS jumps 52 → 68."

## After-hours email → sleep

**Trigger:** After-hours email ratio > 40% + next-day sleep quality dropped
**Template:** "[What happened]. [The correlation]. [One change]."
**Example:** "You were emailing until 11:22pm — 40 minutes before your usual bedtime. That's probably why CRS dropped 14 points."

## Cognitive overload

**Trigger:** Cognitive Load > 70
**Template:** "[Load level]. [Biggest contributor]. [One action]."
**Example:** "Cognitive load is heavy. Email volume is 2x normal — that's the driver. Close Slack for 45 minutes."

## Burnout trajectory

**Trigger:** Burnout Trajectory > 0.6 (30-day)
**Template:** "[The trend, not the day]. [The main driver]. [One structural change]."
**Example:** "HRV baseline dropped 11% this month. Meeting Load went from 5.2 to 7.8. Protect tomorrow morning completely."

## Post-exercise clarity

**Trigger:** HRV spike after exercise + hard task deadline approaching
**Template:** "[The boost]. [The window]. [The task]."
**Example:** "HRV jumped 18% after your walk. 90 minutes of peak clarity. That design doc? Now."

## Recovery day

**Trigger:** 2 consecutive days CRS < 40 + tomorrow's calendar is light
**Template:** "[How long recovery has been needed]. [Tomorrow's lightness]. [What Waldo is doing]."
**Example:** "Two days running on empty. Tomorrow's light — only the 2pm sync stays. Everything else can wait."

## Peak + light = rare opportunity

**Trigger:** CRS 85+ + MLS ≤ 2 + no major stress
**Template:** "[The score]. [The schedule]. [The opportunity]."
**Example:** "86 today and your calendar is clear. This doesn't happen often. What's the hardest thing on your plate?"

---

## Task-specific nudges

## Deadline crunch — low energy

**Trigger:** Task due today + CRS < 50
**Template:** "[Acknowledge the state]. [The plan]. [The approach]."
**Example:** "45 but this is due today. Break it into three 25-min chunks. Start with the section you know best. Good enough beats perfect today."

## Deadline crunch — good energy

**Trigger:** Task due today + CRS ≥ 70
**Template:** "[The energy]. [The task]. [Clear the decks]."
**Example:** "82 and the deadline is today. Knock it out before noon. Nothing else matters until it's done."

## Overdue pile-up

**Trigger:** >10 tasks overdue
**Template:** "[The number is the problem]. [Pick 3]. [Let go of the rest]."
**Example:** "13 overdue. That number is more draining than the tasks. Pick 3 that actually matter this week. Defer, delegate, or delete the rest."

## Task-energy mismatch

**Trigger:** Hard task attempted during CRS < 50
**Template:** "[What's happening]. [The alternative]. [The choice]."
**Example:** "Your CRS says this is a grind-it-out window, not a think-clearly window. Could you do the easier parts now and save the hard thinking for tomorrow morning?"

## Momentum starter

**Trigger:** CRS < 40 + tasks pending + no momentum yet today
**Template:** "[One tiny thing]. [Then decide]."
**Example:** "Start with one thing. Reply to that message. Close one tab. Then see how you feel about the bigger stuff."

## Recurring task detection

**Trigger:** Day-of-week matches a recurring task pattern
**Template:** "[The pattern]. [Today's readiness]. [The question]."
**Example:** "It's Monday. Your list says 'Workout: Legs (5:15)'. CRS is 71, sleep was solid. Good to go?"

## Task completion acknowledgment

**Trigger:** User completed a task during CRS peak
**Template:** "[What happened]. [The connection]."
**Example:** "You cleared that during your peak window. That's the pattern — hard stuff before noon, admin after. Working."

## Smart deferral suggestion

**Trigger:** Task due tomorrow + CRS < 40 today + predicted CRS tomorrow > 65
**Template:** "[Today vs tomorrow]. [The prediction]. [The choice]."
**Example:** "This is due tomorrow. You're at 38 today but if you sleep by 11, predicted CRS is ~68 tomorrow morning. Push through now or hit it fresh?"
