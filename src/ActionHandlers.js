/**
 * ---
 * file: src/ActionHandlers.js
 * workflow:
 *   invocation: "Every CardService onClickAction handler, registered by function name on the buttons/forms built in HomeCard.js/GoalFormCard.js/MiscCards.js."
 *   steps:
 *     - step: 1
 *       call: "handleMarkStatus(e)"
 *       input: "e.parameters: { goalId, dateKey, status: 'success'|'fail'|'clear' }"
 *       output: "ActionResponse that updates the card in place via CalendarService.setGoalStatus(), or a notification (no Calendar write) if the goal is missing, soft-deleted (active: false), or the Calendar API call fails"
 *     - step: 2
 *       call: "handleOpenCreateGoalCard(e) / handleCreateGoalSubmit(e) / handleOpenEditGoalCard(e) / handleEditGoalSubmit(e)"
 *       input: "e.parameters: { goalId } (edit only, identifies which goal to open/save) plus e.formInput: { goalName, goalIcon, goalStartDate, goalDurationDays }"
 *       output: "ActionResponse that pushes the create/edit form card, or (on submit) saves via GoalService.createGoal()/updateGoal() and pops back to an updated home card. Both submit handlers build their GoalService input via the shared parseGoalFormInput_(formInput, fallbackStartDate) helper. handleOpenEditGoalCard rejects with a notification instead of pushing the card if the goal is soft-deleted (active: false); handleEditGoalSubmit needs no separate check for that since GoalService.updateGoal() itself throws for a soft-deleted goal, which the existing try/catch surfaces as a notification."
 *     - step: 3
 *       call: "handleOpenDatePickerCard(e) / handleGoToDate(e) / handleShiftDay(e) / handleDeleteGoal(e)"
 *       input: "varies: e.parameters or e.formInput depending on the widget that triggered the action"
 *       output: "ActionResponse that either pushes a new card or updates the current card. handleGoToDate reads its DatePicker value via datePickerValueToDateKey_(), falling back to todayDateKey_() when no usable value is present. handleShiftDay reads e.parameters.dateKey/days (+/-1, from the home card's prev/next arrows) and updates the card in place via CalendarService.addDaysToDateKey — no push/pop, unlike the DatePicker sub-card flows. handleDeleteGoal soft-deletes via GoalService.deleteGoal() (sets active: false; no data or past Calendar events are removed) then re-renders the home card, from which the goal now disappears."
 * ---
 */

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
