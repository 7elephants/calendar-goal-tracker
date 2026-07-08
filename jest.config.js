module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['src/Code.js', 'src/Cards.js']
};
