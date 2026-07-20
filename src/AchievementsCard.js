/**
 * ---
 * file: src/AchievementsCard.js
 * workflow:
 *   invocation: "Called only by ActionHandlers.js's handleOpenAchievementsCard; a read-only trophy case of every achievement ever earned, grouped by goal (AchievementService.groupAchievementsByGoal's output), newest achievement first within each group."
 *   steps:
 *     - step: 1
 *       call: "formatEarnedDate_(earnedAt)"
 *       input: "earnedAt: ISO timestamp string (AchievementRecord.earnedAt)"
 *       output: "'MMM d, yyyy' display string in the script's timezone, e.g. 'Jul 20, 2026'"
 *     - step: 2
 *       call: "buildAchievementGroupSection_(group)"
 *       input: "group: { goalId, goalIcon, goalName, records } (one entry from AchievementService.groupAchievementsByGoal)"
 *       output: "CardService.CardSection headed with the goal's icon+name, one read-only DecoratedText row per record (label as the main text, earned date as the bottom label)"
 *     - step: 3
 *       call: "buildAchievementsCard(groups)"
 *       input: "groups: Array<{ goalId, goalIcon, goalName, records }>"
 *       output: "CardService.Card titled 'Achievements' with one section per goal group, or a single empty-state paragraph if groups is empty - no action buttons anywhere, matching AllGoalsCard's read-only style"
 * ---
 */

function formatEarnedDate_(earnedAt) {
  return Utilities.formatDate(new Date(earnedAt), Session.getScriptTimeZone(), 'MMM d, yyyy');
}

function buildAchievementGroupSection_(group) {
  var section = CardService.newCardSection().setHeader(group.goalIcon + ' <b>' + group.goalName + '</b>');
  group.records.forEach(function (record) {
    section.addWidget(
      CardService.newDecoratedText()
        .setText(record.label)
        .setBottomLabel(formatEarnedDate_(record.earnedAt))
        .setWrapText(true)
    );
  });
  return section;
}

function buildAchievementsCard(groups) {
  var header = CardService.newCardHeader().setTitle('Achievements');
  var builder = CardService.newCardBuilder().setHeader(header);

  if (groups.length === 0) {
    var emptySection = CardService.newCardSection().addWidget(
      CardService.newTextParagraph().setText('No achievements yet. Keep marking your goals!')
    );
    builder.addSection(emptySection);
  } else {
    groups.forEach(function (group) {
      builder.addSection(buildAchievementGroupSection_(group));
    });
  }

  return builder.build();
}
