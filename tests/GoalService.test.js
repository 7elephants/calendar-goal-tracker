/**
 * Unit tests for src/GoalService.js. Mocks PropertiesService/Utilities since
 * those only exist inside the Apps Script runtime.
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

function validGoalInput(overrides) {
  return Object.assign({ name: 'Run', icon: '🏃', startDate: '2026-07-08', durationDays: 30 }, overrides);
}

describe('GoalService', function () {
  var GoalService;
  var userProps;
  var uuidCounter;

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
        return 'uuid-' + uuidCounter;
      }
    };

    GoalService = require('../src/GoalService.js');
  });

  afterEach(function () {
    delete global.PropertiesService;
    delete global.Utilities;
  });

  describe('validateGoalInput', function () {
    it('throws when name is missing', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ name: '  ' }));
      }).toThrow('Goal name is required.');
    });

    it('throws when icon is missing', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ icon: '' }));
      }).toThrow('Goal icon');
    });

    it('throws when name exceeds 60 characters', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ name: 'x'.repeat(61) }));
      }).toThrow('60 characters');
    });

    it('throws when icon exceeds 4 characters', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ icon: 'toolong' }));
      }).toThrow('4 characters');
    });

    it('accepts valid input without throwing', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput());
      }).not.toThrow();
    });

    it('accepts a compound ZWJ emoji even though it is >4 UTF-16 units', function () {
      // "person running: female sign" = runner + ZWJ + female sign + VS16 = 4 code points, 7 UTF-16 units
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ icon: '🏃‍♀️' }));
      }).not.toThrow();
    });

    it('throws when startDate is missing', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ startDate: undefined }));
      }).toThrow('valid start date is required');
    });

    it('throws when startDate is not a real calendar date', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ startDate: '2026-02-30' }));
      }).toThrow('valid start date is required');
    });

    it('throws when durationDays is missing', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ durationDays: undefined }));
      }).toThrow('Duration must be');
    });

    it('throws when durationDays is not a whole number', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ durationDays: 2.5 }));
      }).toThrow('Duration must be');
    });

    it('accepts durationDays of 0 to mean the goal runs forever', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ durationDays: 0 }));
      }).not.toThrow();
    });

    it('throws when durationDays is negative', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ durationDays: -1 }));
      }).toThrow('Duration must be');
    });

    it('throws when durationDays exceeds the maximum', function () {
      expect(function () {
        GoalService.validateGoalInput(validGoalInput({ durationDays: 3651 }));
      }).toThrow('Duration must be');
    });
  });

  describe('listGoals', function () {
    it('returns an empty array when nothing has been stored', function () {
      expect(GoalService.listGoals()).toEqual([]);
    });

    it('returns [] if stored value is corrupted JSON', function () {
      userProps.setProperty(GoalService.GOALS_PROPERTY_KEY, '{not json');
      expect(GoalService.listGoals()).toEqual([]);
    });
  });

  describe('createGoal', function () {
    it('creates and persists a new goal with a generated id', function () {
      var goal = GoalService.createGoal(validGoalInput({ name: 'Run 3 miles', icon: '🏃' }));

      expect(goal.id).toBe('uuid-1');
      expect(goal.name).toBe('Run 3 miles');
      expect(goal.icon).toBe('🏃');
      expect(goal.startDate).toBe('2026-07-08');
      expect(goal.durationDays).toBe(30);
      expect(goal.active).toBe(true);
      expect(GoalService.listGoals()).toHaveLength(1);
    });

    it('rejects invalid input before touching storage', function () {
      expect(function () {
        GoalService.createGoal(validGoalInput({ name: '' }));
      }).toThrow('Goal name is required.');
      expect(GoalService.listGoals()).toHaveLength(0);
    });

    it('creates a goal with durationDays 0 to mean it runs forever', function () {
      var goal = GoalService.createGoal(validGoalInput({ durationDays: 0 }));
      expect(goal.durationDays).toBe(0);
    });
  });

  describe('getGoal', function () {
    it('finds a goal by id', function () {
      var created = GoalService.createGoal(validGoalInput({ name: 'Meditate', icon: '🧘' }));
      expect(GoalService.getGoal(created.id)).toEqual(created);
    });

    it('returns null for an unknown id', function () {
      expect(GoalService.getGoal('does-not-exist')).toBeNull();
    });
  });

  describe('updateGoal', function () {
    it('updates name, icon, and active flag', function () {
      var created = GoalService.createGoal(validGoalInput({ name: 'Meditate', icon: '🧘' }));
      var updated = GoalService.updateGoal(created.id, { name: 'Meditate daily', active: false });

      expect(updated.name).toBe('Meditate daily');
      expect(updated.icon).toBe('🧘');
      expect(updated.active).toBe(false);
    });

    it('updates startDate and durationDays', function () {
      var created = GoalService.createGoal(validGoalInput({ name: 'Meditate', icon: '🧘' }));
      var updated = GoalService.updateGoal(created.id, { startDate: '2026-08-01', durationDays: 60 });

      expect(updated.startDate).toBe('2026-08-01');
      expect(updated.durationDays).toBe(60);
    });

    it('updates durationDays to 0 to make a fixed-duration goal run forever', function () {
      var created = GoalService.createGoal(validGoalInput({ name: 'Meditate', icon: '🧘' }));
      var updated = GoalService.updateGoal(created.id, { durationDays: 0 });

      expect(updated.durationDays).toBe(0);
    });

    it('throws for an unknown goal id', function () {
      expect(function () {
        GoalService.updateGoal('missing', { name: 'x' });
      }).toThrow('Goal not found');
    });

    it('re-validates the merged goal, rejecting a blank name', function () {
      var created = GoalService.createGoal(validGoalInput({ name: 'Meditate', icon: '🧘' }));
      expect(function () {
        GoalService.updateGoal(created.id, { name: '   ' });
      }).toThrow('Goal name is required.');
    });
  });

  describe('deleteGoal', function () {
    it('removes an existing goal and returns true', function () {
      var created = GoalService.createGoal(validGoalInput({ name: 'Meditate', icon: '🧘' }));
      expect(GoalService.deleteGoal(created.id)).toBe(true);
      expect(GoalService.listGoals()).toHaveLength(0);
    });

    it('returns false when the goal does not exist', function () {
      expect(GoalService.deleteGoal('missing')).toBe(false);
    });
  });
});
