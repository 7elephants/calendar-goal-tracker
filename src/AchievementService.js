/**
 * ---
 * file: src/AchievementService.js
 * workflow:
 *   invocation: "Called by ActionHandlers.js: recordAchievements from handleMarkStatus, passed AchievementRules.detectNewAchievements()'s already-computed result (this file never calls AchievementRules itself - it only persists what it's given). listAchievements/countUnseen/markAllSeen/groupAchievementsByGoal are called from CodeHelpers.js's buildHomeCardForDate_ and handleOpenAchievementsCard. Storage-only, mirroring GoalService.js's PropertiesService read-modify-write pattern under its own key."
 *   steps:
 *     - step: 1
 *       call: "listAchievements()"
 *       input: "none"
 *       output: "Array<AchievementRecord> read from PropertiesService.getUserProperties(), oldest first. AchievementRecord: { id, goalId, goalName, goalIcon, family, threshold, label, earnedAt, seen }. goalName/goalIcon/label are snapshotted at earn time (not re-read from the goal) so a later goal rename, type change, or soft-delete never changes a past achievement's historical record - this is the only place a soft-deleted goal's achievements are still visible, same as AllGoalsCard for goals themselves."
 *     - step: 2
 *       call: "recordAchievements(goal, newlyEarned)"
 *       input: "goal: Goal, newlyEarned: AchievementRules.detectNewAchievements() result"
 *       output: "Array<AchievementRecord> - the records just appended (id: Utilities.getUuid(), earnedAt: new Date().toISOString(), seen: false), for the caller to build a celebration toast from without a second read"
 *     - step: 3
 *       call: "countUnseen()"
 *       input: "none"
 *       output: "number of stored records with seen: false - powers the Home card's unseen-achievements indicator"
 *     - step: 4
 *       call: "markAllSeen()"
 *       input: "none"
 *       output: "void; sets seen: true on every stored record in one write. Called when the Achievements card is opened, so the Home card's indicator clears on the next render."
 *     - step: 5
 *       call: "groupAchievementsByGoal(records)"
 *       input: "records: Array<AchievementRecord>"
 *       output: "Array<{ goalId, goalIcon, goalName, records }> - records grouped by goalId in first-appearance order, each group's own records sorted newest-earnedAt-first; icon/name taken from that group's newest record. Pure array transform, used by the Achievements card to lay out one section per goal."
 * ---
 */

var ACHIEVEMENTS_PROPERTY_KEY = 'ACHIEVEMENTS_V1';

function readAchievementsFromStorage() {
  var raw = PropertiesService.getUserProperties().getProperty(ACHIEVEMENTS_PROPERTY_KEY);
  if (!raw) {
    return [];
  }
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeAchievementsToStorage(records) {
  PropertiesService.getUserProperties().setProperty(ACHIEVEMENTS_PROPERTY_KEY, JSON.stringify(records));
}

function listAchievements() {
  return readAchievementsFromStorage();
}

function recordAchievements(goal, newlyEarned) {
  var records = readAchievementsFromStorage();
  var earnedAt = new Date().toISOString();
  var newRecords = newlyEarned.map(function (entry) {
    return {
      id: Utilities.getUuid(),
      goalId: goal.id,
      goalName: goal.name,
      goalIcon: goal.icon,
      family: entry.family,
      threshold: entry.threshold,
      label: entry.label,
      earnedAt: earnedAt,
      seen: false
    };
  });
  writeAchievementsToStorage(records.concat(newRecords));
  return newRecords;
}

function countUnseen() {
  return readAchievementsFromStorage().filter(function (record) {
    return record.seen === false;
  }).length;
}

function markAllSeen() {
  var records = readAchievementsFromStorage();
  records.forEach(function (record) {
    record.seen = true;
  });
  writeAchievementsToStorage(records);
}

function groupAchievementsByGoal(records) {
  var groupsByGoalId = {};
  var orderedGroups = [];

  records.forEach(function (record) {
    var group = groupsByGoalId[record.goalId];
    if (!group) {
      group = { goalId: record.goalId, goalIcon: record.goalIcon, goalName: record.goalName, records: [] };
      groupsByGoalId[record.goalId] = group;
      orderedGroups.push(group);
    }
    group.goalIcon = record.goalIcon;
    group.goalName = record.goalName;
    group.records.push(record);
  });

  orderedGroups.forEach(function (group) {
    group.records.sort(function (a, b) {
      return b.earnedAt < a.earnedAt ? -1 : b.earnedAt > a.earnedAt ? 1 : 0;
    });
  });

  return orderedGroups;
}

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    listAchievements: listAchievements,
    recordAchievements: recordAchievements,
    countUnseen: countUnseen,
    markAllSeen: markAllSeen,
    groupAchievementsByGoal: groupAchievementsByGoal,
    ACHIEVEMENTS_PROPERTY_KEY: ACHIEVEMENTS_PROPERTY_KEY
  };
}
