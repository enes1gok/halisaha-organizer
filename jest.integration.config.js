/** @type {import('jest').Config} */
const base = require('./jest.config.js');

module.exports = {
  ...base,
  testEnvironment: 'node',
  testMatch: ['**/src/services/supabase/__tests__/rls/**/*.test.ts'],
  testTimeout: 45000,
  globalSetup: '<rootDir>/src/services/supabase/__tests__/rls/globalSetup.js',
  globalTeardown: '<rootDir>/src/services/supabase/__tests__/rls/globalTeardown.js',
};
