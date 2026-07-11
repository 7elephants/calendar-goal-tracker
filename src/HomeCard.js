/**
 * ---
 * file: src/HomeCard.js
 * workflow:
 *   invocation: "Called only by ActionHandlers.js's action handlers; builds the home card's CardService UI, never calls GoalService/CalendarService storage directly except to read display data."
 *   steps:
 *     - step: 1
 *       call: "formatStatusLabel(status)"
 *       input: "'success' | 'fail' | null"
 *       output: "emoji status label string: '✅', '❌', or ''"
 *     - step: 2
 *       call: "buildHomeCard(dateKey, goalsWithStatus)"
 *       input: "dateKey: 'YYYY-MM-DD', goalsWithStatus: Array<{ goal: Goal, status: string|null, summary: CalendarService.getGoalSummaryStats() result }>"
 *       output: "CardService.Card with no CardHeader (title is required by CardHeader so an empty one is unsafe; the add-on's own name in Calendar's chrome already labels the card). First widget is a date-nav row (chevron_left/chevron_right call handleShiftDay to move +/-1 day in place; the date label between them calls handleOpenDatePickerCard). Then today's goals, one row per goal: a DecoratedText whose primary text is the goal's icon plus its status mark (large - DecoratedText's topLabel/bottomLabel captions render smaller than its main text, and CardService text widgets have no font-size control, so the icon lives in the main text slot to appear bigger; the goal name is intentionally not shown on the home card at all) immediately followed by a single ButtonSet grouping Mark done/Clear/Edit/Delete plus Mark missed (omitted entirely for a Count only goal - GoalRules.isCountOnly(goal) - since it has no 'missed' concept), since DecoratedText's own trailing slot only accepts one button, not a set. Then a read-only 'Goal summary' section (same icon-plus-text layout: icon, duration, days left/done counts, plus a missed count for Pass/Fail goals only; duration/days-left render as '∞' for forever goals, i.e. GoalRules.isForever(goal)), and a Create goal action."
 * ---
 */

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
  var windowStatus = GoalRules.windowStatus(goal, dateKey);
  if (windowStatus === 'upcoming') {
    return 'Starts ' + formatDisplayDate(goal.startDate);
  }
  if (windowStatus === 'completed') {
    return '🏁 Completed (' + goal.durationDays + '-day goal)';
  }
  return null;
}

function formatGoalSummaryLine(goal, stats) {
  var durationLabel = stats.durationDays !== null ? stats.durationDays + ' days' : '∞';
  var daysLeftLabel = (stats.daysLeft !== null ? stats.daysLeft : '∞') + ' left';
  var line = 'Duration: ' + durationLabel + '  ·  ' + daysLeftLabel + '  ·  ✅ ' + stats.daysDone;
  if (!GoalRules.isCountOnly(goal)) {
    line += '  ·  ❌ ' + stats.daysMissed;
  }
  return line;
}

function buildGoalSummaryRowWidget(goal, stats) {
  return CardService.newDecoratedText()
    .setText(goal.icon + '&nbsp;' + formatGoalSummaryLine(goal, stats))
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

  var buttonSet = CardService.newButtonSet();

  buttonSet.addButton(
    CardService.newTextButton()
      .setMaterialIcon(CardService.newMaterialIcon().setName('check_circle'))
      .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
      .setBackgroundColor(GOAL_COLOR_SUCCESS)
      .setOnClickAction(successAction)
      .setAltText('Mark done')
  );

  // Count-only goals have no "missed" concept, so there's nothing to fail -
  // the button is simply not offered rather than disabled.
  if (!GoalRules.isCountOnly(goal)) {
    buttonSet.addButton(
      CardService.newTextButton()
        .setMaterialIcon(CardService.newMaterialIcon().setName('cancel'))
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setBackgroundColor(GOAL_COLOR_FAIL)
        .setOnClickAction(failAction)
        .setAltText('Mark failed')
    );
  }

  buttonSet.addButton(
    CardService.newTextButton()
      .setMaterialIcon(CardService.newMaterialIcon().setName('undo'))
      .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
      .setOnClickAction(clearAction)
      .setAltText('Clear')
  );
  buttonSet.addButton(
    CardService.newTextButton()
      .setMaterialIcon(CardService.newMaterialIcon().setName('edit'))
      .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
      .setOnClickAction(editAction)
      .setAltText('Edit')
  );
  buttonSet.addButton(
    CardService.newTextButton()
      .setMaterialIcon(CardService.newMaterialIcon().setName('delete'))
      .setTextButtonStyle(CardService.TextButtonStyle.OUTLINED)
      .setOnClickAction(deleteAction)
      .setAltText('Delete')
  );

  return { decoratedText: decoratedText, buttonSet: buttonSet };
}

function buildHomeCard(dateKey, goalsWithStatus) {
  var navSection = CardService.newCardSection().addWidget(buildDateNavRowWidget(dateKey));

  var goalsSection = CardService.newCardSection().setHeader('<b>Today’s goals');
  if (!goalsWithStatus || goalsWithStatus.length === 0) {
    goalsSection.addWidget(CardService.newTextParagraph().setText('No goals yet. Create one below.'));
  } else {
    goalsWithStatus.forEach(function (entry) {
      var row = buildGoalRowWidget(entry.goal, dateKey, entry.status);
      goalsSection.addWidget(row.decoratedText);
      goalsSection.addWidget(row.buttonSet);
    });
  }

  var summarySection = CardService.newCardSection().setHeader('<b>Goal summary</b>');
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

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    formatStatusLabel: formatStatusLabel
  };
}
