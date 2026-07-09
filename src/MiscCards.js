/**
 * ---
 * file: src/MiscCards.js
 * workflow:
 *   invocation: "Called only by ActionHandlers.js's action handlers; small standalone cards that don't belong to the home card or the goal form."
 *   steps:
 *     - step: 1
 *       call: "buildDatePickerCard(dateKey)"
 *       input: "dateKey: 'YYYY-MM-DD' currently selected"
 *       output: "CardService.Card with a DatePicker widget (seeded via dateKeyToUtcMs, since the widget is UTC-based) and a 'Go to day' button"
 *     - step: 2
 *       call: "buildErrorCard(message)"
 *       input: "message: string"
 *       output: "CardService.Card shown in place of the home card when a Calendar API call fails, so a backend error never surfaces as a raw crash"
 * ---
 */

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
