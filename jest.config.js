module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: [
    'src/Triggers.js',
    'src/ActionHandlers.js',
    'src/CodeHelpers.js',
    'src/HomeCard.js',
    'src/GoalFormCard.js',
    'src/MiscCards.js',
    'src/AllGoalsCard.js',
    'src/GraphsCard.js'
  ]
};
