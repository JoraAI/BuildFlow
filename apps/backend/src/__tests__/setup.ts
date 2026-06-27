/**
 * BuildFlow — Jest setup.
 * Loads test env so env.ts validates cleanly.
 */
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.test') });

// Ensure required vars for env.ts schema even if .env.test is missing.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/buildflow_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-at-least-16-chars';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-16-chars';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:8081';