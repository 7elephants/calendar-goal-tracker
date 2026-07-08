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
 *       output: "ActionResponse that updates the card in place via CalendarService.setGoalStatus(), or a notification (no Calendar write) if the goal is missing, soft-deleted (active: false), or the Calendar API call fails"
 *     - step: 4
 *       call: "handleOpenCreateGoalCard(e) / handleCreateGoalSubmit(e) / handleOpenEditGoalCard(e) / handleEditGoalSubmit(e)"
 *       input: "e.parameters: { goalId } (edit only, identifies which goal to open/save) plus e.formInput: { goalName, goalIcon, goalStartDate, goalDurationDays }"
 *       output: "ActionResponse that pushes the create/edit form card, or (on submit) saves via GoalService.createGoal()/updateGoal() and pops back to an updated home card. Both submit handlers build their GoalService input via the shared parseGoalFormInput_(formInput, fallbackStartDate) helper, which reads the DatePicker value via datePickerValueToDateKey_() and treats a blank duration field the same as an explicit 0 (durationDays: 0 means the goal runs forever - see validateGoalInput in GoalService.js). handleOpenEditGoalCard rejects with a notification instead of pushing the card if the goal is soft-deleted (active: false); handleEditGoalSubmit needs no separate check for that since GoalService.updateGoal() itself throws for a soft-deleted goal, which the existing try/catch surfaces as a notification."
 *     - step: 5
 *       call: "handleOpenDatePickerCard(e) / handleGoToDate(e) / handleShiftDay(e) / handleDeleteGoal(e)"
 *       input: "varies: e.parameters or e.formInput depending on the widget that triggered the action"
 *       output: "ActionResponse that either pushes a new card or updates the current card. handleGoToDate reads its DatePicker value via datePickerValueToDateKey_(), which handles e.formInput delivering either a raw epoch-ms string (per Google's docs) or a { msSinceEpoch } object (observed live in this runtime), then converts with CalendarService.utcMsToDateKey (not getDateKey, which is local-time) to avoid an off-by-one-day bug; falls back to todayDateKey_() when no usable value is present. handleShiftDay reads e.parameters.dateKey/days (+/-1, from the home card's prev/next arrows) and updates the card in place via CalendarService.addDaysToDateKey — no push/pop, unlike the DatePicker sub-card flows. handleDeleteGoal soft-deletes via GoalService.deleteGoal() (sets active: false; no data or past Calendar events are removed) then re-renders the home card, from which the goal now disappears."
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
  return {
    name: formInput.goalName,
    icon: formInput.goalIcon,
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
  if (goal.active === false) {
    return deletedGoalNotification_('marked');
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
  try {
    createGoal(parseGoalFormInput_(formInput, todayDateKey_()));
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

function handleShiftDay(e) {
  var params = e.parameters || {};
  var days = Number(params.days) || 0;
  var dateKey = params.dateKey ? addDaysToDateKey(params.dateKey, days) : todayDateKey_();

  var updatedCard = buildHomeCardOrErrorCard_(dateKey);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(updatedCard))
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

function handleOpenEditGoalCard(e) {
  var params = e.parameters || {};
  var goal = params.goalId ? getGoal(params.goalId) : null;
  if (!goal) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Goal no longer exists.'))
      .build();
  }
  if (goal.active === false) {
    return deletedGoalNotification_('edited');
  }

  var card = buildEditGoalCard(goal);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function handleEditGoalSubmit(e) {
  var params = e.parameters || {};
  var formInput = e.formInput || {};
  var goal = params.goalId ? getGoal(params.goalId) : null;
  if (!goal) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Goal no longer exists.'))
      .build();
  }

  try {
    updateGoal(goal.id, parseGoalFormInput_(formInput, goal.startDate));
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(err.message))
      .build();
  }

  var updatedCard = buildHomeCardOrErrorCard_(todayDateKey_());
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard().updateCard(updatedCard))
    .setNotification(CardService.newNotification().setText('Goal updated.'))
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
    .setNotification(CardService.newNotification().setText('Goal deleted. Its data and past calendar events are kept.'))
    .build();
}
