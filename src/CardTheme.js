/**
 * ---
 * file: src/CardTheme.js
 * workflow:
 *   invocation: "Shared color constants used by HomeCard.js/GoalFormCard.js/MiscCards.js when building CardService buttons."
 *   steps:
 *     - step: 1
 *       call: "GOAL_COLOR_PRIMARY / GOAL_COLOR_SUCCESS / GOAL_COLOR_FAIL"
 *       input: "none (constants)"
 *       output: "hex color strings: primaryColor from appsscript.json, Google's standard Material green/red for success/destructive actions"
 * ---
 */

// Matches the primaryColor/secondaryColor declared in appsscript.json plus
// Google's standard Material red for the negative/destructive action.
var GOAL_COLOR_PRIMARY = '#1a73e8';
var GOAL_COLOR_SUCCESS = '#188038';
var GOAL_COLOR_FAIL = '#d93025';

// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  module.exports = {
    GOAL_COLOR_PRIMARY: GOAL_COLOR_PRIMARY,
    GOAL_COLOR_SUCCESS: GOAL_COLOR_SUCCESS,
    GOAL_COLOR_FAIL: GOAL_COLOR_FAIL
  };
}
