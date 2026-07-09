/**
 * ---
 * file: src/GoalFormCard.js
 * workflow:
 *   invocation: "Called only by ActionHandlers.js (handleOpenCreateGoalCard / handleOpenEditGoalCard); builds the create/edit goal form's CardService UI."
 *   steps:
 *     - step: 1
 *       call: "buildGoalFormSection_(prefill)"
 *       input: "prefill: Goal | null - null for a fresh goal, an existing Goal for editing"
 *       output: "CardService.CardSection with name/icon TextInputs, a start-date DatePicker, and a duration-in-days TextInput (hinted that 0 means forever), pre-filled when prefill is given"
 *     - step: 2
 *       call: "buildCreateGoalCard()"
 *       input: "none"
 *       output: "CardService.Card wrapping buildGoalFormSection_(null) plus a 'Create goal' submit button wired to handleCreateGoalSubmit"
 *     - step: 3
 *       call: "buildEditGoalCard(goal)"
 *       input: "goal: Goal"
 *       output: "CardService.Card identical in shape to buildCreateGoalCard() but wrapping buildGoalFormSection_(goal); submit action carries goalId as a parameter (not a form field) so handleEditGoalSubmit knows which goal to update"
 * ---
 */

/**
 * Shared by buildCreateGoalCard/buildEditGoalCard. `prefill` is null for a
 * fresh goal (defaults to today's start date, blank name/icon/duration), or
 * an existing Goal for editing. Goals created before startDate/durationDays
 * existed (or a forever goal, durationDays: 0) fall back the same way here
 * as they do everywhere else in the app: missing startDate defaults to
 * today, missing/0 durationDays pre-fills as "0" (forever) rather than the
 * literal string "undefined".
 */
function buildGoalFormSection_(prefill) {
  var nameInput = CardService.newTextInput()
    .setFieldName('goalName')
    .setTitle('Goal name')
    .setHint('e.g. Run 3 miles');
  var iconInput = CardService.newTextInput()
    .setFieldName('goalIcon')
    .setTitle('Icon / emoji')
    .setHint('e.g. 🏃');
  var startDateInput = CardService.newDatePicker()
    .setFieldName('goalStartDate')
    .setTitle('Start date')
    .setValueInMsSinceEpoch(dateKeyToUtcMs((prefill && prefill.startDate) || getDateKey(new Date())));
  var durationInput = CardService.newTextInput()
    .setFieldName('goalDurationDays')
    .setTitle('Duration (days)')
    .setHint('e.g. 30 (0 = forever)');

  if (prefill) {
    nameInput.setValue(prefill.name);
    iconInput.setValue(prefill.icon);
    durationInput.setValue(String(prefill.durationDays || 0));
  }

  return CardService.newCardSection()
    .addWidget(nameInput)
    .addWidget(iconInput)
    .addWidget(startDateInput)
    .addWidget(durationInput);
}

function buildCreateGoalCard() {
  var header = CardService.newCardHeader().setTitle('New goal');

  var submitAction = CardService.newAction().setFunctionName('handleCreateGoalSubmit');
  var submitButton = CardService.newTextButton()
    .setText('Create goal')
    .setMaterialIcon(CardService.newMaterialIcon().setName('add'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(GOAL_COLOR_PRIMARY)
    .setOnClickAction(submitAction);

  var section = buildGoalFormSection_(null).addWidget(submitButton);

  return CardService.newCardBuilder().setHeader(header).addSection(section).build();
}

function buildEditGoalCard(goal) {
  var header = CardService.newCardHeader().setTitle('Edit goal');

  var submitAction = CardService.newAction()
    .setFunctionName('handleEditGoalSubmit')
    .setParameters({ goalId: goal.id });
  var submitButton = CardService.newTextButton()
    .setText('Save changes')
    .setMaterialIcon(CardService.newMaterialIcon().setName('check'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(GOAL_COLOR_PRIMARY)
    .setOnClickAction(submitAction);

  var section = buildGoalFormSection_(goal).addWidget(submitButton);

  return CardService.newCardBuilder().setHeader(header).addSection(section).build();
}
