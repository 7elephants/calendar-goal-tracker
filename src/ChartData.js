/**
 * ---
 * file: src/ChartData.js
 * workflow:
 *   invocation: "Pure chart-math helpers with no Apps Script service dependency, mirroring DateKeyUtils.js. buildDailySeries/labelGoalsByIcon are called by CodeHelpers.js's buildGraphsCardForRange_ (via its buildSeriesList_ helper) to turn a goal's getGoalStatusByDate() map into per-day chart series. presetRange is called both by CodeHelpers.js's resolveGraphsRange_ (a preset button click) and directly by ActionHandlers.js's handleOpenGraphsCard (the current-month default on first open)."
 *   steps:
 *     - step: 1
 *       call: "buildDailySeries(statusByDate, fromDateKey, toDateKeyExclusive, complianceWindow)"
 *       input: "statusByDate: { dateKey: 'success'|'fail' } (as returned by CalendarService.getGoalStatusByDate), fromDateKey/toDateKeyExclusive: 'YYYY-MM-DD', complianceWindow: optional { startDateKey, endDateKeyExclusive } (as returned by CalendarService.getGoalComplianceWindow / GoalRules.complianceWindow)"
 *       output: "{ dateKeys, cumulativeCount, compliancePct } - three equal-length arrays, one entry per day in [fromDateKey, toDateKeyExclusive). cumulativeCount resets to 0 at fromDateKey (not a lifetime total) and increments on each 'success' day, regardless of complianceWindow - it's only ever used for the Count-only chart, which this feature doesn't touch. compliancePct is successCount-so-far / days-elapsed-so-far * 100 (rounded) counted only over days within complianceWindow when one is given; a day outside it (before the goal started, or on/after its end) is neither a hit nor a miss - it's excluded from both the running numerator and denominator, and comes back as null so the caller can render a gap there instead of a value. Omitting complianceWindow preserves the original whole-range behavior exactly."
 *     - step: 2
 *       call: "presetRange(presetId, todayDateKey)"
 *       input: "presetId: 'thisMonth' | 'last30' | 'thisYear' (anything else falls back to 'thisMonth'), todayDateKey: 'YYYY-MM-DD'"
 *       output: "{ fromDateKey, toDateKeyExclusive } spanning the current calendar month / trailing 30 days (inclusive of today) / current calendar year"
 *     - step: 3
 *       call: "labelGoalsByIcon(goals)"
 *       input: "goals: Array<Goal>"
 *       output: "Array<string> of the same length/order, one label per goal for use as a chart legend entry. Goal names are never shown outside the Edit form elsewhere in this add-on, so labels are icon-only; when two goals share an icon (icons aren't unique), later ones get a ' (2)', ' (3)', ... suffix so the legend never has indistinguishable duplicate entries."
 * ---
 */

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  var DateKeyUtils = require('./DateKeyUtils.js');
  var addDaysToDateKey = DateKeyUtils.addDaysToDateKey;
  var getDateKey = DateKeyUtils.getDateKey;
}

/**
 * Walks each day in [fromDateKey, toDateKeyExclusive) once, deriving both
 * chart series from the same walk so a goal's status map is only walked a
 * single time per range. cumulativeCount and compliancePct are tracked with
 * separate running counters: cumulativeCount's counts unconditionally,
 * while compliancePct's only advance on days inside complianceWindow (when
 * given), so a goal's own start/end can gate the % chart without touching
 * the count chart's semantics at all.
 */
function buildDailySeries(statusByDate, fromDateKey, toDateKeyExclusive, complianceWindow) {
  var dateKeys = [];
  var cumulativeCount = [];
  var compliancePct = [];
  var runningSuccessCount = 0;
  var complianceSuccessCount = 0;
  var complianceElapsed = 0;
  var dateKey = fromDateKey;

  while (dateKey < toDateKeyExclusive) {
    var isSuccess = statusByDate[dateKey] === 'success';
    if (isSuccess) {
      runningSuccessCount++;
    }
    dateKeys.push(dateKey);
    cumulativeCount.push(runningSuccessCount);

    var withinComplianceWindow =
      !complianceWindow ||
      (dateKey >= complianceWindow.startDateKey &&
        (!complianceWindow.endDateKeyExclusive || dateKey < complianceWindow.endDateKeyExclusive));
    if (withinComplianceWindow) {
      complianceElapsed++;
      if (isSuccess) {
        complianceSuccessCount++;
      }
      compliancePct.push(Math.round((complianceSuccessCount / complianceElapsed) * 100));
    } else {
      compliancePct.push(null);
    }

    dateKey = addDaysToDateKey(dateKey, 1);
  }

  return { dateKeys: dateKeys, cumulativeCount: cumulativeCount, compliancePct: compliancePct };
}

function firstOfMonthDateKey(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return getDateKey(new Date(parts[0], parts[1] - 1, 1));
}

// JS Date rolls month 12 over into January of the following year on its own.
function firstOfNextMonthDateKey(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return getDateKey(new Date(parts[0], parts[1], 1));
}

function firstOfYearDateKey(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return getDateKey(new Date(parts[0], 0, 1));
}

function firstOfNextYearDateKey(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return getDateKey(new Date(parts[0] + 1, 0, 1));
}

function presetRange(presetId, todayDateKey) {
  switch (presetId) {
    case 'last30':
      return { fromDateKey: addDaysToDateKey(todayDateKey, -29), toDateKeyExclusive: addDaysToDateKey(todayDateKey, 1) };
    case 'last90':
      return { fromDateKey: addDaysToDateKey(todayDateKey, -89), toDateKeyExclusive: addDaysToDateKey(todayDateKey, 1) };
    case 'thisYear':
      return {
      fromDateKey: firstOfYearDateKey(todayDateKey),
      toDateKeyExclusive: firstOfNextYearDateKey(todayDateKey)
    };
    default:
      return {
    fromDateKey: firstOfMonthDateKey(todayDateKey),
    toDateKeyExclusive: firstOfNextMonthDateKey(todayDateKey)
  };
  }
}

function labelGoalsByIcon(goals) {
  var seenCounts = {};
  return goals.map(function (goal) {
    var count = (seenCounts[goal.icon] = (seenCounts[goal.icon] || 0) + 1);
    return count === 1 ? goal.icon : goal.icon + ' (' + count + ')';
  });
}

var ChartData = {
  buildDailySeries: buildDailySeries,
  presetRange: presetRange,
  labelGoalsByIcon: labelGoalsByIcon
};

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = ChartData;
}
