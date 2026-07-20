/**
 * Unit tests for src/ChartData.js. Pure module, no mocks needed.
 */

var ChartData = require('../src/ChartData.js');

describe('ChartData', function () {
  describe('buildDailySeries', function () {
    it('returns empty arrays for an empty range', function () {
      var series = ChartData.buildDailySeries({}, '2026-07-08', '2026-07-08');
      expect(series).toEqual({ dateKeys: [], cumulativeCount: [], compliancePct: [] });
    });

    it('reports a flat 0 count and 0% compliance when nothing is marked', function () {
      var series = ChartData.buildDailySeries({}, '2026-07-01', '2026-07-04');
      expect(series.dateKeys).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
      expect(series.cumulativeCount).toEqual([0, 0, 0]);
      expect(series.compliancePct).toEqual([0, 0, 0]);
    });

    it('resets the cumulative count to 0 at the start of the range, not a lifetime total', function () {
      var statusByDate = { '2026-06-30': 'success', '2026-07-01': 'success' };
      var series = ChartData.buildDailySeries(statusByDate, '2026-07-01', '2026-07-03');
      expect(series.cumulativeCount).toEqual([1, 1]);
    });

    it('increments cumulative count only on success days', function () {
      var statusByDate = { '2026-07-01': 'success', '2026-07-02': 'fail', '2026-07-03': 'success' };
      var series = ChartData.buildDailySeries(statusByDate, '2026-07-01', '2026-07-04');
      expect(series.cumulativeCount).toEqual([1, 1, 2]);
    });

    it('is 100% compliant when every elapsed day is a success', function () {
      var statusByDate = { '2026-07-01': 'success', '2026-07-02': 'success' };
      var series = ChartData.buildDailySeries(statusByDate, '2026-07-01', '2026-07-03');
      expect(series.compliancePct).toEqual([100, 100]);
    });

    it('drags compliance down on an explicit fail day', function () {
      var statusByDate = { '2026-07-01': 'success', '2026-07-02': 'fail' };
      var series = ChartData.buildDailySeries(statusByDate, '2026-07-01', '2026-07-03');
      expect(series.compliancePct).toEqual([100, 50]);
    });

    it('drags compliance down on an unmarked day, same as a fail', function () {
      var statusByDate = { '2026-07-01': 'success' };
      var series = ChartData.buildDailySeries(statusByDate, '2026-07-01', '2026-07-03');
      expect(series.compliancePct).toEqual([100, 50]);
    });

    it('rounds compliance percentage to the nearest whole number', function () {
      var statusByDate = { '2026-07-01': 'success' };
      var series = ChartData.buildDailySeries(statusByDate, '2026-07-01', '2026-07-04');
      // 1/1=100, 1/2=50, 1/3=33.33 -> 33
      expect(series.compliancePct).toEqual([100, 50, 33]);
    });
  });

  describe('presetRange', function () {
    it('spans the first through last day of the current month for "thisMonth"', function () {
      expect(ChartData.presetRange('thisMonth', '2026-07-15')).toEqual({
        fromDateKey: '2026-07-01',
        toDateKeyExclusive: '2026-08-01'
      });
    });

    it('rolls a December "thisMonth" over into January of the next year', function () {
      expect(ChartData.presetRange('thisMonth', '2026-12-10')).toEqual({
        fromDateKey: '2026-12-01',
        toDateKeyExclusive: '2027-01-01'
      });
    });

    it('spans the trailing 30 days (inclusive of today) for "last30"', function () {
      expect(ChartData.presetRange('last30', '2026-07-30')).toEqual({
        fromDateKey: '2026-07-01',
        toDateKeyExclusive: '2026-07-31'
      });
    });

    it('spans the current calendar year for "thisYear"', function () {
      expect(ChartData.presetRange('thisYear', '2026-07-15')).toEqual({
        fromDateKey: '2026-01-01',
        toDateKeyExclusive: '2027-01-01'
      });
    });

    it('falls back to "thisMonth" for an unrecognized or missing preset id', function () {
      expect(ChartData.presetRange('bogus', '2026-07-15')).toEqual({
        fromDateKey: '2026-07-01',
        toDateKeyExclusive: '2026-08-01'
      });
      expect(ChartData.presetRange(undefined, '2026-07-15')).toEqual({
        fromDateKey: '2026-07-01',
        toDateKeyExclusive: '2026-08-01'
      });
    });
  });

  describe('labelGoalsByIcon', function () {
    it('labels each goal with just its icon when icons are unique', function () {
      var goals = [{ icon: '🏃' }, { icon: '🧘' }];
      expect(ChartData.labelGoalsByIcon(goals)).toEqual(['🏃', '🧘']);
    });

    it('suffixes repeated icons with a counter so the legend has no duplicate labels', function () {
      var goals = [{ icon: '🏃' }, { icon: '🏃' }, { icon: '🧘' }, { icon: '🏃' }];
      expect(ChartData.labelGoalsByIcon(goals)).toEqual(['🏃', '🏃 (2)', '🧘', '🏃 (3)']);
    });

    it('returns an empty array for no goals', function () {
      expect(ChartData.labelGoalsByIcon([])).toEqual([]);
    });
  });
});
