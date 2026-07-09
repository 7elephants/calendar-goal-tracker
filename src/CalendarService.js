/**
 * ---
 * file: src/CalendarService.js
 * workflow:
 *   invocation: "Called by Code.js action handlers after a user taps a status button or picks a date in Cards.js."
 *   steps:
 *     - step: 1
 *       call: "getDateKey(date)"
 *       input: "JS Date object"
 *       output: "'YYYY-MM-DD' string used as both the Calendar all-day event date and the extendedProperties lookup key"
 *     - step: 2
 *       call: "buildEventResource(goal, dateKey, status)"
 *       input: "goal: Goal, dateKey: string, status: 'success'|'fail'"
 *       output: "Calendar API v3 Events resource object (all-day, colored, tagged via extendedProperties.private)"
 *     - step: 3
 *       call: "findEventForGoalOnDate(goalId, dateKey)"
 *       input: "goalId: string, dateKey: string"
 *       output: "matching Calendar API event object or null, found via Calendar.Events.list with a privateExtendedProperty filter"
 *     - step: 4
 *       call: "setGoalStatus(goal, date, status)"
 *       input: "goal: Goal, date: Date, status: 'success'|'fail'|null"
 *       output: "the created/updated event, or null when status is null and the event was removed"
 *     - step: 5
 *       call: "getGoalStatusForDate(goalId, date)"
 *       input: "goalId: string, date: Date"
 *       output: "'success' | 'fail' | null"
 *     - step: 6
 *       call: "dateKeyToUtcMs(dateKey) / utcMsToDateKey(ms)"
 *       input: "'YYYY-MM-DD' string, or epoch ms"
 *       output: "the inverse value. Used only for the CardService DatePicker round trip, which is UTC-based regardless of the script's timezone (see Cards.js/Code.js) — kept separate from getDateKey (local time) to avoid an off-by-one-day bug."
 *     - step: 7
 *       call: "getGoalWindowStatus(goal, dateKey)"
 *       input: "goal: Goal (with optional startDate/durationDays), dateKey: 'YYYY-MM-DD'"
 *       output: "'upcoming' | 'active' | 'completed' | null (null for goals with no stored startDate/durationDays, e.g. created before this feature)"
 *     - step: 8
 *       call: "getGoalSummaryStats(goal, todayDateKey)"
 *       input: "goal: Goal, todayDateKey: 'YYYY-MM-DD'"
 *       output: "{ durationDays, daysLeft, daysDone, daysMissed } for the homepage summary section; durationDays/daysLeft are null (rendered as infinite) for goals with no stored durationDays. Internally paginates Calendar.Events.list via getGoalStatusCounts()."
 * ---
 */

var CALENDAR_ID = 'primary';
var APP_TAG = 'goal-tracker';
var COLOR_ID_SUCCESS = '10'; // Basil (green)
var COLOR_ID_FAIL = '11'; // Tomato (red)

/**
 * Formats a Date as a Calendar all-day-event date string. Pure function,
 * deliberately independent of any Apps Script service so it can be unit tested.
 */
