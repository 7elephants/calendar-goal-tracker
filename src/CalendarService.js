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

function buildEventTitle(goal, status) {
  var mark = status === 'success' ? '✅' : '❌';
  return goal.icon + ' ' + goal.name + ' ' + mark;
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

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    getDateKey: getDateKey,
    addDaysToDateKey: addDaysToDateKey,
    buildEventTitle: buildEventTitle,
    buildEventResource: buildEventResource,
    findEventForGoalOnDate: findEventForGoalOnDate,
    setGoalStatus: setGoalStatus,
    getGoalStatusForDate: getGoalStatusForDate,
    CALENDAR_ID: CALENDAR_ID,
    APP_TAG: APP_TAG
  };
}
