/**
 * @file Simplified Test Fixtures
 * Leverages Playwright's built-in console logging via trace viewer
 * @version 2.0.0
 */

// Re-export the enhanced test fixture with logging
export { test, expect } from './logging-fixture.js';

/**
 * Export the base test for cases where enhanced logging is not needed
 */
export { test as base } from '@playwright/test';