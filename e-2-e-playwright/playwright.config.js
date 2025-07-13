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
 */
const TARGET_DIR = path.join(__dirname, 'target');
const TEST_RESULTS_DIR = path.join(TARGET_DIR, 'test-results');
const REPORTS_DIR = path.join(TARGET_DIR, 'playwright-report');
const SCREENSHOTS_DIR = path.join(TARGET_DIR, 'screenshots');
const VIDEOS_DIR = path.join(TARGET_DIR, 'videos');

/**
 * Modern Playwright Configuration - 2025 Best Practices
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* Maximum time one test can run for - increased for complex enterprise scenarios */
  timeout: 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met
     */
    timeout: 10000
  },
  /* Global setup and teardown hooks */
  globalTeardown: './global-teardown.js',
  /* Enhanced parallel execution for better performance */
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Enhanced retry strategy */
  retries: process.env.CI ? 3 : 1,
  /* Modern reporter configuration with accessibility reports */
  reporter: [
    ['html', { outputFolder: REPORTS_DIR, open: 'never' }],
    ['json', { outputFile: path.join(TARGET_DIR, 'test-results.json') }],
    ['junit', { outputFile: path.join(TARGET_DIR, 'junit-results.xml') }],
    ['list'],
    // Add accessibility reporter if violations are found
    ...(process.env.ACCESSIBILITY_REPORTS ? [['json', { outputFile: path.join(TARGET_DIR, 'accessibility-results.json') }]] : [])
  ],
  /* Output directories for test artifacts */
  outputDir: TEST_RESULTS_DIR,
  /* Screenshot and video directories */
  screenshotsDir: SCREENSHOTS_DIR,
  videosDir: VIDEOS_DIR,
  /* Enhanced settings for modern testing - 2025 best practices */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Enhanced tracing - always collect for better debugging */
    trace: 'on-first-retry',

    /* Take screenshot on failure and for debugging */
    screenshot: 'only-on-failure',

    /* Record video for better debugging */
    video: 'retain-on-failure',

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

  /* Enhanced browser configuration for modern testing */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable modern Chrome features
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--enable-automation',
            '--no-sandbox'
          ]
        }
      },
    },
    // Enable additional browsers for comprehensive testing
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'security.tls.insecure_fallback_hosts': 'localhost',
            'dom.webnotifications.enabled': false
          }
        }
      },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Add mobile testing capability
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
