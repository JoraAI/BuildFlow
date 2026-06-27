/**
 * Manual Jest mock for `archiver`.
 *
 * archiver@8 ships ESM-only. When the integration tests import the full
 * Express `app` (which transitively loads export-zip.service.ts), Jest's
 * CommonJS runtime cannot parse the ESM `import` syntax and throws
 * "SyntaxError: Cannot use import statement outside a module".
 *
 * This mock stubs the minimal surface used by export-zip.service.ts:
 *   - `new ZipArchive(options)` → instance
 *   - instance.on(), .pipe(), .append(), .finalize()
 *
 * Production code is unaffected — this mock is loaded via Jest
 * moduleNameMapper only in the test environment.
 */
'use strict';

function ZipArchive() {
  return {
    on: jest.fn(),
    pipe: jest.fn(),
    append: jest.fn(),
    finalize: jest.fn().mockResolvedValue(undefined),
  };
}

// Support both named + default import shapes
module.exports = { ZipArchive, default: ZipArchive };