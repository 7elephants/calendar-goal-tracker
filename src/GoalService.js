/**
 * ---
 * file: src/GoalService.js
 * workflow:
 *   invocation: "Called by Cards.js and Code.js action handlers; never invoked directly by a trigger."
 *   steps:
 *     - step: 1
 *       call: "validateGoalInput(input)"
 *       input: "{ name: string, icon: string }"
 *       output: "throws Error on invalid input, otherwise returns void"
 *     - step: 2
 *       call: "listGoals()"
 *       input: "none"
 *       output: "Array<Goal> read from PropertiesService.getUserProperties()"
 *     - step: 3
 *       call: "createGoal(input)"
 *       input: "{ name: string, icon: string }"
 *       output: "newly created Goal object, persisted to user properties"
 *     - step: 4
 *       call: "updateGoal(goalId, updates)"
 *       input: "goalId: string, updates: Partial<Goal>"
 *       output: "updated Goal object, persisted to user properties"
 *     - step: 5
 *       call: "deleteGoal(goalId)"
 *       input: "goalId: string"
 *       output: "boolean, true if a goal was removed"
 * ---
 */

var GOALS_PROPERTY_KEY = 'GOALS_V1';

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
  if (icon.length > 4) {
    throw new Error('Goal icon must be 4 characters or fewer (emoji recommended).');
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
  var goal = {
    id: Utilities.getUuid(),
    name: input.name.trim(),
    icon: input.icon.trim(),
    active: true,
    createdAt: new Date().toISOString()
  };
  goals.push(goal);
  writeGoalsToStorage(goals);
  return goal;
}

function updateGoal(goalId, updates) {
  var goals = readGoalsFromStorage();
  var target = null;
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].id === goalId) {
      if (updates && typeof updates.name === 'string') {
        goals[i].name = updates.name.trim();
      }
      if (updates && typeof updates.icon === 'string') {
        goals[i].icon = updates.icon.trim();
      }
      if (updates && typeof updates.active === 'boolean') {
        goals[i].active = updates.active;
      }
      validateGoalInput(goals[i]);
      target = goals[i];
      break;
    }
  }
  if (!target) {
    throw new Error('Goal not found: ' + goalId);
  }
  writeGoalsToStorage(goals);
  return target;
}

function deleteGoal(goalId) {
  var goals = readGoalsFromStorage();
  var filtered = goals.filter(function (g) {
    return g.id !== goalId;
  });
  var removed = filtered.length !== goals.length;
  if (removed) {
    writeGoalsToStorage(filtered);
  }
  return removed;
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
