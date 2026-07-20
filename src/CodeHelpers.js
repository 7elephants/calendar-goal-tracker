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
 *       output: "HomeCard.buildHomeCard() built from GoalService.listGoals() + CalendarService.getGoalStatusForDate() + GoalRules.summaryStats() (the latter's result now also carries todayWindowStatus - always today's window state, not whichever day is being viewed - so HomeCard.js can decide whether an upcoming/completed goal's streak should be displayed). buildHomeCardOrErrorCard_ wraps it in a try/catch so a Calendar API failure (quota, transient error, revoked scope) renders an error card instead of crashing the whole add-on."
 *     - step: 6
 *       call: "resolveGraphsRange_(e, todayDateKey) / buildGraphsCardForRange_(fromDateKey, toDateKeyExclusive) / buildGraphsCardOrErrorCard_(fromDateKey, toDateKeyExclusive)"
 *       input: "e: the action event (e.parameters.preset for a preset button, or e.formInput.graphFromDate/graphToDate for the custom-range Apply button), todayDateKey: 'YYYY-MM-DD'; fromDateKey/toDateKeyExclusive: 'YYYY-MM-DD'"
 *       output: "resolveGraphsRange_: { fromDateKey, toDateKeyExclusive } - a preset parameter always wins over any submitted DatePicker values; an invalid/incomplete custom range (missing or end-before-start) falls back to the current month, same as the card's own default. buildGraphsCardForRange_: GraphsCard.buildGraphsCard() built from active goals partitioned by GoalRules.isCountOnly, each fetched once via CalendarService.getGoalStatusByDate() and walked once via ChartData.buildDailySeries() (one call, both series) through the buildSeriesList_ helper. The range's end is clamped to tomorrow so future days never appear as a flat 0%/0-count tail. The compliance series (only) is additionally clipped to each goal's own GoalRules.complianceWindow(goal), so a day before a goal started or on/after it ended is excluded from that goal's % math entirely (rendered as a gap, not a 0%) rather than counting as a miss - the count-only series is never clipped this way. buildGraphsCardOrErrorCard_ wraps it in the same try/catch pattern as buildHomeCardOrErrorCard_."
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
  var goals = listGoals().filter(GoalRules.isActive);
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

/**
 * A preset button (e.parameters.preset) always wins over a submitted custom
 * range, since clicking a preset re-submits whatever the From/To pickers
 * happened to be showing along with it. An incomplete or end-before-start
 * custom range falls back to the current month rather than erroring, same
 * as the card's own first-open default.
 */
function resolveGraphsRange_(e, todayDateKey) {
  var params = e.parameters || {};
  if (params.preset) {
    return ChartData.presetRange(params.preset, todayDateKey);
  }

  var formInput = e.formInput || {};
  var fromDateKey = datePickerValueToDateKey_(formInput.graphFromDate);
  var toDateKey = datePickerValueToDateKey_(formInput.graphToDate);
  if (fromDateKey && toDateKey && fromDateKey <= toDateKey) {
    return { fromDateKey: fromDateKey, toDateKeyExclusive: addDaysToDateKey(toDateKey, 1) };
  }

  return ChartData.presetRange('thisMonth', todayDateKey);
}

/**
 * Fetches getGoalStatusByDate once per goal and walks it once via
 * ChartData.buildDailySeries, picking cumulativeCount or compliancePct
 * off the result via valuesKey depending on which chart the caller is
 * building series for. useComplianceWindow (compliance chart only) clips
 * each goal's own compliancePct values to its own [start, start+duration)
 * window via GoalRules.complianceWindow, so days outside a goal's run
 * come back null (rendered as a gap) instead of counting toward it.
 */
function buildSeriesList_(goals, fromDateKey, toDateKeyExclusive, valuesKey, useComplianceWindow) {
  var labels = ChartData.labelGoalsByIcon(goals);
  return goals.map(function (goal, i) {
    var statusByDate = getGoalStatusByDate(goal.id, fromDateKey, toDateKeyExclusive);
    var complianceWindow = useComplianceWindow ? GoalRules.complianceWindow(goal) : undefined;
    var series = ChartData.buildDailySeries(statusByDate, fromDateKey, toDateKeyExclusive, complianceWindow);
    return { label: labels[i], values: series[valuesKey] };
  });
}

/**
 * Routes count-only goals into the cumulative-count chart and everything
 * else into the compliance chart via buildSeriesList_ - see
 * GoalRules.isCountOnly. The end of the range is clamped to tomorrow so a
 * "this month" or custom range that extends past today never plots a flat,
 * meaningless tail of future days. Only the compliance series is clipped to
 * each goal's own window (useComplianceWindow: true) - a goal's cumulative
 * count still counts every day in the selected range, unaffected by its
 * own start/end.
 */
function buildGraphsCardForRange_(fromDateKey, toDateKeyExclusive) {
  var tomorrow = addDaysToDateKey(todayDateKey_(), 1);
  var effectiveEndExclusive = toDateKeyExclusive < tomorrow ? toDateKeyExclusive : tomorrow;

  var goals = listGoals().filter(GoalRules.isActive);
  var countGoals = goals.filter(GoalRules.isCountOnly);
  var complianceGoals = goals.filter(function (goal) {
    return !GoalRules.isCountOnly(goal);
  });

  var dateKeys = ChartData.buildDailySeries({}, fromDateKey, effectiveEndExclusive).dateKeys;
  var countSeriesList = buildSeriesList_(countGoals, fromDateKey, effectiveEndExclusive, 'cumulativeCount', false);
  var complianceSeriesList = buildSeriesList_(
    complianceGoals,
    fromDateKey,
    effectiveEndExclusive,
    'compliancePct',
    true
  );

  return buildGraphsCard(fromDateKey, toDateKeyExclusive, dateKeys, countSeriesList, complianceSeriesList);
}

/**
 * Wraps buildGraphsCardForRange_ so a Calendar API failure (quota,
 * transient error, revoked scope) renders an error card instead of
 * crashing the Graphs card, same as buildHomeCardOrErrorCard_.
 */
function buildGraphsCardOrErrorCard_(fromDateKey, toDateKeyExclusive) {
  try {
    return buildGraphsCardForRange_(fromDateKey, toDateKeyExclusive);
  } catch (err) {
    return buildErrorCard(err.message);
  }
}
