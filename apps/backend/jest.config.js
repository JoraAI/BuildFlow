/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@buildflow/shared$': '<rootDir>/../../packages/shared/src',
    // archiver@8 is ESM-only; Jest (CommonJS) cannot parse it when the
    // integration tests transitively import the full Express app.
    '^archiver$': '<rootDir>/src/__tests__/__mocks__/archiver.js',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, tsconfig: { module: 'commonjs' } }],
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  // Load .env for tests
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
};