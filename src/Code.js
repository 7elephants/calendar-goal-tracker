/**
 * ---
 * file: src/Code.js
 * workflow:
 *   invocation: "Entry point registered in appsscript.json (addOns.calendar.homepageTrigger / eventOpenTrigger) plus every CardService onClickAction handler."
 *   steps:
 *     - step: 1
 *       call: "onHomepage(e)"
 *       input: "Calendar add-on event object (Apps Script runtime callback)"
 *       output: "CardService.Card for today, built from GoalService.listGoals() + CalendarService.getGoalStatusForDate() + CalendarService.getGoalSummaryStats(); falls back to Cards.buildErrorCard() if the Calendar API call fails"
 *     - step: 2
 *       call: "onCalendarEventOpen(e)"
 *       input: "Calendar add-on event object with e.calendar.id and the opened event"
 *       output: "same home card as onHomepage (kept simple: opening any event just surfaces the tracker)"
 *     - step: 3
 *       call: "handleMarkStatus(e)"
 *       input: "e.parameters: { goalId, dateKey, status: 'success'|'fail'|'clear' }"
 *       output: "ActionResponse that updates the card in place via CalendarService.setGoalStatus(), or an error notification if the Calendar API call fails"
 *     - step: 4
 *       call: "handleOpenCreateGoalCard(e) / handleCreateGoalSubmit(e) / handleOpenDatePickerCard(e) / handleGoToDate(e) / handleDeleteGoal(e)"
 *       input: "varies: e.parameters or e.formInput depending on the widget that triggered the action"
 *       output: "ActionResponse that either pushes a new card or updates the current card. handleGoToDate and handleCreateGoalSubmit both read their DatePicker value via datePickerValueToDateKey_(), which handles e.formInput delivering either a raw epoch-ms string (per Google's docs) or a { msSinceEpoch } object (observed live in this runtime), then converts with CalendarService.utcMsToDateKey (not getDateKey, which is local-time) to avoid an off-by-one-day bug; both fall back to todayDateKey_() when no usable value is present."
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
      summary: getGoalSummaryStats(goal, today)
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

function onHomepage(e) {
  return buildHomeCardOrErrorCard_(todayDateKey_());
}

function onCalendarEventOpen(e) {
  return buildHomeCardOrErrorCard_(todayDateKey_());
}

function handleMarkStatus(e) {
  var params = e.parameters || {};
  if (!params.goalId || !params.dateKey || !params.status) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Missing action data; please try again.'))
      .build();
  }

  var goal = getGoal(params.goalId);
  if (!goal) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Goal no longer exists.'))
      .build();
  }

  var date = dateKeyToDate_(params.dateKey);
  var status = params.status === 'clear' ? null : params.status;

  try {
    setGoalStatus(goal, date, status);
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Could not save to Calendar: ' + err.message))
      .build();
  }

  var updatedCard = buildHomeCardOrErrorCard_(params.dateKey);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(updatedCard))
    .setNotification(CardService.newNotification().setText('Saved.'))
    .build();
}

function handleOpenCreateGoalCard(e) {
  var card = buildCreateGoalCard();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function handleCreateGoalSubmit(e) {
  var formInput = e.formInput || {};
  var startDate = datePickerValueToDateKey_(formInput.goalStartDate) || todayDateKey_();
  var durationDays = formInput.goalDurationDays ? Number(formInput.goalDurationDays) : undefined;
  try {
    createGoal({
      name: formInput.goalName,
      icon: formInput.goalIcon,
      startDate: startDate,
      durationDays: durationDays
    });
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(err.message))
      .build();
  }

  var updatedCard = buildHomeCardOrErrorCard_(todayDateKey_());
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard().updateCard(updatedCard))
    .setNotification(CardService.newNotification().setText('Goal created.'))
    .build();
}

function handleOpenDatePickerCard(e) {
  var dateKey = (e.parameters && e.parameters.dateKey) || todayDateKey_();
  var card = buildDatePickerCard(dateKey);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function handleGoToDate(e) {
  var formInput = e.formInput || {};
  var dateKey = datePickerValueToDateKey_(formInput.selectedDate) || todayDateKey_();

  var updatedCard = buildHomeCardOrErrorCard_(dateKey);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard().updateCard(updatedCard))
    .build();
}

function handleDeleteGoal(e) {
  var params = e.parameters || {};
  if (!params.goalId) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Missing goal id; please try again.'))
      .build();
  }
  deleteGoal(params.goalId);

  var updatedCard = buildHomeCardOrErrorCard_(todayDateKey_());
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(updatedCard))
    .setNotification(CardService.newNotification().setText('Goal deleted. Past calendar events are kept.'))
    .build();
}
