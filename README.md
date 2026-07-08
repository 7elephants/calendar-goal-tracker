# Goals & Habits Tracker (Google Calendar Add-on)

A Google Workspace Calendar Add-on, built with Apps Script, for tracking
daily goals/habits directly inside the Google Calendar UI. Each goal you
create gets a name and a short icon/emoji. Every day you can mark a goal as
a success or a fail, which is stored as a colored all-day event on your
primary calendar — visible right on the calendar grid, no separate app to
check.

## How it works

- Opening the add-on's side panel in Google Calendar (or opening any event)
  shows a "Goals & Habits" card listing your active goals and today's status
  for each.
- **✅ Success** / **❌ Fail** / **Clear** buttons on each goal write, update,
  or delete an all-day Calendar event for that goal on the selected day.
  Success events use Calendar's green ("Basil") color; fails use red
  ("Tomato").
- **📅 Choose day** opens a date picker so you can back-fill or review any
  day, not just today.
- **+ New goal** opens a form (name, icon, start date, and duration in days)
  and saves it to your Apps Script user properties — this is
  per-Google-account, private to you.
- Each goal has a start date and a duration (in days). This is purely
  informational: outside that window the goal shows a badge ("Starts ..." /
  "🏁 Completed") on the home card, but the Mark done / Mark missed / Clear
  buttons still work on any day regardless of the window.
- Deleting a goal only stops future tracking; it does **not** delete past
  calendar events, so your history stays intact.

Goal *definitions* (name, icon, start date, duration in days, active flag)
live in `PropertiesService.getUserProperties()`. Goal *status per day* is not
stored anywhere else — it lives entirely on the Calendar event via
`extendedProperties.private` (`goalId`, `dateKey`, `status`), so the
calendar is the single source of truth for your history. Goals created
before this feature existed have no start date/duration stored; they're
read back with no window badge and behave exactly as before.

## Project layout

```
src/            Apps Script source (pushed to Google via clasp)
  appsscript.json    Add-on manifest: scopes, Calendar advanced service, triggers
  Code.js            Trigger entry points (onHomepage, onCalendarEventOpen) + action handlers
  Cards.js           CardService UI builders
  GoalService.js     Goal CRUD, backed by PropertiesService
  CalendarService.js Calendar event read/write, backed by the advanced Calendar API service
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

**Coverage note:** `GoalService.js` and `CalendarService.js` are unit
tested with mocked `PropertiesService`/`Calendar` globals and currently sit
at ~97-100% line coverage. `Code.js` and `Cards.js` are intentionally
excluded from coverage collection (see `jest.config.js`) because they are
thin wiring around `CardService` and Calendar add-on trigger objects
(`e.parameters`, `e.formInput`, card navigation) that only exist inside a
live Google Calendar session with a real OAuth-authenticated add-on
install. There is no way to instantiate `CardService` outside that runtime,
so 100% coverage of those two files isn't achievable with Jest — they're
covered by the manual test plan below instead.

### Manual test plan (run after `npm run push` + reload the add-on)

- [ ] Create a goal with a name, an emoji icon, a start date, and a duration; it appears on the home card.
- [ ] Mark it "Mark done" for today; a green all-day event with the icon+name+✅ appears on today's date in Calendar.
- [ ] Mark it "Mark missed" for today; the same event turns red and updates to ❌ (no duplicate event created).
- [ ] Click "Clear"; the event is removed from the calendar.
- [ ] Use "Choose day" to jump to a past date and set a status there; confirm it lands on the correct date.
- [ ] Create a second goal, confirm both show independently with independent statuses per day.
- [ ] Delete a goal; confirm it disappears from the home card but its past calendar events remain.
- [ ] Submit the "New goal" form with an empty name; confirm a validation error notification appears and no goal is created.
- [ ] Submit the "New goal" form with a duration of 0 or blank; confirm a validation error notification appears.
- [ ] Create a goal with a start date in the future; confirm the home card shows a "Starts ..." badge and Mark done/Mark missed still work.
- [ ] Create a goal with a past start date and a short duration so the window has already elapsed; confirm a "🏁 Completed" badge appears and Mark done/Mark missed still work.
- [ ] Reload Calendar entirely and reopen the add-on; confirm goals and today's statuses persist (PropertiesService + Calendar are both durable).
