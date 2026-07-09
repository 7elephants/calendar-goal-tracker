/**
 * Unit tests for src/DateKeyUtils.js. Pure functions, no Apps Script
 * globals to mock.
 */

var DateKeyUtils = require('../src/DateKeyUtils.js');

describe('DateKeyUtils', function () {
  describe('getDateKey', function () {
    it('formats a Date as YYYY-MM-DD', function () {
      expect(DateKeyUtils.getDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });

  describe('addDaysToDateKey', function () {
    it('adds days and rolls over month boundaries', function () {
      expect(DateKeyUtils.addDaysToDateKey('2026-01-31', 1)).toBe('2026-02-01');
    });
  });

  describe('dateKeyToUtcMs / utcMsToDateKey', function () {
    it('round-trips a dateKey through UTC epoch ms regardless of local timezone', function () {
      var ms = DateKeyUtils.dateKeyToUtcMs('2026-01-05');
      expect(DateKeyUtils.utcMsToDateKey(ms)).toBe('2026-01-05');
    });

    it('produces UTC midnight for the given day', function () {
      var ms = DateKeyUtils.dateKeyToUtcMs('2026-01-05');
      var d = new Date(ms);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(0);
      expect(d.getUTCDate()).toBe(5);
      expect(d.getUTCHours()).toBe(0);
    });

    it('rolls over year boundaries correctly', function () {
      var ms = DateKeyUtils.dateKeyToUtcMs('2025-12-31');
      expect(DateKeyUtils.utcMsToDateKey(ms)).toBe('2025-12-31');
    });
  });

  describe('daysBetweenDateKeys', function () {
    it('counts whole days between two dateKeys', function () {
      expect(DateKeyUtils.daysBetweenDateKeys('2026-07-01', '2026-07-08')).toBe(7);
    });

    it('returns 0 for the same dateKey', function () {
      expect(DateKeyUtils.daysBetweenDateKeys('2026-07-08', '2026-07-08')).toBe(0);
    });

    it('rolls over a DST spring-forward boundary without an off-by-one', function () {
      // US DST started 2026-03-08; a naive (to - from) / msPerDay would compute 0.958 days, not 1.
      expect(DateKeyUtils.daysBetweenDateKeys('2026-03-07', '2026-03-08')).toBe(1);
    });
  });
});
