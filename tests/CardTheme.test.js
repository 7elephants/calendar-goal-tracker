/**
 * Unit tests for src/CardTheme.js. Plain constants, no Apps Script globals.
 */

var CardTheme = require('../src/CardTheme.js');

describe('CardTheme', function () {
  it('exposes the primary, success, and fail colors as hex strings', function () {
    expect(CardTheme.GOAL_COLOR_PRIMARY).toBe('#1a73e8');
    expect(CardTheme.GOAL_COLOR_SUCCESS).toBe('#188038');
    expect(CardTheme.GOAL_COLOR_FAIL).toBe('#d93025');
  });
});
