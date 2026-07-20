/**
 * Unit tests for src/GoalRules.js. Mocks the advanced `Calendar` service
 * (needed transitively by CalendarService.js, which this requires) since it
 * only exists inside the Apps Script runtime.
 */

describe('GoalRules', function () {
  var GoalRules;

  beforeEach(function () {
    jest.resetModules();
    global.Calendar = { Events: { list: jest.fn(function () { return { items: [] }; }) } };
    GoalRules = require('../src/GoalRules.js');
  });

  afterEach(function () {
    delete global.Calendar;
  });

  describe('windowStatus', function () {
    it('matches CalendarService.getGoalWindowStatus for a windowed goal', function () {
      var goal = { id: 'goal-1', name: 'Run 3 miles', icon: '🏃', startDate: '2026-07-01', durationDays: 30 };
      expect(GoalRules.windowStatus(goal, '2026-07-08')).toBe('active');
    });

    it('returns null for a forever goal (durationDays: 0)', function () {
      var goal = { id: 'goal-1', name: 'Meditate', icon: '🧘', startDate: '2026-07-01', durationDays: 0 };
      expect(GoalRules.windowStatus(goal, '2026-07-08')).toBeNull();
    });
  });

  describe('summaryStats', function () {
    it('reports durationDays/daysLeft for a windowed goal', function () {
      var goal = {
        id: 'goal-1',
        name: 'Run 3 miles',
        icon: '🏃',
        startDate: '2026-07-01',
        durationDays: 30,
        createdAt: '2026-07-01T00:00:00.000Z'
      };
      var stats = GoalRules.summaryStats(goal, '2026-07-08');
      expect(stats.durationDays).toBe(30);
    });

    it('reports null durationDays/daysLeft for a forever goal', function () {
      var goal = {
        id: 'goal-1',
        name: 'Meditate',
        icon: '🧘',
        startDate: '2026-01-01',
        durationDays: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      var stats = GoalRules.summaryStats(goal, '2026-07-08');
      expect(stats.durationDays).toBeNull();
      expect(stats.daysLeft).toBeNull();
    });
  });

  describe('complianceWindow', function () {
    it('matches CalendarService.getGoalComplianceWindow for a windowed goal', function () {
      var goal = {
        id: 'goal-1',
        name: 'Run 3 miles',
        icon: '🏃',
        startDate: '2026-07-01',
        durationDays: 30,
        createdAt: '2026-06-01T00:00:00.000Z'
      };
      expect(GoalRules.complianceWindow(goal)).toEqual({
        startDateKey: '2026-07-01',
        endDateKeyExclusive: '2026-07-31'
      });
    });

    it('returns a null endDateKeyExclusive for a forever goal', function () {
      var goal = {
        id: 'goal-1',
        name: 'Meditate',
        icon: '🧘',
        startDate: '2026-07-01',
        durationDays: 0,
        createdAt: '2026-06-01T00:00:00.000Z'
      };
      expect(GoalRules.complianceWindow(goal).endDateKeyExclusive).toBeNull();
    });
  });

  describe('isForever', function () {
    it('returns true when durationDays is 0', function () {
      expect(GoalRules.isForever({ startDate: '2026-07-01', durationDays: 0 })).toBe(true);
    });

    it('returns true when durationDays is missing entirely', function () {
      expect(GoalRules.isForever({ startDate: '2026-07-01' })).toBe(true);
    });

    it('returns false when both startDate and a non-zero durationDays are stored', function () {
      expect(GoalRules.isForever({ startDate: '2026-07-01', durationDays: 30 })).toBe(false);
    });
  });

  describe('isCountOnly', function () {
    it('returns true for a countOnly goal', function () {
      expect(GoalRules.isCountOnly({ goalType: 'countOnly' })).toBe(true);
    });

    it('returns false for a passFail goal', function () {
      expect(GoalRules.isCountOnly({ goalType: 'passFail' })).toBe(false);
    });

    it('returns false for a legacy goal with no stored goalType', function () {
      expect(GoalRules.isCountOnly({})).toBe(false);
    });
  });

  describe('isActive', function () {
    it('returns true for a goal with active: true', function () {
      expect(GoalRules.isActive({ active: true })).toBe(true);
    });

    it('returns false for a soft-deleted goal (active: false)', function () {
      expect(GoalRules.isActive({ active: false })).toBe(false);
    });

    it('returns true for a goal with no stored active field at all', function () {
      expect(GoalRules.isActive({})).toBe(true);
    });
  });
});
