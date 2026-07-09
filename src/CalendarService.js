/**
 * ---
 * file: src/CalendarService.js
 * workflow:
 *   invocation: "Called by ActionHandlers.js after a user taps a status button or picks a date via MiscCards.js's date picker. Pure dateKey math lives in DateKeyUtils.js, required below for Jest (Apps Script needs no such require - see that file's header)."
 *   steps:
 *     - step: 1
 *       call: "buildEventResource(goal, dateKey, status)"
 *       input: "goal: Goal, dateKey: string, status: 'success'|'fail'"
 *       output: "Calendar API v3 Events resource object (all-day, colored, tagged via extendedProperties.private)"
 *     - step: 2
 *       call: "findEventForGoalOnDate(goalId, dateKey)"
 *       input: "goalId: string, dateKey: string"
 *       output: "matching Calendar API event object or null, found via Calendar.Events.list with a privateExtendedProperty filter"
 *     - step: 3
 *       call: "setGoalStatus(goal, date, status)"
 *       input: "goal: Goal, date: Date, status: 'success'|'fail'|null"
 *       output: "the created/updated event, or null when status is null and the event was removed"
 *     - step: 4
 *       call: "getGoalStatusForDate(goalId, date)"
 *       input: "goalId: string, date: Date"
 *       output: "'success' | 'fail' | null"
 *     - step: 5
 *       call: "goalHasWindow(goal)"
 *       input: "goal: Goal (with optional startDate/durationDays)"
 *       output: "true only if both startDate and a non-zero durationDays are stored; shared by getGoalWindowStatus/getGoalSummaryStats so the 'does this goal have a fixed window' check is written once. Exposed as GoalRules.isForever's negation - see src/GoalRules.js."
 *     - step: 6
 *       call: "getGoalWindowStatus(goal, dateKey)"
 *       input: "goal: Goal (with optional startDate/durationDays), dateKey: 'YYYY-MM-DD'"
 *       output: "'upcoming' | 'active' | 'completed' | null (null for goals with no window, e.g. forever goals or ones created before this feature)"
 *     - step: 7
 *       call: "getGoalSummaryStats(goal, todayDateKey)"
 *       input: "goal: Goal, todayDateKey: 'YYYY-MM-DD'"
 *       output: "{ durationDays, daysLeft, daysDone, daysMissed } for the homepage summary section; durationDays/daysLeft are null (rendered as infinite) for goals with no window. Internally paginates Calendar.Events.list via getGoalStatusCounts()."
 * ---
 */

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  var DateKeyUtils = require('./DateKeyUtils.js');
  var getDateKey = DateKeyUtils.getDateKey;
  var addDaysToDateKey = DateKeyUtils.addDaysToDateKey;
  var daysBetweenDateKeys = DateKeyUtils.daysBetweenDateKeys;
  var dateKeyToUtcMs = DateKeyUtils.dateKeyToUtcMs;
  var utcMsToDateKey = DateKeyUtils.utcMsToDateKey;
}

var CALENDAR_ID = 'primary';
var APP_TAG = 'goal-tracker';
var COLOR_ID_SUCCESS = '10'; // Basil (green)
var COLOR_ID_FAIL = '11'; // Tomato (red)

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
 * True only if goal has both a stored startDate and a non-zero durationDays
 * - i.e. it runs within a fixed window rather than forever. Shared by
 * getGoalWindowStatus/getGoalSummaryStats so this check exists once.
 */
function goalHasWindow(goal) {
  return !!(goal && goal.startDate && goal.durationDays);
}

/**
 * Where dateKey falls relative to a goal's [startDate, startDate + durationDays)
 * window. Returns null for goals with no window (forever goals, or ones
 * created before start date/duration existed) so they never show a badge.
 * dateKey strings compare correctly with plain '<' since 'YYYY-MM-DD' sorts
 * lexicographically the same as chronologically.
 */
function getGoalWindowStatus(goal, dateKey) {
  if (!goalHasWindow(goal)) {
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
  var hasWindow = goalHasWindow(goal);
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
    buildEventTitle: buildEventTitle,
    buildEventResource: buildEventResource,
    findEventForGoalOnDate: findEventForGoalOnDate,
    setGoalStatus: setGoalStatus,
    getGoalStatusForDate: getGoalStatusForDate,
    goalHasWindow: goalHasWindow,
    getGoalWindowStatus: getGoalWindowStatus,
    getGoalStatusCounts: getGoalStatusCounts,
    getGoalSummaryStats: getGoalSummaryStats,
    CALENDAR_ID: CALENDAR_ID,
    APP_TAG: APP_TAG
  };
}
