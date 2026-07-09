/**
 * ---
 * file: src/Cards.js
 * workflow:
 *   invocation: "Called only by Code.js trigger/action handlers; builds CardService UI, never calls GoalService/CalendarService storage directly except to read display data."
 *   steps:
 *     - step: 1
 *       call: "formatStatusLabel(status)"
 *       input: "'success' | 'fail' | null"
 *       output: "emoji status label string: '✅', '❌', or ''"
 *     - step: 2
 *       call: "buildHomeCard(dateKey, goalsWithStatus)"
 *       input: "dateKey: 'YYYY-MM-DD', goalsWithStatus: Array<{ goal: Goal, status: string|null, summary: CalendarService.getGoalSummaryStats() result }>"
 *       output: "CardService.Card with no CardHeader (title is required by CardHeader so an empty one is unsafe; the add-on's own name in Calendar's chrome already labels the card). First widget is a date-nav row (chevron_left/chevron_right call handleShiftDay to move +/-1 day in place; the date label between them calls handleOpenDatePickerCard). Then today's goals, one row per goal: a DecoratedText whose primary text is the goal's icon plus its status mark (large - DecoratedText's topLabel/bottomLabel captions render smaller than its main text, and CardService text widgets have no font-size control, so the icon lives in the main text slot to appear bigger; the goal name is intentionally not shown on the home card at all) immediately followed by a single ButtonSet with all five actions (Mark done/Mark missed/Clear/Edit/Delete) grouped together, since DecoratedText's own trailing slot only accepts one button, not a set. Then a read-only 'Goal summary' section (same icon-plus-text layout: icon, duration, days left/done/missed per goal; duration/days-left render as '∞' for forever goals, i.e. durationDays === 0), and a Create goal action."
 *     - step: 3
 *       call: "buildCreateGoalCard()"
 *       input: "none"
 *       output: "CardService.Card with name/icon TextInputs, a start-date DatePicker (defaulted to today), a duration-in-days TextInput (hinted that 0 means forever), and a submit button"
 *     - step: 4
 *       call: "buildEditGoalCard(goal)"
 *       input: "goal: Goal"
 *       output: "CardService.Card identical in shape to buildCreateGoalCard() but pre-filled with the goal's current name/icon/startDate/durationDays; submit action carries goalId as a parameter (not a form field) so handleEditGoalSubmit knows which goal to update"
 *     - step: 5
 *       call: "buildDatePickerCard(dateKey)"
 *       input: "dateKey: 'YYYY-MM-DD' currently selected"
 *       output: "CardService.Card with a DatePicker widget (seeded via CalendarService.dateKeyToUtcMs, since the widget is UTC-based) and a 'Go to day' button"
 *     - step: 6
 *       call: "buildErrorCard(message)"
 *       input: "message: string"
 *       output: "CardService.Card shown in place of the home card when a Calendar API call fails, so a backend error never surfaces as a raw crash"
 * ---
 */

// Matches the primaryColor/secondaryColor declared in appsscript.json plus
// Google's standard Material red for the negative/destructive action.
var GOAL_COLOR_PRIMARY = '#1a73e8';
var GOAL_COLOR_SUCCESS = '#188038';
var GOAL_COLOR_FAIL = '#d93025';

function formatStatusLabel(status) {
  if (status === 'success') {
    return '✅';
  }
  if (status === 'fail') {
    return '❌';
  }
  return '';
}

function formatDisplayDate(dateKey) {
  var parts = dateKey.split('-').map(Number);
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE, MMMM d, yyyy');
}

function formatWindowBadge(goal, dateKey) {
  var windowStatus = getGoalWindowStatus(goal, dateKey);
  if (windowStatus === 'upcoming') {
    return 'Starts ' + formatDisplayDate(goal.startDate);
  }
  if (windowStatus === 'completed') {
    return '🏁 Completed (' + goal.durationDays + '-day goal)';
  }
  return null;
}

function formatGoalSummaryLine(stats) {
  var durationLabel = stats.durationDays !== null ? stats.durationDays + ' days' : '∞';
  var daysLeftLabel = (stats.daysLeft !== null ? stats.daysLeft : '∞') + ' left';
  return 'Duration: ' + durationLabel + '  ·  ' + daysLeftLabel + '  ·  ✅ ' + stats.daysDone + '  ·  ❌ ' + stats.daysMissed;
}

function buildGoalSummaryRowWidget(goal, stats) {
  return CardService.newDecoratedText()
    .setText(goal.icon + '&nbsp;' + formatGoalSummaryLine(stats))
    .setWrapText(true);
}

function buildDateNavRowWidget(dateKey) {
  var prevAction = CardService.newAction()
    .setFunctionName('handleShiftDay')
    .setParameters({ dateKey: dateKey, days: '-1' });
  var nextAction = CardService.newAction()
    .setFunctionName('handleShiftDay')
    .setParameters({ dateKey: dateKey, days: '1' });
  var pickDateAction = CardService.newAction()
    .setFunctionName('handleOpenDatePickerCard')
    .setParameters({ dateKey: dateKey });

  return CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setAltText('Previous day')
        .setMaterialIcon(CardService.newMaterialIcon().setName('chevron_left'))
        .setTextButtonStyle(CardService.TextButtonStyle.BORDERLESS)
        .setOnClickAction(prevAction)
    )
    .addButton(
      CardService.newTextButton()
        .setText(formatDisplayDate(dateKey))
        .setAltText('Choose a day')
        .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
        .setOnClickAction(pickDateAction)
    )
    .addButton(
      CardService.newTextButton()
        .setAltText('Next day')
        .setMaterialIcon(CardService.newMaterialIcon().setName('chevron_right'))
        .setTextButtonStyle(CardService.TextButtonStyle.BORDERLESS)
        .setOnClickAction(nextAction)
    );
}

