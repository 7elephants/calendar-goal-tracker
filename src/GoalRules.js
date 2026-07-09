/**
 * ---
 * file: src/GoalRules.js
 * workflow:
 *   invocation: "A thin, one-directional namespace object grouping goal-first-arg logic that already lives in CalendarService.js, for a more 'objectified' call style at consumption sites (HomeCard.js, CodeHelpers.js). Goals themselves stay plain objects - nothing here wraps or unwraps stored data."
 *   steps:
 *     - step: 1
 *       call: "GoalRules.windowStatus(goal, dateKey)"
 *       input: "same as CalendarService.getGoalWindowStatus, which this aliases directly"
 *       output: "'upcoming' | 'active' | 'completed' | null"
 *     - step: 2
 *       call: "GoalRules.summaryStats(goal, todayDateKey)"
 *       input: "same as CalendarService.getGoalSummaryStats, which this aliases directly"
 *       output: "{ durationDays, daysLeft, daysDone, daysMissed }"
 *     - step: 3
 *       call: "GoalRules.isForever(goal)"
 *       input: "goal: Goal"
 *       output: "true if the goal has no fixed window (durationDays: 0, or missing entirely) - the negation of CalendarService.goalHasWindow"
 * ---
 */

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  var CalendarService = require('./CalendarService.js');
  var getGoalWindowStatus = CalendarService.getGoalWindowStatus;
  var getGoalSummaryStats = CalendarService.getGoalSummaryStats;
  var goalHasWindow = CalendarService.goalHasWindow;
}

function isForever(goal) {
  return !goalHasWindow(goal);
}

var GoalRules = {
  windowStatus: getGoalWindowStatus,
  summaryStats: getGoalSummaryStats,
  isForever: isForever
};

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = GoalRules;
}
