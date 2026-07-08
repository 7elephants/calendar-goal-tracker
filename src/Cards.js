/**
 * ---
 * file: src/Cards.js
 * workflow:
 *   invocation: "Called only by Code.js trigger/action handlers; builds CardService UI, never calls GoalService/CalendarService storage directly except to read display data."
 *   steps:
 *     - step: 1
 *       call: "formatStatusLabel(status)"
 *       input: "'success' | 'fail' | null"
 *       output: "human readable label string, e.g. 'Done', 'Missed', 'Not set'"
 *     - step: 2
 *       call: "buildHomeCard(dateKey, goalsWithStatus)"
 *       input: "dateKey: 'YYYY-MM-DD', goalsWithStatus: Array<{ goal: Goal, status: string|null }>"
 *       output: "CardService.Card showing every goal for that day with Success/Fail/Clear buttons"
 *     - step: 3
 *       call: "buildCreateGoalCard()"
 *       input: "none"
 *       output: "CardService.Card with name + icon TextInputs and a submit button"
 *     - step: 4
 *       call: "buildDatePickerCard(dateKey)"
 *       input: "dateKey: 'YYYY-MM-DD' currently selected"
 *       output: "CardService.Card with a DatePicker widget and a 'Go' button"
 * ---
 */

function formatStatusLabel(status) {
  if (status === 'success') {
    return 'Done ✅';
  }
  if (status === 'fail') {
    return 'Missed ❌';
  }
  return 'Not set';
}

function formatDisplayDate(dateKey) {
  var parts = dateKey.split('-').map(Number);
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
}

function buildGoalRowWidget(goal, dateKey, status) {
  var decoratedText = CardService.newDecoratedText()
    .setTopLabel(goal.icon + ' ' + goal.name)
    .setText(formatStatusLabel(status))
    .setWrapText(true);

  var successAction = CardService.newAction()
    .setFunctionName('handleMarkStatus')
    .setParameters({ goalId: goal.id, dateKey: dateKey, status: 'success' });
  var failAction = CardService.newAction()
    .setFunctionName('handleMarkStatus')
    .setParameters({ goalId: goal.id, dateKey: dateKey, status: 'fail' });
  var clearAction = CardService.newAction()
    .setFunctionName('handleMarkStatus')
    .setParameters({ goalId: goal.id, dateKey: dateKey, status: 'clear' });
  var deleteAction = CardService.newAction()
    .setFunctionName('handleDeleteGoal')
    .setParameters({ goalId: goal.id });

  var buttonSet = CardService.newButtonSet()
    .addButton(CardService.newTextButton().setText('✅ Success').setOnClickAction(successAction))
    .addButton(CardService.newTextButton().setText('❌ Fail').setOnClickAction(failAction))
    .addButton(CardService.newTextButton().setText('Clear').setOnClickAction(clearAction))
    .addButton(CardService.newTextButton().setText('Delete goal').setOnClickAction(deleteAction));

  return { decoratedText: decoratedText, buttonSet: buttonSet };
}

function buildHomeCard(dateKey, goalsWithStatus) {
  var header = CardService.newCardHeader()
    .setTitle('Goals & Habits')
    .setSubtitle(formatDisplayDate(dateKey));

  var goalsSection = CardService.newCardSection().setHeader('Today’s goals');
  if (!goalsWithStatus || goalsWithStatus.length === 0) {
    goalsSection.addWidget(CardService.newTextParagraph().setText('No goals yet. Create one below.'));
  } else {
    goalsWithStatus.forEach(function (entry) {
      var row = buildGoalRowWidget(entry.goal, dateKey, entry.status);
      goalsSection.addWidget(row.decoratedText);
      goalsSection.addWidget(row.buttonSet);
    });
  }

  var actionsSection = CardService.newCardSection();
  var newGoalAction = CardService.newAction().setFunctionName('handleOpenCreateGoalCard');
  var pickDateAction = CardService.newAction()
    .setFunctionName('handleOpenDatePickerCard')
    .setParameters({ dateKey: dateKey });
  actionsSection.addWidget(
    CardService.newButtonSet()
      .addButton(CardService.newTextButton().setText('+ New goal').setOnClickAction(newGoalAction))
      .addButton(CardService.newTextButton().setText('📅 Choose day').setOnClickAction(pickDateAction))
  );

  return CardService.newCardBuilder()
    .setHeader(header)
    .addSection(goalsSection)
    .addSection(actionsSection)
    .build();
}

function buildCreateGoalCard() {
  var header = CardService.newCardHeader().setTitle('New goal');

  var nameInput = CardService.newTextInput()
    .setFieldName('goalName')
    .setTitle('Goal name')
    .setHint('e.g. Run 3 miles');
  var iconInput = CardService.newTextInput()
    .setFieldName('goalIcon')
    .setTitle('Icon / emoji')
    .setHint('e.g. 🏃');

  var submitAction = CardService.newAction().setFunctionName('handleCreateGoalSubmit');
  var submitButton = CardService.newTextButton()
    .setText('Create goal')
    .setOnClickAction(submitAction);

  var section = CardService.newCardSection()
    .addWidget(nameInput)
    .addWidget(iconInput)
    .addWidget(submitButton);

  return CardService.newCardBuilder().setHeader(header).addSection(section).build();
}

function buildDatePickerCard(dateKey) {
  var parts = dateKey.split('-').map(Number);
  var current = new Date(parts[0], parts[1] - 1, parts[2]);

  var header = CardService.newCardHeader().setTitle('Choose a day');
  var datePicker = CardService.newDatePicker()
    .setFieldName('selectedDate')
    .setTitle('Day')
    .setValueInMsSinceEpoch(current.getTime());

  var goAction = CardService.newAction().setFunctionName('handleGoToDate');
  var goButton = CardService.newTextButton().setText('Go').setOnClickAction(goAction);

  var section = CardService.newCardSection().addWidget(datePicker).addWidget(goButton);

  return CardService.newCardBuilder().setHeader(header).addSection(section).build();
}

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    formatStatusLabel: formatStatusLabel
  };
}
