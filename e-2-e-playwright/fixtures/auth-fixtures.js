/**
 * @fileoverview Authentication base test for Playwright.
 *
 * Authentication is established once by global-setup.js (API token exchange) and
 * carried into every project via Playwright's storageState (see
 * playwright.config.cjs). Tests therefore start already authenticated and do NOT
 * drive a UI login flow.
 *
 * The former UI-login fixtures (authenticatedPage / unauthenticatedPage /
 * adminPage / testData / pageVerifier) were unused dead code — adminPage even
 * referenced a nonexistent CONSTANTS.AUTH.ADMIN_USERNAME — and were removed. This
 * module now simply re-exports Playwright's base test so test-fixtures.js has a
 * single, stable extension point to build on.
 */

export { test, expect } from '@playwright/test';
