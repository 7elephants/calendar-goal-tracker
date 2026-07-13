/**
 * ---
 * file: src/AllGoalsCard.js
 * workflow:
 *   invocation: "Called only by ActionHandlers.js's handleOpenAllGoalsCard; a read-only listing of every goal (active and soft-deleted), reusing HomeCard.js's buildGoalSummaryRowWidget so each row looks identical to a 'Goal summary' row on the home card - no action buttons, matching that section's read-only style."
 *   steps:
 *     - step: 1
 *       call: "buildGoalGroupSection_(header, goalsWithSummary, emptyMessage)"
 *       input: "header: string (may include CardService's limited HTML, e.g. '<b>'), goalsWithSummary: Array<{ goal: Goal, summary: CalendarService.getGoalSummaryStats() result }>, emptyMessage: string shown when the array is empty"
 *       output: "CardService.CardSection with one buildGoalSummaryRowWidget() row per goal, or a single text paragraph if there are none"
 *     - step: 2
 *       call: "buildAllGoalsCard(activeGoalsWithSummary, deletedGoalsWithSummary)"
 *       input: "both Array<{ goal: Goal, summary: CalendarService.getGoalSummaryStats() result }>, already partitioned by GoalRules.isActive"
 *       output: "CardService.Card titled 'All goals' with two sections, 'Active' and 'Completed' (the latter being soft-deleted goals - see GoalService.deleteGoal; their data and past Calendar events are preserved, this card is the only place they're visible again, and there is still no restore action anywhere in the add-on)"
 * ---
 */

function buildGoalGroupSection_(header, goalsWithSummary, emptyMessage) {
  var section = CardService.newCardSection().setHeader(header);
  if (goalsWithSummary.length === 0) {
    section.addWidget(CardService.newTextParagraph().setText(emptyMessage));
  } else {
    goalsWithSummary.forEach(function (entry) {
      section.addWidget(buildGoalSummaryRowWidget(entry.goal, entry.summary));
    });
  }
  return section;
}

function buildAllGoalsCard(activeGoalsWithSummary, deletedGoalsWithSummary) {
  var header = CardService.newCardHeader().setTitle('All goals');
  var activeSection = buildGoalGroupSection_('<b>Active</b>', activeGoalsWithSummary, 'No active goals.');
  var deletedSection = buildGoalGroupSection_('<b>Completed</b>', deletedGoalsWithSummary, 'No completed goals.');

  return CardService.newCardBuilder()
    .setHeader(header)
    .addSection(activeSection)
    .addSection(deletedSection)
    .build();
}
