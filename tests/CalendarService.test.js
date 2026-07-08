/**
 * Unit tests for src/CalendarService.js. Mocks the advanced `Calendar`
 * service since it only exists inside the Apps Script runtime.
 */

function makeCalendarMock() {
  var events = {};
  var nextId = 1;
  return {
    Events: {
      list: jest.fn(function (calendarId, options) {
        var props = {};
        (options.privateExtendedProperty || []).forEach(function (pair) {
          var idx = pair.indexOf('=');
          props[pair.slice(0, idx)] = pair.slice(idx + 1);
        });
        var items = Object.values(events).filter(function (ev) {
          var p = (ev.extendedProperties && ev.extendedProperties.private) || {};
          return Object.keys(props).every(function (k) {
            return p[k] === props[k];
          });
        });
        return { items: items };
      }),
      insert: jest.fn(function (resource) {
        var id = 'event-' + nextId++;
        var stored = Object.assign({ id: id }, resource);
        events[id] = stored;
        return stored;
      }),
      update: jest.fn(function (resource, calendarId, eventId) {
        var stored = Object.assign({ id: eventId }, resource);
        events[eventId] = stored;
        return stored;
      }),
      remove: jest.fn(function (calendarId, eventId) {
        delete events[eventId];
      })
    },
    _events: events
  };
}

