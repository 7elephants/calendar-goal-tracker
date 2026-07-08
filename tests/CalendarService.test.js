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
});