function getDateKey(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function addDaysToDateKey(dateKey, days) {
  var parts = dateKey.split('-').map(Number);
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  return getDateKey(d);
}

/**
 * Whole calendar days between two dateKeys (toDateKeyExclusive - fromDateKey).
 * Pure function; Math.round (not floor) absorbs the +/-1hr DST days can have
 * when represented as local midnight Date objects.
 */
function daysBetweenDateKeys(fromDateKey, toDateKeyExclusive) {
  var fromParts = fromDateKey.split('-').map(Number);
  var toParts = toDateKeyExclusive.split('-').map(Number);
  var fromDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
  var toDate = new Date(toParts[0], toParts[1] - 1, toParts[2]);
  return Math.round((toDate - fromDate) / (24 * 60 * 60 * 1000));
}

/**
 * CardService's DatePicker widget stores/returns its value as UTC midnight
 * for the displayed day, regardless of the script's timezone. Use these two
 * functions (not getDateKey, which is local-time) whenever converting to/from
 * a DatePicker's epoch-ms value, or the selected day will be off by one in
 * any timezone west of UTC.
 */
function dateKeyToUtcMs(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function utcMsToDateKey(ms) {
  var d = new Date(ms);
  var year = d.getUTCFullYear();
  var month = String(d.getUTCMonth() + 1).padStart(2, '0');
  var day = String(d.getUTCDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function buildEventTitle(goal, status) {
  var mark = status === 'success' ? '✅' : '❌';
  return goal.icon + ' ' + mark;
}

/**
 * Builds the Calendar API v3 event resource for a goal/day/status combination.
 * Pure function: takes plain data in, returns a plain object, no API calls.
 */
function buildEventResource(goal, dateKey, status) {
  return {
    summary: buildEventTitle(goal, status),
    start: { date: dateKey },
    end: { date: addDaysToDateKey(dateKey, 1) },
    colorId: status === 'success' ? COLOR_ID_SUCCESS : COLOR_ID_FAIL,
    extendedProperties: {
      private: {
        app: APP_TAG,
        goalId: goal.id,
        dateKey: dateKey,
        status: status
      }
    }
  };
}

function findEventForGoalOnDate(goalId, dateKey) {
  // maxResults: 1 is safe only because the (app, goalId, dateKey) triple is
  // meant to be unique — there should be at most one live tagged event per
  // goal per day.
  var response = Calendar.Events.list(CALENDAR_ID, {
    privateExtendedProperty: ['app=' + APP_TAG, 'goalId=' + goalId, 'dateKey=' + dateKey],
    singleEvents: true,
    maxResults: 1
  });
  if (response.items && response.items.length > 0) {
    return response.items[0];
  }
  return null;
}

/**
 * Creates, updates, or removes the all-day status event for a goal on a given day.
 * status === null clears any existing status event for that day.
 *
 * Known limitation: this is a find-then-write, not an atomic upsert. Two
 * overlapping calls for the same goal/day (e.g. a double-click before the
 * card re-renders) can both miss the "existing" check and each insert their
 * own event, leaving a duplicate. There is no dedup pass on read today;
 * findEventForGoalOnDate would just return one of the duplicates.
 */
function setGoalStatus(goal, date, status) {
  var dateKey = getDateKey(date);
  var existing = findEventForGoalOnDate(goal.id, dateKey);

  if (status === null) {
    if (existing) {
      Calendar.Events.remove(CALENDAR_ID, existing.id);
    }
    return null;
  }

  var resource = buildEventResource(goal, dateKey, status);
  if (existing) {
    return Calendar.Events.update(resource, CALENDAR_ID, existing.id);
  }
  return Calendar.Events.insert(resource, CALENDAR_ID);
}

function getGoalStatusForDate(goalId, date) {
  var dateKey = getDateKey(date);
  var event = findEventForGoalOnDate(goalId, dateKey);
  if (!event || !event.extendedProperties || !event.extendedProperties.private) {
    return null;
  }
  return event.extendedProperties.private.status || null;
}

/**
 * Where dateKey falls relative to a goal's [startDate, startDate + durationDays)
 * window. Returns null for goals created before start date/duration existed
 * (no startDate or durationDays stored) so legacy goals never show a badge.
 * dateKey strings compare correctly with plain '<' since 'YYYY-MM-DD' sorts
 * lexicographically the same as chronologically.
 */
function getGoalWindowStatus(goal, dateKey) {
  if (!goal || !goal.startDate || !goal.durationDays) {
    return null;
  }
  if (dateKey < goal.startDate) {
    return 'upcoming';
  }
  var endDateKeyExclusive = addDaysToDateKey(goal.startDate, goal.durationDays);
  if (dateKey < endDateKeyExclusive) {
    return 'active';
  }
  return 'completed';
}

/**
 * Tallies success/fail status events for a goal within [fromDateKey,
 * toDateKeyExclusive), paginating through Calendar.Events.list since a
 * long-running goal can have more results than one page returns.
 */
function getGoalStatusCounts(goalId, fromDateKey, toDateKeyExclusive) {
  var counts = { success: 0, fail: 0 };
  var pageToken;
  do {
    var response = Calendar.Events.list(CALENDAR_ID, {
      privateExtendedProperty: ['app=' + APP_TAG, 'goalId=' + goalId],
      singleEvents: true,
      timeMin: new Date(dateKeyToUtcMs(fromDateKey)).toISOString(),
      timeMax: new Date(dateKeyToUtcMs(toDateKeyExclusive)).toISOString(),
      maxResults: 2500,
      pageToken: pageToken
    });
    (response.items || []).forEach(function (event) {
      var status = event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.status;
      if (status === 'success') {
        counts.success++;
      } else if (status === 'fail') {
        counts.fail++;
      }
    });
    pageToken = response.nextPageToken;
  } while (pageToken);
  return counts;
}

/**
 * Lifetime summary stats for a goal, used by the homepage summary section.
 * Goals with a stored startDate+durationDays report durationDays/daysLeft
 * (daysLeft clamped to >=0, counted from whichever is later: today or the
 * goal's start). Goals with no stored durationDays (only possible for goals
 * created before that field existed) are treated as running forever:
 * durationDays/daysLeft come back null (the caller renders that as "∞"),
 * and daysDone/daysMissed are tallied from startDate (or createdAt, for
 * goals that predate startDate too) through today.
 */
function getGoalSummaryStats(goal, todayDateKey) {
  var hasWindow = !!(goal.startDate && goal.durationDays);
  var rangeStart = goal.startDate || getDateKey(new Date(goal.createdAt));
  var rangeEndExclusive = hasWindow
    ? addDaysToDateKey(goal.startDate, goal.durationDays)
    : addDaysToDateKey(todayDateKey, 1);

  var counts = getGoalStatusCounts(goal.id, rangeStart, rangeEndExclusive);

  var daysLeft = null;
  if (hasWindow) {
    var from = todayDateKey > rangeStart ? todayDateKey : rangeStart;
    daysLeft = Math.max(0, daysBetweenDateKeys(from, rangeEndExclusive));
  }

  return {
    durationDays: hasWindow ? goal.durationDays : null,
    daysLeft: daysLeft,
    daysDone: counts.success,
    daysMissed: counts.fail
  };
}

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    getDateKey: getDateKey,
    addDaysToDateKey: addDaysToDateKey,
    dateKeyToUtcMs: dateKeyToUtcMs,
    utcMsToDateKey: utcMsToDateKey,
    buildEventTitle: buildEventTitle,
    buildEventResource: buildEventResource,
    findEventForGoalOnDate: findEventForGoalOnDate,
    setGoalStatus: setGoalStatus,
    getGoalStatusForDate: getGoalStatusForDate,
    getGoalWindowStatus: getGoalWindowStatus,
    daysBetweenDateKeys: daysBetweenDateKeys,
    getGoalStatusCounts: getGoalStatusCounts,
    getGoalSummaryStats: getGoalSummaryStats,
    CALENDAR_ID: CALENDAR_ID,
    APP_TAG: APP_TAG
  };
}
