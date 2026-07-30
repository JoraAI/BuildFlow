/**
 * BuildFlow - Jest setup.
 * Loads test env so env.ts validates cleanly.
 * FIX (DAT-3.8): override:true + assert DB name ends in _test.
 */
import dotenv from 'dotenv';
import path from 'node:path';

// FIX (DAT-3.8): override:true so .env.test always wins over .env
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

// Ensure required vars for env.ts schema even if .env.test is missing.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/buildflow_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-at-least-16-chars';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-16-chars';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:8081';

// FIX (DAT-3.8): Safety check — refuse to run if DB doesn't end in _test
const dbName = process.env.DATABASE_URL.split('/').pop()?.split('?')[0];
if (dbName && !dbName.endsWith('_test')) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL database name "${dbName}" does not end in "_test". ` +
      `This would run tests against a production database.`,
  );
}

// NOTE: Bull queue is mocked via jest.config.js moduleNameMapper → __mocks__/bull.js
