# calendar-goal-tracker

Google Calendar add-on (Apps Script) for tracking daily goals/habits as
all-day events on the primary calendar. Follows the 7elephants, LLC global
conventions in `~/.claude/CLAUDE.md` (branching, commit cadence, project
structure, testing bar, GitHub-remote and code-reviewer prompts).

## Project-specific notes

- This is a Google Workspace **Calendar Add-on**, not a normal Node app.
  Source in `src/` is pushed to Google's Apps Script runtime via `clasp`
  (see `docs/README.md` for the login/create/push/install flow) — it does
  not run locally.
- Apps Script has no ES module system: every `src/*.js` file shares one
  global namespace. Functions are declared globally on purpose (this is
  idiomatic Apps Script, not a design smell).
- Each `src/*.js` file ends with a guarded `if (typeof module !== 'undefined')
  module.exports = {...}` block. This is inert in the Apps Script runtime
  (`module` is undefined there) and exists solely so Jest can `require()`
  the pure-logic functions for unit tests.
- `src/Code.js` and `src/Cards.js` are intentionally excluded from Jest
  coverage collection (see `jest.config.js`) because they are thin wiring
  around `CardService`/trigger objects that only exist inside a live Google
  Calendar session — they cannot be meaningfully unit tested without OAuth.
  They are covered by the manual test plan in `docs/README.md` instead.
- Goal definitions live in `PropertiesService.getUserProperties()`
  (`GoalService.js`). Day-by-day success/fail state is **not** duplicated in
  storage — it lives entirely on the Calendar event itself via
  `extendedProperties.private` (see `CalendarService.js`), so the calendar
  stays the single source of truth for status.
