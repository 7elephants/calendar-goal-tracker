/**
 * ---
 * file: src/ChartData.js
 * workflow:
 *   invocation: "Pure chart-math helpers with no Apps Script service dependency, mirroring DateKeyUtils.js. buildDailySeries/labelGoalsByIcon are called by CodeHelpers.js's buildGraphsCardForRange_ (via its buildSeriesList_ helper) to turn a goal's getGoalStatusByDate() map into per-day chart series. presetRange is called both by CodeHelpers.js's resolveGraphsRange_ (a preset button click) and directly by ActionHandlers.js's handleOpenGraphsCard (the current-month default on first open)."
 *   steps:
 *     - step: 1
 *       call: "buildDailySeries(statusByDate, fromDateKey, toDateKeyExclusive)"
 *       input: "statusByDate: { dateKey: 'success'|'fail' } (as returned by CalendarService.getGoalStatusByDate), fromDateKey/toDateKeyExclusive: 'YYYY-MM-DD'"
 *       output: "{ dateKeys, cumulativeCount, compliancePct } - three equal-length arrays, one entry per day in [fromDateKey, toDateKeyExclusive). cumulativeCount resets to 0 at fromDateKey (not a lifetime total) and increments on each 'success' day. compliancePct is successCount-so-far / days-elapsed-so-far * 100, rounded - an unmarked or 'fail' day leaves the numerator flat while the denominator grows, so it drags the running percentage down."
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
 * chart series from the same running successCount so a goal's status map is
 * only walked a single time per range.
 */
function buildDailySeries(statusByDate, fromDateKey, toDateKeyExclusive) {
  var dateKeys = [];
  var cumulativeCount = [];
  var compliancePct = [];
  var successCount = 0;
  var elapsed = 0;
  var dateKey = fromDateKey;

  while (dateKey < toDateKeyExclusive) {
    elapsed++;
    if (statusByDate[dateKey] === 'success') {
      successCount++;
    }
    dateKeys.push(dateKey);
    cumulativeCount.push(successCount);
    compliancePct.push(Math.round((successCount / elapsed) * 100));
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
  if (presetId === 'last30') {
    return { fromDateKey: addDaysToDateKey(todayDateKey, -29), toDateKeyExclusive: addDaysToDateKey(todayDateKey, 1) };
  }
  if (presetId === 'thisYear') {
    return {
      fromDateKey: firstOfYearDateKey(todayDateKey),
      toDateKeyExclusive: firstOfNextYearDateKey(todayDateKey)
    };
  }
  return {
    fromDateKey: firstOfMonthDateKey(todayDateKey),
    toDateKeyExclusive: firstOfNextMonthDateKey(todayDateKey)
  };
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
