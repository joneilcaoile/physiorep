module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary'],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 50,
      lines: 30,
      statements: 30
    }
  }
};
