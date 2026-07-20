/**
 * Unit tests for src/AchievementRules.js. Pure module; only dependency
 * (GoalRules.js) is itself pure, so no Apps Script mocks are needed.
 */

var AchievementRules = require('../src/AchievementRules.js');

function stats(overrides) {
  return Object.assign({ currentStreak: 0, daysDone: 0, daysMissed: 0, durationDays: null, daysLeft: null }, overrides);
}

describe('AchievementRules', function () {
  describe('detectNewAchievements', function () {
    describe('streak family', function () {
      var passFailGoal = { id: 'g1', goalType: 'passFail', durationDays: 0 };

      it('fires when currentStreak crosses a threshold (6 -> 7)', function () {
        var earned = AchievementRules.detectNewAchievements(
          passFailGoal,
          stats({ currentStreak: 6 }),
          stats({ currentStreak: 7 })
        );
        expect(earned).toEqual([{ family: 'streak', threshold: 7, label: '🔥 7-day streak' }]);
      });

      it('does not fire again once already above the threshold (7 -> 8)', function () {
        var earned = AchievementRules.detectNewAchievements(
          passFailGoal,
          stats({ currentStreak: 7 }),
          stats({ currentStreak: 8 })
        );
        expect(earned).toEqual([]);
      });

      it('re-fires after the streak resets and crosses the same threshold again', function () {
        var earned = AchievementRules.detectNewAchievements(
          passFailGoal,
          stats({ currentStreak: 0 }),
          stats({ currentStreak: 7 })
        );
        expect(earned).toEqual([{ family: 'streak', threshold: 7, label: '🔥 7-day streak' }]);
      });

      it('emits one entry per threshold crossed in a single jump (6 -> 31 crosses 7 and 30)', function () {
        var earned = AchievementRules.detectNewAchievements(
          passFailGoal,
          stats({ currentStreak: 6 }),
          stats({ currentStreak: 31 })
        );
        expect(earned).toEqual([
          { family: 'streak', threshold: 7, label: '🔥 7-day streak' },
          { family: 'streak', threshold: 30, label: '🔥 30-day streak' }
        ]);
      });

      it('does not fire on a decrease (Clear/Fail dropping the streak)', function () {
        var earned = AchievementRules.detectNewAchievements(
          passFailGoal,
          stats({ currentStreak: 7 }),
          stats({ currentStreak: 0 })
        );
        expect(earned).toEqual([]);
      });

      it('never applies to a Count only goal', function () {
        var countOnlyGoal = { id: 'g1', goalType: 'countOnly', durationDays: 0 };
        var earned = AchievementRules.detectNewAchievements(
          countOnlyGoal,
          stats({ currentStreak: 6 }),
          stats({ currentStreak: 7 })
        );
        expect(earned).toEqual([]);
      });
    });

    describe('count family', function () {
      var countOnlyGoal = { id: 'g1', goalType: 'countOnly', durationDays: 0 };

      it('fires when daysDone crosses a threshold (9 -> 10)', function () {
        var earned = AchievementRules.detectNewAchievements(
          countOnlyGoal,
          stats({ daysDone: 9 }),
          stats({ daysDone: 10 })
        );
        expect(earned).toEqual([{ family: 'count', threshold: 10, label: '✅ 10 days done' }]);
      });

      it('never applies to a Pass/Fail goal', function () {
        var passFailGoal = { id: 'g1', goalType: 'passFail', durationDays: 0 };
        var earned = AchievementRules.detectNewAchievements(
          passFailGoal,
          stats({ daysDone: 9 }),
          stats({ daysDone: 10 })
        );
        expect(earned).toEqual([]);
      });

      it('treats a legacy goal with no stored goalType as Pass/Fail (no count achievement)', function () {
        var legacyGoal = { id: 'g1', durationDays: 0 };
        var earned = AchievementRules.detectNewAchievements(
          legacyGoal,
          stats({ daysDone: 9 }),
          stats({ daysDone: 10 })
        );
        expect(earned).toEqual([]);
      });
    });

    describe('progress family', function () {
      var windowedGoal = { id: 'g1', goalType: 'passFail', startDate: '2026-07-01', durationDays: 10 };

      it('fires when daysDone/durationDays crosses 50%', function () {
        var earned = AchievementRules.detectNewAchievements(
          windowedGoal,
          stats({ daysDone: 4, durationDays: 10 }),
          stats({ daysDone: 5, durationDays: 10 })
        );
        expect(earned).toEqual([{ family: 'progress', threshold: 50, label: '🎯 50% complete' }]);
      });

      it('fires 100% with the flag/finish-line label', function () {
        var earned = AchievementRules.detectNewAchievements(
          windowedGoal,
          stats({ daysDone: 9, durationDays: 10 }),
          stats({ daysDone: 10, durationDays: 10 })
        );
        expect(earned).toEqual([{ family: 'progress', threshold: 100, label: '🏁 100% complete' }]);
      });

      it('applies to a windowed Count only goal too, not just Pass/Fail', function () {
        var windowedCountOnly = { id: 'g1', goalType: 'countOnly', startDate: '2026-07-01', durationDays: 10 };
        var earned = AchievementRules.detectNewAchievements(
          windowedCountOnly,
          stats({ daysDone: 4, durationDays: 10 }),
          stats({ daysDone: 5, durationDays: 10 })
        );
        expect(earned).toContainEqual({ family: 'progress', threshold: 50, label: '🎯 50% complete' });
      });

      it('never applies to a forever goal (durationDays null skips the family entirely)', function () {
        var foreverGoal = { id: 'g1', goalType: 'passFail', durationDays: 0 };
        var earned = AchievementRules.detectNewAchievements(
          foreverGoal,
          stats({ daysDone: 4, durationDays: null }),
          stats({ daysDone: 5, durationDays: null })
        );
        expect(earned).toEqual([]);
      });

      it('skips without throwing if the metric comes back null despite appliesTo passing (defensive double-guard)', function () {
        // Windowed goal so appliesTo (!isForever) is true, but a null
        // durationDays in the stats themselves (a goal/stats mismatch that
        // shouldn't normally happen) must still be handled gracefully.
        var earned = AchievementRules.detectNewAchievements(
          windowedGoal,
          stats({ daysDone: 4, durationDays: null }),
          stats({ daysDone: 5, durationDays: null })
        );
        expect(earned).toEqual([]);
      });
    });

    it('emits achievements from multiple families in a single call (streak + progress together)', function () {
      var windowedGoal = { id: 'g1', goalType: 'passFail', startDate: '2026-07-01', durationDays: 10 };
      var earned = AchievementRules.detectNewAchievements(
        windowedGoal,
        stats({ currentStreak: 6, daysDone: 4, durationDays: 10 }),
        stats({ currentStreak: 7, daysDone: 5, durationDays: 10 })
      );
      expect(earned).toEqual([
        { family: 'streak', threshold: 7, label: '🔥 7-day streak' },
        { family: 'progress', threshold: 50, label: '🎯 50% complete' }
      ]);
    });
  });

  describe('celebrationText', function () {
    it('returns an empty string for no new achievements', function () {
      expect(AchievementRules.celebrationText([])).toBe('');
    });

    it('returns a single celebratory line for exactly one achievement', function () {
      expect(AchievementRules.celebrationText([{ family: 'streak', threshold: 7, label: '🔥 7-day streak' }])).toBe(
        '🎉 🔥 7-day streak!'
      );
    });

    it('returns a count summary for multiple simultaneous achievements', function () {
      var earned = [
        { family: 'streak', threshold: 7, label: '🔥 7-day streak' },
        { family: 'progress', threshold: 50, label: '🎯 50% complete' }
      ];
      expect(AchievementRules.celebrationText(earned)).toBe('🎉 2 new achievements!');
    });
  });
});
