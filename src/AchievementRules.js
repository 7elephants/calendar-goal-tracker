/**
 * ---
 * file: src/AchievementRules.js
 * workflow:
 *   invocation: "Pure achievement-catalog + detection logic, no Apps Script service dependency. Called only by ActionHandlers.js's handleMarkStatus (via AchievementService.js's recordAchievements, which persists what this file detects) to find newly-crossed thresholds after a goal's status changes, and to build the celebration toast text for them."
 *   steps:
 *     - step: 1
 *       call: "ACHIEVEMENT_CATALOG"
 *       input: "none (constant)"
 *       output: "Array of achievement families, each { family, appliesTo(goal), metric(stats), thresholds, label(threshold) }. 'streak' (Pass/Fail goals only, GoalRules.isCountOnly false): stats.currentStreak against [7, 30, 100]. 'count' (Count only goals only): stats.daysDone against [10, 50, 100]. 'progress' (any goal with a fixed duration, GoalRules.isForever false): (stats.daysDone / stats.durationDays) * 100 against [50, 100] - null (skipped entirely) for forever goals, whose durationDays is null."
 *     - step: 2
 *       call: "detectNewAchievements(goal, beforeStats, afterStats)"
 *       input: "goal: Goal, beforeStats/afterStats: CalendarService.getGoalSummaryStats() results for the same goal/day, taken immediately before and after a single mutation"
 *       output: "Array<{ family, threshold, label }> - one entry per threshold that afterStats newly crosses (beforeMetric < threshold <= afterMetric) for every catalog family that applies to this goal. Edge-triggered, not a snapshot of 'currently above': a metric that was already above a threshold before this action, or that decreases (e.g. Clear/Fail), never re-fires - but a streak that broke and later re-crosses the same threshold fires again, since it's re-earnable by design."
 *     - step: 3
 *       call: "celebrationText(newlyEarned)"
 *       input: "newlyEarned: detectNewAchievements() result"
 *       output: "'' for an empty array (caller falls back to the plain 'Saved.' notification); a single '🎉 <label>!' for exactly one; '🎉 N new achievements!' for two or more, since a mark can cross multiple families/thresholds at once (e.g. a streak and a progress milestone together) and the toast stays short rather than concatenating every label"
 * ---
 */

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  var GoalRules = require('./GoalRules.js');
}

var ACHIEVEMENT_CATALOG = [
  {
    family: 'streak',
    appliesTo: function (goal) {
      return !GoalRules.isCountOnly(goal);
    },
    metric: function (stats) {
      return stats.currentStreak;
    },
    thresholds: [7, 30, 100],
    label: function (threshold) {
      return '🔥 ' + threshold + '-day streak';
    }
  },
  {
    family: 'count',
    appliesTo: function (goal) {
      return GoalRules.isCountOnly(goal);
    },
    metric: function (stats) {
      return stats.daysDone;
    },
    thresholds: [10, 50, 100],
    label: function (threshold) {
      return '✅ ' + threshold + ' days done';
    }
  },
  {
    family: 'progress',
    appliesTo: function (goal) {
      return !GoalRules.isForever(goal);
    },
    metric: function (stats) {
      return stats.durationDays ? (stats.daysDone / stats.durationDays) * 100 : null;
    },
    thresholds: [50, 100],
    label: function (threshold) {
      return (threshold === 100 ? '🏁 ' : '🎯 ') + threshold + '% complete';
    }
  }
];

function detectNewAchievements(goal, beforeStats, afterStats) {
  var newlyEarned = [];
  ACHIEVEMENT_CATALOG.forEach(function (row) {
    if (!row.appliesTo(goal)) {
      return;
    }
    var before = row.metric(beforeStats);
    var after = row.metric(afterStats);
    if (before === null || after === null) {
      return;
    }
    row.thresholds.forEach(function (threshold) {
      if (before < threshold && after >= threshold) {
        newlyEarned.push({ family: row.family, threshold: threshold, label: row.label(threshold) });
      }
    });
  });
  return newlyEarned;
}

function celebrationText(newlyEarned) {
  if (newlyEarned.length === 0) {
    return '';
  }
  if (newlyEarned.length === 1) {
    return '🎉 ' + newlyEarned[0].label + '!';
  }
  return '🎉 ' + newlyEarned.length + ' new achievements!';
}

var AchievementRules = {
  ACHIEVEMENT_CATALOG: ACHIEVEMENT_CATALOG,
  detectNewAchievements: detectNewAchievements,
  celebrationText: celebrationText
};

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = AchievementRules;
}
