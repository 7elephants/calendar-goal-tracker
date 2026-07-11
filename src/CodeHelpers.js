/**
 * ---
 * file: src/CodeHelpers.js
 * workflow:
 *   invocation: "Small private helpers (trailing underscore) shared across Triggers.js and ActionHandlers.js. Never registered as a trigger or action handler itself."
 *   steps:
 *     - step: 1
 *       call: "todayDateKey_() / dateKeyToDate_(dateKey)"
 *       input: "none, or dateKey: 'YYYY-MM-DD'"
 *       output: "today's dateKey, or the inverse conversion to a local-time Date"
 *     - step: 2
 *       call: "datePickerValueToDateKey_(value)"
 *       input: "e.formInput's raw DatePicker value"
 *       output: "a dateKey ('YYYY-MM-DD'), or null if no usable value was found. Handles e.formInput delivering either a raw epoch-ms string (per Google's docs) or a { msSinceEpoch } object (observed live in this runtime), converting with utcMsToDateKey (not getDateKey, which is local-time) to avoid an off-by-one-day bug."
 *     - step: 3
 *       call: "deletedGoalNotification_(actionVerb)"
 *       input: "actionVerb: string, e.g. 'marked' or 'edited'"
 *       output: "ActionResponse notification shown when acting on a soft-deleted goal (active: false)"
 *     - step: 4
 *       call: "parseGoalFormInput_(formInput, fallbackStartDate)"
 *       input: "e.formInput: { goalName, goalIcon, goalType, goalStartDate, goalDurationDays }, fallbackStartDate: 'YYYY-MM-DD' used when the DatePicker value is unusable"
 *       output: "{ name, icon, goalType, startDate, durationDays } for GoalService.createGoal()/updateGoal(). A blank duration field means 'forever' (durationDays: 0), same as explicitly typing 0 - see validateGoalInput in GoalService.js. goalType's SelectionInput value may arrive as a bare string or a single-element array depending on the runtime, same ambiguity as the DatePicker's e.formInput shape - both are normalized here."
 *     - step: 5
 *       call: "buildHomeCardForDate_(dateKey) / buildHomeCardOrErrorCard_(dateKey)"
 *       input: "dateKey: 'YYYY-MM-DD'"
 *       output: "HomeCard.buildHomeCard() built from GoalService.listGoals() + CalendarService.getGoalStatusForDate() + GoalRules.summaryStats(); buildHomeCardOrErrorCard_ wraps it in a try/catch so a Calendar API failure (quota, transient error, revoked scope) renders an error card instead of crashing the whole add-on."
 * ---
 */

function todayDateKey_() {
  return getDateKey(new Date());
}

function dateKeyToDate_(dateKey) {
  var parts = dateKey.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * A DatePicker's e.formInput value is documented as a plain epoch-ms string,
 * but in practice (Calendar add-on runtime, observed live) it arrives as
 * { msSinceEpoch: number }. Handle both shapes rather than trust the docs.
 * Returns a dateKey ('YYYY-MM-DD'), or null if no usable value was found.
 */
function datePickerValueToDateKey_(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  var ms = typeof value === 'object' ? Number(value.msSinceEpoch) : Number(value);
  return isNaN(ms) ? null : utcMsToDateKey(ms);
}

/**
 * Shared by handleMarkStatus/handleOpenEditGoalCard: the notification shown
 * when acting on a soft-deleted goal (active: false). handleEditGoalSubmit
 * needs no equivalent check - GoalService.updateGoal() itself throws for a
 * soft-deleted goal, which its existing try/catch already surfaces.
 */
function deletedGoalNotification_(actionVerb) {
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('This goal has been deleted and can no longer be ' + actionVerb + '.')
    )
    .build();
}

/**
 * Shared by handleCreateGoalSubmit/handleEditGoalSubmit. A blank duration
 * field means "forever" (durationDays: 0), same as explicitly typing 0 -
 * see validateGoalInput in GoalService.js.
 */
function parseGoalFormInput_(formInput, fallbackStartDate) {
  var startDate = datePickerValueToDateKey_(formInput.goalStartDate) || fallbackStartDate;
  var durationDays = formInput.goalDurationDays ? Number(formInput.goalDurationDays) : 0;
  var goalType = Array.isArray(formInput.goalType) ? formInput.goalType[0] : formInput.goalType;
  return {
    name: formInput.goalName,
    icon: formInput.goalIcon,
    goalType: goalType,
    startDate: startDate,
    durationDays: durationDays
  };
}

function buildHomeCardForDate_(dateKey) {
  var goals = listGoals().filter(function (g) {
    return g.active !== false;
  });
  var date = dateKeyToDate_(dateKey);
  var today = todayDateKey_();

  var goalsWithStatus = goals.map(function (goal) {
    return {
      goal: goal,
      status: getGoalStatusForDate(goal.id, date),
      summary: GoalRules.summaryStats(goal, today)
    };
  });

  return buildHomeCard(dateKey, goalsWithStatus);
}

/**
 * Wraps buildHomeCardForDate_ so a Calendar API failure (quota, transient
 * error, revoked scope) renders an error card instead of crashing the
 * whole add-on homepage.
 */
function buildHomeCardOrErrorCard_(dateKey) {
  try {
    return buildHomeCardForDate_(dateKey);
  } catch (err) {
    return buildErrorCard(err.message);
  }
}
