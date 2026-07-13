// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

/**
 * Read environment variables from process.env
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi';

/**
 * Define paths for test artifacts (following Maven standard)
 * Support environment variables for Maven-controlled output directories
 */
const TARGET_DIR = process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(__dirname, 'target');
const TEST_RESULTS_DIR = process.env.TEST_RESULTS_DIR || path.join(TARGET_DIR, 'test-results');

/**
 * Shared Chrome launch options for all projects.
 *
 * SECURITY POSTURE (I31) — accepted, and deliberately scoped to this E2E layer:
 * these flags relax browser security ONLY for the throwaway Docker test stack
 * (self-signed certs, single trusted origin). They do NOT weaken production. The
 * Java integration tests (integration-testing module) deliberately exercise the
 * REAL TLS/CORS behaviour, so the transport-security regressions these flags mask
 * here are still caught there — the two layers are complementary, not redundant.
 *
 *   --disable-web-security      Required: the JWT/Gateway custom UIs render inside
 *                               a cross-origin NiFi iframe; without this, same-origin
 *                               policy blocks the frame interactions the UI tests drive.
 *   --no-sandbox                Required: the CI/Docker containers run as root, where
 *                               the Chromium sandbox cannot initialise.
 *   --disable-dev-shm-usage     Required: containers ship a small /dev/shm; this avoids
 *                               renderer crashes under memory pressure.
 *   --ignore-certificate-errors Accepted: NiFi/Keycloak use self-signed certs on
 *                               localhost. Node-side fetches trust the real CA via
 *                               NODE_EXTRA_CA_CERTS (package.json); Chromium has no
 *                               equivalent per-context CA injection, so cert errors
 *                               are ignored for the browser only.
 *   --enable-automation / --disable-features=VizDisplayCompositor
 *                               Automation stability flags; no security impact.
 *
 * Do NOT copy these flags into any non-test browser configuration.
 */
const CHROME_OPTIONS = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1920, height: 1080 },
  launchOptions: {
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--enable-automation',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
  },
};

const AUTH_STATE = path.join(__dirname, '.auth', 'state.json');

/**
 * Modern Playwright Configuration - Project-based architecture
 *
 * Flow: auth-setup -> self-tests -> [functional + accessibility] (in parallel within workers:1)
 * The auth-setup project authenticates once and saves storageState for all downstream projects.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* Enhanced timeout configuration based on test complexity */
  timeout: process.env.E2E_TIMEOUT ? parseInt(process.env.E2E_TIMEOUT) * 1000 : 60 * 1000,
  expect: {
    timeout: process.env.E2E_EXPECT_TIMEOUT ? parseInt(process.env.E2E_EXPECT_TIMEOUT) * 1000 : 15000,
  },
  /* Sequential execution — all tests share a single NiFi instance */
  fullyParallel: false,
  workers: 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Disable retries - tests should be deterministic */
  retries: 0,
  /* Modern reporter configuration - NO HTML REPORTER TO PREVENT SERVER */
  reporter: [
    ['json', { outputFile: path.join(TARGET_DIR, 'test-results.json') }],
    ['junit', { outputFile: path.join(TARGET_DIR, 'junit-results.xml') }],
    ['list'],
  ],
  /* Output directories for test artifacts */
  outputDir: TEST_RESULTS_DIR,
  /* Preserve output from test runs */
  preserveOutput: 'always',
  /* Shared settings for all projects */
  use: {
    baseURL: BASE_URL,
    trace: process.env.PLAYWRIGHT_TRACE || 'retain-on-failure',
    screenshot: process.env.PLAYWRIGHT_SCREENSHOT || 'only-on-failure',
    video: process.env.PLAYWRIGHT_VIDEO || 'retain-on-failure',
    // Accepted (I31): trusts the self-signed localhost cert for Playwright's own
    // APIRequestContext calls, mirroring the browser's --ignore-certificate-errors.
    // See the CHROME_OPTIONS security-posture note above.
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 10000,
    navigationTimeout: 30000,
    contextOptions: {
      acceptDownloads: true,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['clipboard-read', 'clipboard-write'],
    },
  },

  projects: [
    /* ---- Phase 0: One-time authentication & precondition check ---- */
    {
      name: 'auth-setup',
      testDir: '.',
      testMatch: /global-setup\.js$/,
      use: { ...CHROME_OPTIONS },
    },

    /* ---- Phase 1: Self-tests (gate — must pass before functional tests) ---- */
    {
      name: 'self-tests',
      testMatch: /self-.*\.spec\.js$/,
      dependencies: ['auth-setup'],
      use: {
        ...CHROME_OPTIONS,
        storageState: AUTH_STATE,
      },
    },

    /* ---- Phase 2a: Functional tests (numbered 01-07) ---- */
    {
      name: 'functional',
      testMatch: /\d{2}-.*\.spec\.js$/,
      dependencies: ['self-tests'],
      use: {
        ...CHROME_OPTIONS,
        storageState: AUTH_STATE,
      },
    },

    /* ---- Phase 2b: Accessibility tests ---- */
    {
      name: 'accessibility',
      testMatch: /accessibility.*\.spec\.js$/,
      dependencies: ['self-tests'],
      use: {
        ...CHROME_OPTIONS,
        storageState: AUTH_STATE,
      },
    },
  ],
});
