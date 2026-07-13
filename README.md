# Goals & Habits Tracker (Google Calendar Add-on)

A Google Workspace Calendar Add-on, built with Apps Script, for tracking
daily goals/habits directly inside the Google Calendar UI. Each goal you
create gets a name and a short icon/emoji, and is one of two types:
**Pass/Fail** (e.g. "did I hit my daily calorie target?" — every day you
mark it done or missed) or **Count only** (e.g. "days I worked out" — you
just mark the days you did it, with no "missed" concept at all). Marking a
day is stored as a colored all-day event on your primary calendar — visible
right on the calendar grid, no separate app to check.

## How it works

- Opening the add-on's side panel in Google Calendar (or opening any event)
  shows a "Goals & Habits" card listing your active goals and today's status
  for each. Each goal row shows just its icon/emoji (shown large, alongside
  the day's ✅/❌ status) — the goal's name isn't displayed on the home card,
  only in the Edit form.
- **✅ Success** / **❌ Fail** / **Clear** / **✏️ Edit** / **🗑️ Delete** sit
  together in one button row underneath each goal. A **Count only** goal
  never shows the ❌ Fail button at all — there's nothing to fail, so it's
  just ✅/Clear/Edit/Delete. Success/Fail/Clear write, update, or delete an
  all-day Calendar event for that goal on the selected day, titled with just
  the goal's icon and a ✅/❌ mark (no name). Success events use Calendar's
  green ("Basil") color; fails use red ("Tomato"). If a stale card somehow
  still tries to mark a Count only goal as failed, the add-on shows a
  notification instead of writing anything.
- A date-navigation row at the top of the card (◀ *date* ▶) moves one day
  back/forward in place. Tapping the date itself opens a date picker so you
  can jump straight to any day, not just step through one at a time.
- **+ New goal** opens a form (name, icon, type, start date, and duration in
  days) and saves it to your Apps Script user properties — this is
  per-Google-account, private to you. A duration of **0 means the goal runs
  forever** (leaving the field blank does the same). The type defaults to
  Pass/Fail.
- The **✏️ Edit** button on a goal row opens the same form pre-filled with
  that goal's current name, icon, type, start date, and duration, and saves
  your changes back to the same goal on submit. This is the only place the
  goal's name is shown or changed after creation. You can switch a goal's
  type at any time; if a Pass/Fail goal already has ❌-marked days in
  Calendar, those events are left exactly as they are (past history is
  never touched) — the goal's Goal summary row and available buttons just
  follow whichever type it's currently set to.
- Each goal has a start date and a duration (in days), or no duration at all
  for a goal that runs forever. This is purely informational: outside a
  fixed-duration goal's window the goal shows a badge ("Starts ..." /
  "🏁 Completed") on the home card, but the Mark done / Mark missed / Clear
  buttons still work on any day regardless of the window. Forever goals never
  show that badge.
- A **Goal summary** section below today's goals lists every active goal —
  icon, duration, days left, and a running ✅ done count — always relative to
  today regardless of which day you're viewing via Choose day. Pass/Fail
  goals additionally show a running ❌ missed count; Count only goals don't,
  since there's no such thing as a missed day for them. Forever goals
  (duration 0, or goals created before the duration field existed) show "∞"
  for duration/days left and count done (and missed, for Pass/Fail goals)
  from their start date (or creation date) through today.
- Pass/Fail goals also show a **🔥 N** streak count in the Goal summary — the
  number of consecutive days marked done, counting backward from today. A
  day marked failed, or a day with no entry at all, breaks the streak back
  to 0 — except today itself: if you simply haven't logged today yet, the
  streak still shows through yesterday rather than dropping to 0 early: it
  only resets once today is explicitly marked failed, or once a whole day
  passes with nothing logged. The streak is hidden for Count only goals (no
  "missed" concept to break it) and for goals that are upcoming (haven't
  started) or completed (past their window) — otherwise it behaves the same
  as the done/missed counts, always relative to today.
- Deleting a goal is a **soft delete**: it disappears from the home card and
  Goal summary, but its definition and all its past calendar events are kept
  forever — nothing is erased. A deleted goal can also no longer be marked or
  edited; if a stale card somehow still tries (e.g. it was open in another
  tab before you deleted the goal), the add-on shows a notification instead
  of making the change. There is still no way to *restore* a deleted goal.
- **View all goals**, next to Create goal, opens a read-only card listing
  every goal you've ever created — "Active" and "Completed" (soft-deleted)
  goals in separate sections, each row rendered exactly like a Goal summary
  row (icon, duration, done/missed counts, streak). This is the only place
  a deleted goal's data is visible again; there's no restore action here,
  just a historical record.

