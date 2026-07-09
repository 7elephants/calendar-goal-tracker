/**
 * ---
 * file: src/GoalService.js
 * workflow:
 *   invocation: "Called by ActionHandlers.js/CodeHelpers.js and GoalFormCard.js; never invoked directly by a trigger."
 *   steps:
 *     - step: 1
 *       call: "validateGoalInput(input)"
 *       input: "{ name: string, icon: string, startDate: 'YYYY-MM-DD', durationDays: integer }"
 *       output: "throws Error on invalid input, otherwise returns void"
 *     - step: 2
 *       call: "listGoals()"
 *       input: "none"
 *       output: "Array<Goal> read from PropertiesService.getUserProperties()"
 *     - step: 3
 *       call: "createGoal(input)"
 *       input: "{ name: string, icon: string, startDate: 'YYYY-MM-DD', durationDays: integer }"
 *       output: "newly created Goal object, persisted to user properties"
 *     - step: 4
 *       call: "updateGoal(goalId, updates)"
 *       input: "goalId: string, updates: Partial<Goal>"
 *       output: "updated Goal object, persisted to user properties; throws if the goal has been soft-deleted (active: false)"
 *     - step: 5
 *       call: "deleteGoal(goalId)"
 *       input: "goalId: string"
 *       output: "boolean, true if a matching goal exists (soft-deleted in place by setting active: false - no data is ever removed, and there is no restore path); false only if no goal with that id exists"
 * ---
 */

var GOALS_PROPERTY_KEY = 'GOALS_V1';
var MAX_DURATION_DAYS = 3650;
var DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True if dateKey is both shaped like YYYY-MM-DD and a real calendar date
 * (rejects e.g. 2026-02-30). Kept dependency-free (no Apps Script Utilities)
 * so validateGoalInput stays unit-testable without mocks.
 */
function isValidDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !DATE_KEY_PATTERN.test(dateKey)) {
    return false;
  }
  var parts = dateKey.split('-').map(Number);
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getFullYear() === parts[0] && d.getMonth() === parts[1] - 1 && d.getDate() === parts[2];
}

/**
 * Throws if the goal input is invalid. Kept dependency-free so it can be
 * unit tested without any Apps Script services.
 */
function validateGoalInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Goal input is required.');
  }
  var name = (input.name || '').trim();
  var icon = (input.icon || '').trim();
  if (!name) {
    throw new Error('Goal name is required.');
  }
  if (name.length > 60) {
    throw new Error('Goal name must be 60 characters or fewer.');
  }
  if (!icon) {
    throw new Error('Goal icon (emoji or short text) is required.');
  }
  // Array.from splits on code points rather than UTF-16 units, so compound
  // emoji (skin-tone modifiers, ZWJ sequences like family/profession emoji)
  // aren't rejected just for being multi-unit under .length.
  if (Array.from(icon).length > 4) {
    throw new Error('Goal icon must be 4 characters or fewer (emoji recommended).');
  }
  if (!isValidDateKey(input.startDate)) {
    throw new Error('A valid start date is required.');
  }
  if (
    typeof input.durationDays !== 'number' ||
    !Number.isInteger(input.durationDays) ||
    input.durationDays < 0 ||
    input.durationDays > MAX_DURATION_DAYS
  ) {
    throw new Error(
      'Duration must be a whole number of days between 0 and ' + MAX_DURATION_DAYS + ' (0 = forever).'
    );
  }
}

function readGoalsFromStorage() {
  var raw = PropertiesService.getUserProperties().getProperty(GOALS_PROPERTY_KEY);
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

function writeGoalsToStorage(goals) {
  PropertiesService.getUserProperties().setProperty(GOALS_PROPERTY_KEY, JSON.stringify(goals));
}

function listGoals() {
  return readGoalsFromStorage();
}

function getGoal(goalId) {
  var goals = readGoalsFromStorage();
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].id === goalId) {
      return goals[i];
    }
  }
  return null;
}

function createGoal(input) {
  validateGoalInput(input);
  var goals = readGoalsFromStorage();
  // id must always be server-generated via Utilities.getUuid(). Calendar
  // events are tagged by goalId (see CalendarService.js); accepting a
  // client-supplied id here could let a new goal collide with stale,
  // untracked events left behind by a deleted goal of the same id.
  var goal = {
    id: Utilities.getUuid(),
    name: input.name.trim(),
    icon: input.icon.trim(),
    startDate: input.startDate,
    durationDays: input.durationDays,
    active: true,
    createdAt: new Date().toISOString()
  };
  goals.push(goal);
  writeGoalsToStorage(goals);
  return goal;
}

/**
 * Updates a goal's editable fields. Throws if the goal has been soft-deleted
 * (active: false, set only by deleteGoal) - once deleted, a goal's data is
 * frozen; there is no restore path, so this is a hard stop rather than a
 * partial-update guard.
 */
function updateGoal(goalId, updates) {
  var goals = readGoalsFromStorage();
  var target = null;
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].id === goalId) {
      target = goals[i];
      break;
    }
  }
  if (!target) {
    throw new Error('Goal not found: ' + goalId);
  }
  if (target.active === false) {
    throw new Error('This goal has been deleted and can no longer be changed.');
  }

  if (updates && typeof updates.name === 'string') {
    target.name = updates.name.trim();
  }
  if (updates && typeof updates.icon === 'string') {
    target.icon = updates.icon.trim();
  }
  if (updates && typeof updates.startDate === 'string') {
    target.startDate = updates.startDate;
  }
  if (updates && typeof updates.durationDays === 'number') {
    target.durationDays = updates.durationDays;
  }
  validateGoalInput(target);
  writeGoalsToStorage(goals);
  return target;
}

/**
 * Soft-deletes a goal: marks it active: false rather than removing its
 * record, so its data (and, separately, its past Calendar events) is never
 * lost. Bypasses updateGoal's "already deleted" guard so calling this twice
 * on the same goal is a harmless no-op. Returns false only when no goal with
 * that id exists at all.
 */
function deleteGoal(goalId) {
  var goals = readGoalsFromStorage();
  var target = null;
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].id === goalId) {
      target = goals[i];
      break;
    }
  }
  if (!target) {
    return false;
  }
  target.active = false;
  writeGoalsToStorage(goals);
  return true;
}

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    validateGoalInput: validateGoalInput,
    listGoals: listGoals,
    getGoal: getGoal,
    createGoal: createGoal,
    updateGoal: updateGoal,
    deleteGoal: deleteGoal,
    GOALS_PROPERTY_KEY: GOALS_PROPERTY_KEY
  };
}
