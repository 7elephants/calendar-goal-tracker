/**
 * Unit tests for src/AchievementService.js. Mocks PropertiesService/Utilities
 * since those only exist inside the Apps Script runtime, same harness as
 * tests/GoalService.test.js.
 */

function makeUserPropertiesMock() {
  var store = {};
  return {
    getProperty: function (key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setProperty: function (key, value) {
      store[key] = value;
    },
    _store: store
  };
}

describe('AchievementService', function () {
  var AchievementService;
  var userProps;
  var uuidCounter;
  var goal;

  beforeEach(function () {
    jest.resetModules();
    userProps = makeUserPropertiesMock();
    uuidCounter = 0;

    global.PropertiesService = {
      getUserProperties: function () {
        return userProps;
      }
    };
    global.Utilities = {
      getUuid: function () {
        uuidCounter += 1;
        return 'achievement-uuid-' + uuidCounter;
      }
    };

    AchievementService = require('../src/AchievementService.js');
    goal = { id: 'goal-1', name: 'Run 3 miles', icon: '🏃' };
  });

  afterEach(function () {
    delete global.PropertiesService;
    delete global.Utilities;
  });

  describe('listAchievements', function () {
    it('returns an empty array when nothing has been stored', function () {
      expect(AchievementService.listAchievements()).toEqual([]);
    });

    it('returns [] if stored value is corrupted JSON', function () {
      userProps.setProperty(AchievementService.ACHIEVEMENTS_PROPERTY_KEY, '{not json');
      expect(AchievementService.listAchievements()).toEqual([]);
    });
  });

  describe('recordAchievements', function () {
    it('appends new records with a generated id, snapshotted goal fields, and seen: false', function () {
      var newlyEarned = [{ family: 'streak', threshold: 7, label: '🔥 7-day streak' }];
      var created = AchievementService.recordAchievements(goal, newlyEarned);

      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        id: 'achievement-uuid-1',
        goalId: 'goal-1',
        goalName: 'Run 3 miles',
        goalIcon: '🏃',
        family: 'streak',
        threshold: 7,
        label: '🔥 7-day streak',
        seen: false
      });
      expect(typeof created[0].earnedAt).toBe('string');
      expect(AchievementService.listAchievements()).toEqual(created);
    });

    it('accumulates across multiple calls rather than overwriting', function () {
      AchievementService.recordAchievements(goal, [{ family: 'streak', threshold: 7, label: '🔥 7-day streak' }]);
      AchievementService.recordAchievements(goal, [{ family: 'streak', threshold: 30, label: '🔥 30-day streak' }]);

      expect(AchievementService.listAchievements()).toHaveLength(2);
    });

    it('records multiple simultaneous achievements from one call as separate records', function () {
      var newlyEarned = [
        { family: 'streak', threshold: 7, label: '🔥 7-day streak' },
        { family: 'progress', threshold: 50, label: '🎯 50% complete' }
      ];
      var created = AchievementService.recordAchievements(goal, newlyEarned);
      expect(created).toHaveLength(2);
      expect(AchievementService.listAchievements()).toHaveLength(2);
    });
  });

  describe('countUnseen / markAllSeen', function () {
    it('counts unseen records and clears them all on markAllSeen', function () {
      AchievementService.recordAchievements(goal, [{ family: 'streak', threshold: 7, label: '🔥 7-day streak' }]);
      AchievementService.recordAchievements(goal, [{ family: 'streak', threshold: 30, label: '🔥 30-day streak' }]);
      expect(AchievementService.countUnseen()).toBe(2);

      AchievementService.markAllSeen();
      expect(AchievementService.countUnseen()).toBe(0);
      AchievementService.listAchievements().forEach(function (record) {
        expect(record.seen).toBe(true);
      });
    });

    it('returns 0 when nothing has been recorded yet', function () {
      expect(AchievementService.countUnseen()).toBe(0);
    });
  });

  describe('groupAchievementsByGoal', function () {
    it('groups records by goalId in first-appearance order', function () {
      var records = [
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-01T00:00:00.000Z' },
        { goalId: 'g2', goalIcon: '🧘', goalName: 'Meditate', earnedAt: '2026-07-02T00:00:00.000Z' },
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-03T00:00:00.000Z' }
      ];
      var groups = AchievementService.groupAchievementsByGoal(records);

      expect(groups).toHaveLength(2);
      expect(groups[0].goalId).toBe('g1');
      expect(groups[0].records).toHaveLength(2);
      expect(groups[1].goalId).toBe('g2');
      expect(groups[1].records).toHaveLength(1);
    });

    it('sorts each group\'s records newest-earnedAt-first', function () {
      var records = [
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-01T00:00:00.000Z', label: 'oldest' },
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-05T00:00:00.000Z', label: 'newest' },
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-03T00:00:00.000Z', label: 'middle' }
      ];
      var groups = AchievementService.groupAchievementsByGoal(records);

      expect(groups[0].records.map(function (r) { return r.label; })).toEqual(['newest', 'middle', 'oldest']);
    });

    it('takes the group\'s displayed icon/name from the newest (last-encountered) record', function () {
      var records = [
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Old name', earnedAt: '2026-07-01T00:00:00.000Z' },
        { goalId: 'g1', goalIcon: '🚴', goalName: 'New name', earnedAt: '2026-07-05T00:00:00.000Z' }
      ];
      var groups = AchievementService.groupAchievementsByGoal(records);

      expect(groups[0].goalIcon).toBe('🚴');
      expect(groups[0].goalName).toBe('New name');
    });

    it('returns an empty array for no records', function () {
      expect(AchievementService.groupAchievementsByGoal([])).toEqual([]);
    });

    it('preserves original order for records with identical earnedAt timestamps (a stable tie-break)', function () {
      // recordAchievements stamps every record from one call with the same
      // earnedAt, so simultaneous achievements are a real, common case here.
      var records = [
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-05T00:00:00.000Z', label: 'first' },
        { goalId: 'g1', goalIcon: '🏃', goalName: 'Run', earnedAt: '2026-07-05T00:00:00.000Z', label: 'second' }
      ];
      var groups = AchievementService.groupAchievementsByGoal(records);
      expect(groups[0].records.map(function (r) { return r.label; })).toEqual(['first', 'second']);
    });
  });
});