Goal *definitions* (name, icon, type, start date, duration in days, active
flag) live in `PropertiesService.getUserProperties()`. Goal *status per
day* is not stored anywhere else — it lives entirely on the Calendar event via
`extendedProperties.private` (`goalId`, `dateKey`, `status`), so the
calendar is the single source of truth for your history. Goals created
before this feature existed have no start date/duration stored; they're
read back with no window badge and behave exactly like a forever goal.

## Project layout

```
src/            Apps Script source (pushed to Google via clasp)
  appsscript.json    Add-on manifest: scopes, Calendar advanced service, triggers
  Triggers.js        Trigger entry points (onHomepage, onCalendarEventOpen)
  ActionHandlers.js  Every CardService onClickAction handler (mark status, create/edit/delete goal, navigation)
  CodeHelpers.js     Small private helpers shared by Triggers.js/ActionHandlers.js
  HomeCard.js        Home card CardService UI (today's goals + Goal summary)
  GoalFormCard.js    Create/edit goal form CardService UI
  AllGoalsCard.js    Read-only "View all goals" card, grouped by Active/Completed (soft-deleted)
  MiscCards.js       Small standalone cards (date picker, error card)
  CardTheme.js       Shared button color constants
  GoalService.js     Goal validation + CRUD, backed by PropertiesService
  CalendarService.js Calendar event read/write + goal window/summary logic, backed by the advanced Calendar API service
  GoalRules.js       Namespace object grouping goal-first-arg logic (windowStatus/summaryStats/isForever/isCountOnly) for a more objectified call style
  DateKeyUtils.js    Pure 'YYYY-MM-DD' dateKey math, no Apps Script dependency
tests/          Jest unit tests for the pure/testable logic
README.md       This file
```

## One-time setup (you need a Google account + Google Cloud access)

This step requires an interactive OAuth login in a real browser, so it has
to be run by you locally — it cannot be done from an automated session.

```bash
npm install
npm run login    # opens a browser, log in with the Google account you want the add-on on
npm run create    # creates a new standalone Apps Script project, writes .clasp.json (gitignored)
npm run push      # uploads src/ to that Apps Script project
npm run open      # opens the project in the Apps Script editor
```

Then, in the Apps Script editor:

1. **Deploy → Test deployments → Install add-on** (or **Deploy → New deployment** →
   type "Add-on" for broader personal install). This installs the add-on for
   your own account only — no Google Workspace Marketplace review needed
   for personal use.
2. Open Google Calendar. The add-on icon appears in the right-hand side
   panel. Click it to see the "Goals & Habits" card.
3. The first click will prompt an OAuth consent screen for the
   `calendar.events` and `calendar.calendars.readonly` scopes declared in
   `src/appsscript.json` — approve it.

If you want to publish this for other users later, that requires OAuth
consent screen verification and Marketplace listing — out of scope for
personal habit tracking, but the manifest is structured to support it later.

## Testing

Run the unit test suite:

```bash
npm test
npm run test:coverage
```

**Coverage note:** `GoalService.js`, `CalendarService.js`, `GoalRules.js`,
`DateKeyUtils.js`, and `CardTheme.js` are unit tested (mocking
`PropertiesService`/`Calendar` globals where needed) and sit at ~97-100%
line coverage. `Triggers.js`, `ActionHandlers.js`, `CodeHelpers.js`,
`HomeCard.js`, `GoalFormCard.js`, `AllGoalsCard.js`, and `MiscCards.js` are
intentionally excluded from coverage collection (see `jest.config.js`)
because they are thin wiring around `CardService` and Calendar add-on trigger objects
(`e.parameters`, `e.formInput`, card navigation) that only exist inside a
live Google Calendar session with a real OAuth-authenticated add-on
install. There is no way to instantiate `CardService` outside that runtime,
so 100% coverage of those files isn't achievable with Jest — they're
covered by the manual test plan below instead.

### Manual test plan (run after `npm run push` + reload the add-on)