describe('CalendarService', function () {
  var CalendarService;
  var CalendarMock;
  var goal;

  beforeEach(function () {
    jest.resetModules();
    CalendarMock = makeCalendarMock();
    global.Calendar = CalendarMock;
    CalendarService = require('../src/CalendarService.js');
    goal = { id: 'goal-1', name: 'Run 3 miles', icon: '🏃' };
  });

  afterEach(function () {
    delete global.Calendar;
  });

  describe('getDateKey', function () {
    it('formats a Date as YYYY-MM-DD', function () {
      expect(CalendarService.getDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });

  describe('addDaysToDateKey', function () {
    it('adds days and rolls over month boundaries', function () {
      expect(CalendarService.addDaysToDateKey('2026-01-31', 1)).toBe('2026-02-01');
    });
  });

  describe('dateKeyToUtcMs / utcMsToDateKey', function () {
    it('round-trips a dateKey through UTC epoch ms regardless of local timezone', function () {
      var ms = CalendarService.dateKeyToUtcMs('2026-01-05');
      expect(CalendarService.utcMsToDateKey(ms)).toBe('2026-01-05');
    });

    it('produces UTC midnight for the given day', function () {
      var ms = CalendarService.dateKeyToUtcMs('2026-01-05');
      var d = new Date(ms);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(0);
      expect(d.getUTCDate()).toBe(5);
      expect(d.getUTCHours()).toBe(0);
    });

    it('rolls over year boundaries correctly', function () {
      var ms = CalendarService.dateKeyToUtcMs('2025-12-31');
      expect(CalendarService.utcMsToDateKey(ms)).toBe('2025-12-31');
    });
  });

  describe('buildEventTitle', function () {
    it('includes icon, name, and a success mark', function () {
      expect(CalendarService.buildEventTitle(goal, 'success')).toBe('🏃 Run 3 miles ✅');
    });

    it('includes a fail mark for fail status', function () {
      expect(CalendarService.buildEventTitle(goal, 'fail')).toBe('🏃 Run 3 miles ❌');
    });
  });

  describe('buildEventResource', function () {
    it('builds an all-day event resource tagged with goalId/dateKey/status', function () {
      var resource = CalendarService.buildEventResource(goal, '2026-01-05', 'success');

      expect(resource.start).toEqual({ date: '2026-01-05' });
      expect(resource.end).toEqual({ date: '2026-01-06' });
      expect(resource.colorId).toBe('10');
      expect(resource.extendedProperties.private).toEqual({
        app: 'goal-tracker',
        goalId: 'goal-1',
        dateKey: '2026-01-05',
        status: 'success'
      });
    });

    it('uses the fail color for fail status', function () {
      var resource = CalendarService.buildEventResource(goal, '2026-01-05', 'fail');
      expect(resource.colorId).toBe('11');
    });
  });

  describe('setGoalStatus / getGoalStatusForDate', function () {
    it('creates a new event when none exists', function () {
      var date = new Date(2026, 0, 5);
      CalendarService.setGoalStatus(goal, date, 'success');

      expect(CalendarMock.Events.insert).toHaveBeenCalledTimes(1);
      expect(CalendarService.getGoalStatusForDate(goal.id, date)).toBe('success');
    });

    it('updates the existing event instead of creating a duplicate', function () {
      var date = new Date(2026, 0, 5);
      CalendarService.setGoalStatus(goal, date, 'success');
      CalendarService.setGoalStatus(goal, date, 'fail');

      expect(CalendarMock.Events.insert).toHaveBeenCalledTimes(1);
      expect(CalendarMock.Events.update).toHaveBeenCalledTimes(1);
      expect(CalendarService.getGoalStatusForDate(goal.id, date)).toBe('fail');
    });

    it('removes the event when status is null', function () {
      var date = new Date(2026, 0, 5);
      CalendarService.setGoalStatus(goal, date, 'success');
      CalendarService.setGoalStatus(goal, date, null);

      expect(CalendarMock.Events.remove).toHaveBeenCalledTimes(1);
      expect(CalendarService.getGoalStatusForDate(goal.id, date)).toBeNull();
    });

    it('returns null for a date with no event', function () {
      expect(CalendarService.getGoalStatusForDate(goal.id, new Date(2026, 0, 5))).toBeNull();
    });
  });

  describe('getGoalWindowStatus', function () {
    var windowedGoal = { id: 'goal-1', name: 'Run 3 miles', icon: '🏃', startDate: '2026-07-01', durationDays: 30 };

    it('returns null for a goal with no startDate/durationDays (created before this feature)', function () {
      expect(CalendarService.getGoalWindowStatus(goal, '2026-07-08')).toBeNull();
    });

    it('returns null for a forever goal (durationDays: 0), same as no badge at all', function () {
      var foreverGoal = { id: 'goal-1', name: 'Meditate', icon: '🧘', startDate: '2026-07-01', durationDays: 0 };
      expect(CalendarService.getGoalWindowStatus(foreverGoal, '2026-07-08')).toBeNull();
    });

    it('returns "upcoming" before the start date', function () {
      expect(CalendarService.getGoalWindowStatus(windowedGoal, '2026-06-30')).toBe('upcoming');
    });

    it('returns "active" on the start date', function () {
      expect(CalendarService.getGoalWindowStatus(windowedGoal, '2026-07-01')).toBe('active');
    });

    it('returns "active" on the last day of the window', function () {
      expect(CalendarService.getGoalWindowStatus(windowedGoal, '2026-07-30')).toBe('active');
    });

    it('returns "completed" the day after the window ends', function () {
      expect(CalendarService.getGoalWindowStatus(windowedGoal, '2026-07-31')).toBe('completed');
    });
  });

  describe('daysBetweenDateKeys', function () {
    it('counts whole days between two dateKeys', function () {
      expect(CalendarService.daysBetweenDateKeys('2026-07-01', '2026-07-08')).toBe(7);
    });

    it('returns 0 for the same dateKey', function () {
      expect(CalendarService.daysBetweenDateKeys('2026-07-08', '2026-07-08')).toBe(0);
    });

    it('rolls over a DST spring-forward boundary without an off-by-one', function () {
      // US DST started 2026-03-08; a naive (to - from) / msPerDay would compute 0.958 days, not 1.
      expect(CalendarService.daysBetweenDateKeys('2026-03-07', '2026-03-08')).toBe(1);
    });
  });

  describe('getGoalStatusCounts', function () {
    it('tallies success and fail events for a goal within range', function () {
      CalendarService.setGoalStatus(goal, new Date(2026, 6, 1), 'success');
      CalendarService.setGoalStatus(goal, new Date(2026, 6, 2), 'success');
      CalendarService.setGoalStatus(goal, new Date(2026, 6, 3), 'fail');

      var counts = CalendarService.getGoalStatusCounts(goal.id, '2026-07-01', '2026-07-08');
      expect(counts).toEqual({ success: 2, fail: 1 });
    });

    it('ignores events for other goals', function () {
      CalendarService.setGoalStatus(goal, new Date(2026, 6, 1), 'success');
      CalendarService.setGoalStatus({ id: 'goal-2', name: 'Other', icon: '🧘' }, new Date(2026, 6, 1), 'fail');

      var counts = CalendarService.getGoalStatusCounts(goal.id, '2026-07-01', '2026-07-08');
      expect(counts).toEqual({ success: 1, fail: 0 });
    });

    it('paginates through multiple pages of results', function () {
      var calls = 0;
      // CalendarService.js reads `Calendar` as a global at call time, so
      // swapping it here (without re-requiring the module) still takes effect.
      global.Calendar = {
        Events: {
          list: jest.fn(function () {
            calls++;
            if (calls === 1) {
              return {
                items: [{ extendedProperties: { private: { status: 'success' } } }],
                nextPageToken: 'page-2'
              };
            }
            return { items: [{ extendedProperties: { private: { status: 'fail' } } }] };
          })
        }
      };

      var counts = CalendarService.getGoalStatusCounts('goal-1', '2026-07-01', '2026-08-01');
      expect(counts).toEqual({ success: 1, fail: 1 });
      expect(global.Calendar.Events.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('getGoalSummaryStats', function () {
    it('reports durationDays/daysLeft and tallies within the window for a windowed goal', function () {
      var windowedGoal = {
        id: 'goal-1',
        name: 'Run 3 miles',
        icon: '🏃',
        startDate: '2026-07-01',
        durationDays: 30,
        createdAt: '2026-07-01T00:00:00.000Z'
      };
      CalendarService.setGoalStatus(windowedGoal, new Date(2026, 6, 1), 'success');
      CalendarService.setGoalStatus(windowedGoal, new Date(2026, 6, 2), 'fail');

      var stats = CalendarService.getGoalSummaryStats(windowedGoal, '2026-07-08');
      expect(stats.durationDays).toBe(30);
      expect(stats.daysLeft).toBe(CalendarService.daysBetweenDateKeys('2026-07-08', '2026-07-31'));
      expect(stats.daysDone).toBe(1);
      expect(stats.daysMissed).toBe(1);
    });

    it('reports the full duration as daysLeft for a goal that has not started yet', function () {
      var upcomingGoal = {
        id: 'goal-1',
        name: 'Run 3 miles',
        icon: '🏃',
        startDate: '2026-08-01',
        durationDays: 30,
        createdAt: '2026-07-01T00:00:00.000Z'
      };
      var stats = CalendarService.getGoalSummaryStats(upcomingGoal, '2026-07-08');
      expect(stats.daysLeft).toBe(30);
    });

    it('clamps daysLeft to 0 once the window has ended', function () {
      var endedGoal = {
        id: 'goal-1',
        name: 'Run 3 miles',
        icon: '🏃',
        startDate: '2026-01-01',
        durationDays: 10,
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      var stats = CalendarService.getGoalSummaryStats(endedGoal, '2026-07-08');
      expect(stats.daysLeft).toBe(0);
    });

    it('treats a goal with no durationDays as infinite (null) and counts from startDate through today', function () {
      var foreverGoal = {
        id: 'goal-1',
        name: 'Meditate',
        icon: '🧘',
        startDate: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      CalendarService.setGoalStatus(foreverGoal, new Date(2026, 5, 1), 'success');

      var stats = CalendarService.getGoalSummaryStats(foreverGoal, '2026-07-08');
      expect(stats.durationDays).toBeNull();
      expect(stats.daysLeft).toBeNull();
      expect(stats.daysDone).toBe(1);
    });

    it('treats durationDays: 0 as infinite (null), same as an absent durationDays field', function () {
      var foreverGoal = {
        id: 'goal-1',
        name: 'Meditate',
        icon: '🧘',
        startDate: '2026-01-01',
        durationDays: 0,
        createdAt: '2026-01-01T00:00:00.000Z'
      };
      CalendarService.setGoalStatus(foreverGoal, new Date(2026, 5, 1), 'success');

      var stats = CalendarService.getGoalSummaryStats(foreverGoal, '2026-07-08');
      expect(stats.durationDays).toBeNull();
      expect(stats.daysLeft).toBeNull();
      expect(stats.daysDone).toBe(1);
    });

    it('falls back to createdAt when even startDate is missing (goal predates that field too)', function () {
      var veryOldGoal = { id: 'goal-1', name: 'Meditate', icon: '🧘', createdAt: '2026-01-01T00:00:00.000Z' };
      CalendarService.setGoalStatus(veryOldGoal, new Date(2026, 5, 1), 'fail');

      var stats = CalendarService.getGoalSummaryStats(veryOldGoal, '2026-07-08');
      expect(stats.durationDays).toBeNull();
      expect(stats.daysMissed).toBe(1);
    });
  });
});