function buildGoalRowWidget(goal, dateKey, status) {
  var successAction = CardService.newAction()
    .setFunctionName('handleMarkStatus')
    .setParameters({ goalId: goal.id, dateKey: dateKey, status: 'success' });
  var failAction = CardService.newAction()
    .setFunctionName('handleMarkStatus')
    .setParameters({ goalId: goal.id, dateKey: dateKey, status: 'fail' });
  var clearAction = CardService.newAction()
    .setFunctionName('handleMarkStatus')
    .setParameters({ goalId: goal.id, dateKey: dateKey, status: 'clear' });
  var editAction = CardService.newAction()
    .setFunctionName('handleOpenEditGoalCard')
    .setParameters({ goalId: goal.id });
  var deleteAction = CardService.newAction()
    .setFunctionName('handleDeleteGoal')
    .setParameters({ goalId: goal.id });

  var statusLabel = formatStatusLabel(status);
  var decoratedText = CardService.newDecoratedText()
    .setText(statusLabel ? goal.icon + '&nbsp;' + statusLabel : goal.icon)
    .setWrapText(false);

  var windowBadge = formatWindowBadge(goal, dateKey);
  if (windowBadge) {
    decoratedText.setBottomLabel(windowBadge);
  }

  var buttonSet = CardService.newButtonSet()
    .addButton(
      CardService.newTextButton()
        .setMaterialIcon(CardService.newMaterialIcon().setName('check_circle'))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(GOAL_COLOR_SUCCESS)
        .setOnClickAction(successAction)
    )
    .addButton(
      CardService.newTextButton()
        .setMaterialIcon(CardService.newMaterialIcon().setName('cancel'))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(GOAL_COLOR_FAIL)
        .setOnClickAction(failAction)
    )
    .addButton(
      CardService.newTextButton()
        .setMaterialIcon(CardService.newMaterialIcon().setName('undo'))
        .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
        .setOnClickAction(clearAction)
    )
    .addButton(
      CardService.newTextButton()
        .setMaterialIcon(CardService.newMaterialIcon().setName('edit'))
        .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
        .setOnClickAction(editAction)
    )
    .addButton(
      CardService.newTextButton()
        .setMaterialIcon(CardService.newMaterialIcon().setName('delete'))
        .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
        .setOnClickAction(deleteAction)
    );

  return { decoratedText: decoratedText, buttonSet: buttonSet };
}

function buildHomeCard(dateKey, goalsWithStatus) {
  var navSection = CardService.newCardSection().addWidget(buildDateNavRowWidget(dateKey));

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

  var summarySection = CardService.newCardSection().setHeader('Goal summary');
  if (!goalsWithStatus || goalsWithStatus.length === 0) {
    summarySection.addWidget(CardService.newTextParagraph().setText('No goals yet.'));
  } else {
    goalsWithStatus.forEach(function (entry) {
      summarySection.addWidget(buildGoalSummaryRowWidget(entry.goal, entry.summary));
    });
  }

  var actionsSection = CardService.newCardSection();
  var newGoalAction = CardService.newAction().setFunctionName('handleOpenCreateGoalCard');
  actionsSection.addWidget(
    CardService.newButtonSet().addButton(
      CardService.newTextButton()
        .setText('Create goal')
        .setMaterialIcon(CardService.newMaterialIcon().setName('add'))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(GOAL_COLOR_PRIMARY)
        .setOnClickAction(newGoalAction)
    )
  );

  return CardService.newCardBuilder()
    .addSection(navSection)
    .addSection(goalsSection)
    .addSection(summarySection)
    .addSection(actionsSection)
    .build();
}

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

function buildDatePickerCard(dateKey) {
  var header = CardService.newCardHeader().setTitle('Choose a day');
  var datePicker = CardService.newDatePicker()
    .setFieldName('selectedDate')
    .setTitle('Day')
    .setValueInMsSinceEpoch(dateKeyToUtcMs(dateKey));

  var goAction = CardService.newAction().setFunctionName('handleGoToDate');
  var goButton = CardService.newTextButton()
    .setText('Go to day')
    .setMaterialIcon(CardService.newMaterialIcon().setName('arrow_forward'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor(GOAL_COLOR_PRIMARY)
    .setOnClickAction(goAction);

  var section = CardService.newCardSection().addWidget(datePicker).addWidget(goButton);

  return CardService.newCardBuilder().setHeader(header).addSection(section).build();
}

function buildErrorCard(message) {
  var header = CardService.newCardHeader().setTitle('Goals & Habits');
  var section = CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText(
      'Something went wrong talking to Google Calendar: ' + message + '\n\nTry reopening the add-on.'
    )
  );
  return CardService.newCardBuilder().setHeader(header).addSection(section).build();
}

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    formatStatusLabel: formatStatusLabel
  };
}