- [ ] Create a Pass/Fail goal with a name, an emoji icon, a start date, and a duration; it appears on the home card.
- [ ] Mark it "Mark done" for today; a green all-day event titled with the icon and ✅ (no goal name) appears on today's date in Calendar.
- [ ] Confirm the goal's icon appears large on the home card and in the Goal summary row, with no name shown in either place; confirm all five action buttons (Success/Fail/Clear/Edit/Delete) appear together in one row under the goal.
- [ ] Mark it "Mark missed" for today; the same event turns red and updates to ❌ (no duplicate event created).
- [ ] Click "Clear"; the event is removed from the calendar.
- [ ] Create a Count only goal (e.g. "days I worked out"); confirm its row shows only four buttons (Success/Clear/Edit/Delete, no Fail button) and its Goal summary row shows a ✅ done count with no ❌ missed count.
- [ ] Mark a Count only goal done for a few days; confirm the events are created the same way as a Pass/Fail goal's success events (green, ✅).
- [ ] Edit a Count only goal and switch its type to Pass/Fail (or vice versa); confirm the Fail button appears/disappears accordingly and the Goal summary line updates to match.
- [ ] On a Pass/Fail goal that already has some ❌-marked days, switch it to Count only; confirm those past events are untouched in Calendar, and the Goal summary row now shows only the done count.
- [ ] Tap "Edit" on a goal created before this feature existed (no stored goalType, if you have one); confirm the form opens with Pass/Fail pre-selected.
- [ ] Tap the left/right arrows in the date-navigation row; confirm the card updates in place to the previous/next day.
- [ ] Tap the date itself between the arrows; confirm it opens the date picker, and picking a day jumps straight there.
- [ ] Create a second goal, confirm both show independently with independent statuses per day.
- [ ] Delete a goal; confirm it disappears from the home card and Goal summary, and a "kept" notification appears.
- [ ] After deleting a goal, confirm its past calendar events are untouched, and re-opening the add-on never shows it again (no restore path).
- [ ] From a card that was still open before you deleted a goal elsewhere (or by double-tapping Delete quickly), try to delete/mark/edit that same goal again; confirm it's a harmless no-op / graceful notification, not an error.
- [ ] Submit the "New goal" form with an empty name; confirm a validation error notification appears and no goal is created.
- [ ] Submit the "New goal" form with a duration of 0; confirm the goal is created with no window badge, and its Goal summary row shows "∞" for duration/days left.
- [ ] Submit the "New goal" form with a blank duration; confirm the same forever behavior as duration 0.
- [ ] Submit the "New goal" form with a negative duration (e.g. -1); confirm a validation error notification appears.
- [ ] Create a goal with a start date in the future; confirm the home card shows a "Starts ..." badge and Mark done/Mark missed still work.
- [ ] Create a goal with a past start date and a short duration so the window has already elapsed; confirm a "🏁 Completed" badge appears and Mark done/Mark missed still work.
- [ ] Tap "Edit" on a goal; confirm the form opens pre-filled with its current name, icon, type, start date, and duration.
- [ ] Edit a goal's name/icon/start date/duration and save; confirm the home card and Goal summary reflect the change, and past calendar events for that goal are unaffected.
- [ ] Edit a fixed-duration goal's duration to 0 and save; confirm its window badge disappears and its Goal summary row switches to "∞".
- [ ] Submit the "Edit goal" form with an empty name; confirm a validation error notification appears and the goal is left unchanged.
- [ ] Tap "Edit" on a goal that predates the start-date/duration feature (no stored startDate/durationDays, if you have one); confirm the form opens without error, pre-filled with today's date and a duration of 0.
- [ ] In the Goal summary section, confirm each goal shows the right icon, duration, days left, and a done count (plus a missed count for Pass/Fail goals only); mark a few days done (and missed, for a Pass/Fail goal) and confirm the counts update after reopening the add-on.
- [ ] Confirm the Goal summary numbers don't change when you navigate to a different day (they should stay pinned to today).
- [ ] Mark a Pass/Fail goal done for 3 consecutive days ending today; confirm the Goal summary shows "🔥 3".
- [ ] Mark that same goal failed today; confirm the streak immediately drops to "🔥 0".
- [ ] Build a 3-day streak ending yesterday, then reopen the add-on without marking anything for today; confirm the streak still shows "🔥 3" (today pending doesn't break it yet).
- [ ] From that same pending state, mark today done; confirm the streak becomes "🔥 4". Alternatively mark it failed; confirm it becomes "🔥 0".
- [ ] Confirm a Count only goal never shows a streak segment in its Goal summary row.
- [ ] Confirm a goal with an "upcoming" (Starts ...) or "🏁 Completed" badge never shows a streak segment, even if it has done days recorded.
- [ ] Confirm a forever Pass/Fail goal (duration 0) shows a streak like any other active Pass/Fail goal.
- [ ] Reload Calendar entirely and reopen the add-on; confirm goals and today's statuses persist (PropertiesService + Calendar are both durable).
- [ ] Tap "View all goals"; confirm it opens a card listing every active goal under "Active", with each row formatted exactly like the home card's Goal summary row (icon, duration, done/missed counts, streak where applicable).
- [ ] Delete a goal, then tap "View all goals"; confirm it now appears under "Completed" instead of "Active", still showing its historical stats, and confirm there is no button to restore it.
- [ ] With no deleted goals yet, tap "View all goals"; confirm the "Completed" section shows "No completed goals." rather than being blank or missing.
- [ ] Confirm "View all goals" rows have no action buttons at all (no Mark done/Edit/Delete) — purely read-only, matching the home card's Goal summary section.
