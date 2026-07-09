/**
 * ---
 * file: src/DateKeyUtils.js
 * workflow:
 *   invocation: "Pure dateKey helpers with no Apps Script service dependency. Called directly by CalendarService.js, GoalFormCard.js, MiscCards.js, CodeHelpers.js, and ActionHandlers.js, since all of them work in terms of 'YYYY-MM-DD' dateKey strings."
 *   steps:
 *     - step: 1
 *       call: "getDateKey(date)"
 *       input: "JS Date object"
 *       output: "'YYYY-MM-DD' string used as both the Calendar all-day event date and the extendedProperties lookup key"
 *     - step: 2
 *       call: "addDaysToDateKey(dateKey, days)"
 *       input: "dateKey: 'YYYY-MM-DD', days: integer (may be negative)"
 *       output: "the resulting 'YYYY-MM-DD' dateKey, rolling over month/year boundaries"
 *     - step: 3
 *       call: "daysBetweenDateKeys(fromDateKey, toDateKeyExclusive)"
 *       input: "two 'YYYY-MM-DD' dateKeys"
 *       output: "whole calendar days between them (toDateKeyExclusive - fromDateKey)"
 *     - step: 4
 *       call: "dateKeyToUtcMs(dateKey) / utcMsToDateKey(ms)"
 *       input: "'YYYY-MM-DD' string, or epoch ms"
 *       output: "the inverse value. Used only for the CardService DatePicker round trip, which is UTC-based regardless of the script's timezone — kept separate from getDateKey (local time) to avoid an off-by-one-day bug."
 * ---
 */

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

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    getDateKey: getDateKey,
    addDaysToDateKey: addDaysToDateKey,
    daysBetweenDateKeys: daysBetweenDateKeys,
    dateKeyToUtcMs: dateKeyToUtcMs,
    utcMsToDateKey: utcMsToDateKey
  };
}
