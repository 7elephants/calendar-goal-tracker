/**
 * ---
 * file: src/Code.js
 * workflow:
 *   invocation: "Entry point registered in appsscript.json (addOns.calendar.homepageTrigger / eventOpenTrigger) plus every CardService onClickAction handler."
 *   steps:
 *     - step: 1
 *       call: "onHomepage(e)"
 *       input: "Calendar add-on event object (Apps Script runtime callback)"
 *       output: "CardService.Card for today, built from GoalService.listGoals() + CalendarService.getGoalStatusForDate()"
 *     - step: 2
 *       call: "onCalendarEventOpen(e)"
 *       input: "Calendar add-on event object with e.calendar.id and the opened event"
 *       output: "same home card as onHomepage (kept simple: opening any event just surfaces the tracker)"
 *     - step: 3
 *       call: "handleMarkStatus(e)"
 *       input: "e.parameters: { goalId, dateKey, status: 'success'|'fail'|'clear' }"
 *       output: "ActionResponse that updates the card in place via CalendarService.setGoalStatus()"
 *     - step: 4
 *       call: "handleOpenCreateGoalCard(e) / handleCreateGoalSubmit(e) / handleOpenDatePickerCard(e) / handleGoToDate(e) / handleDeleteGoal(e)"
 *       input: "varies: e.parameters or e.formInput depending on the widget that triggered the action"
 *       output: "ActionResponse that either pushes a new card or updates the current card"
 * ---
 */

function todayDateKey_() {
  return getDateKey(new Date());
}

function buildHomeCardForDate_(dateKey) {
  var goals = listGoals().filter(function (g) {
    return g.active !== false;
  });
  var parts = dateKey.split('-').map(Number);
  var date = new Date(parts[0], parts[1] - 1, parts[2]);

  var goalsWithStatus = goals.map(function (goal) {
    return { goal: goal, status: getGoalStatusForDate(goal.id, date) };
  });

  return buildHomeCard(dateKey, goalsWithStatus);
}

function onHomepage(e) {
  return buildHomeCardForDate_(todayDateKey_());
}

function onCalendarEventOpen(e) {
  return buildHomeCardForDate_(todayDateKey_());
}

function handleMarkStatus(e) {
  var params = e.parameters;
  var goal = getGoal(params.goalId);
  if (!goal) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Goal no longer exists.'))
      .build();
  }

  var parts = params.dateKey.split('-').map(Number);
  var date = new Date(parts[0], parts[1] - 1, parts[2]);
  var status = params.status === 'clear' ? null : params.status;
  setGoalStatus(goal, date, status);

  var updatedCard = buildHomeCardForDate_(params.dateKey);
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
    createGoal({ name: formInput.goalName, icon: formInput.goalIcon });
  } catch (err) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(err.message))
      .build();
  }

  var updatedCard = buildHomeCardForDate_(todayDateKey_());
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
  var msString = formInput.selectedDate;
  var dateKey = msString ? getDateKey(new Date(Number(msString))) : todayDateKey_();

  var updatedCard = buildHomeCardForDate_(dateKey);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popCard().updateCard(updatedCard))
    .build();
}

function handleDeleteGoal(e) {
  var params = e.parameters;
  deleteGoal(params.goalId);

  var updatedCard = buildHomeCardForDate_(todayDateKey_());
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(updatedCard))
    .setNotification(CardService.newNotification().setText('Goal deleted. Past calendar events are kept.'))
    .build();
}
