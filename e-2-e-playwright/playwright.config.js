// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

/**
 * Read environment variables from process.env
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://localhost:9095/nifi';
const KEYCLOAK_URL = process.env.PLAYWRIGHT_KEYCLOAK_URL || 'http://localhost:9080';

/**
 * Define paths for test artifacts (following Maven standard)
 * Support environment variables for Maven-controlled output directories
 */
const TARGET_DIR = process.env.PLAYWRIGHT_OUTPUT_DIR || path.join(__dirname, 'target');
const TEST_RESULTS_DIR = process.env.TEST_RESULTS_DIR || path.join(TARGET_DIR, 'test-results');
const REPORTS_DIR = process.env.PLAYWRIGHT_REPORT_DIR || path.join(TARGET_DIR, 'playwright-report');
const SCREENSHOTS_DIR = path.join(TEST_RESULTS_DIR, 'screenshots');
const VIDEOS_DIR = path.join(TEST_RESULTS_DIR, 'videos');

/**
 * Modern Playwright Configuration - 2025 Best Practices
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* Enhanced timeout configuration based on test complexity */
  timeout: process.env.E2E_TIMEOUT ? parseInt(process.env.E2E_TIMEOUT) * 1000 : 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met
     * Increased for complex enterprise UI interactions
     */
    timeout: process.env.E2E_EXPECT_TIMEOUT ? parseInt(process.env.E2E_EXPECT_TIMEOUT) * 1000 : 15000
  },
  /* Global setup and teardown hooks */
  globalTeardown: './scripts/global-teardown.js',
  /* Enhanced parallel execution for better performance */
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Disable retries - tests should be deterministic */
  retries: 0,
  /* Modern reporter configuration - NO HTML REPORTER TO PREVENT SERVER */
  reporter: [
    ['json', { outputFile: path.join(TARGET_DIR, 'test-results.json') }],
    ['junit', { outputFile: path.join(TARGET_DIR, 'junit-results.xml') }],
    ['list']
  ],
  /* Output directories for test artifacts */
  outputDir: TEST_RESULTS_DIR,
  /* Preserve output from test runs */
  preserveOutput: 'always',
  /* Screenshot and video directories */
  screenshotsDir: SCREENSHOTS_DIR,
  videosDir: VIDEOS_DIR,
  /* Enhanced settings for modern testing - 2025 best practices */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Enhanced tracing - always collect for better debugging */
    /* Options: 'off', 'on', 'retain-on-failure', 'on-first-retry', 'on-all-retries' */
    trace: process.env.PLAYWRIGHT_TRACE || 'on',

    /* Take screenshot on failure and for debugging */
    /* Options: 'off', 'on', 'only-on-failure' */
    screenshot: process.env.PLAYWRIGHT_SCREENSHOT || 'on',

    /* Record video for better debugging */
    /* Options: 'off', 'on', 'retain-on-failure', 'on-first-retry' */
    video: process.env.PLAYWRIGHT_VIDEO || 'on',

    /* Ignore HTTPS errors for development environments */
    ignoreHTTPSErrors: true,

    /* Modern browser features */
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    navigationTimeout: 30000,

    /* Enhanced context options */
    contextOptions: {
      // Enable downloads for file testing
      acceptDownloads: true,
      // Set timezone for consistent testing
      timezoneId: 'America/New_York',
      // Enable geolocation if needed
      permissions: ['clipboard-read', 'clipboard-write']
    }
  },

  /* Focused browser configuration - Chromium as sensible default
   *
   * Why Chromium only:
   * - Most stable and widely used browser in enterprise environments
   * - Best Playwright support and performance
   * - Consistent behavior across development and CI environments
   * - NiFi's UI is primarily tested and optimized for Chrome/Chromium
   * - Reduces test execution time and maintenance overhead
   * - Enterprise users typically standardize on Chrome-based browsers
   */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable modern Chrome features for enterprise NiFi testing
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--enable-automation',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--ignore-certificate-errors'
          ]
        }
      },
    }
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});