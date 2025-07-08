const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi',
    specPattern: process.env.CYPRESS_SPEC_PATTERN || 'cypress/e2e/**/*.cy.js',
    excludeSpecPattern: 'cypress/e2e/archived/**',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false, // Required for NiFi's iframe-based architecture and cross-origin requests
    modifyObstructiveCode: false, // Prevent Cypress from modifying NiFi's code
    experimentalWebKitSupport: false,

    // Configure temporary directories to be under target/
    screenshotsFolder: 'target/cypress/screenshots',
    videosFolder: 'target/cypress/videos',
    downloadsFolder: 'target/cypress/downloads',

    // Timeout configuration - more generous to handle slow responses
    defaultCommandTimeout: 10000,  // Increased timeout for commands
    requestTimeout: 10000,         // Increased timeout for requests
    responseTimeout: 10000,        // Increased timeout for responses
    pageLoadTimeout: 60000,        // Significantly increased timeout for page loads
    visitTimeout: 30000,           // Increased timeout for visits
    taskTimeout: 10000,            // Increased timeout for tasks
    execTimeout: 10000,            // Increased timeout for exec commands

    // Fail-fast execution settings
    experimentalRunAllSpecs: false, // Run specs individually to fail fast
    stopSpecOnFirstFailure: true,  // Stop spec immediately on first failure
    exitOnFail: true,               // Exit process on test failure

    // Retry configuration - limited retries to fail fast
    retries: {
      runMode: 1,    // Only 1 retry in run mode
      openMode: 0    // No retries in open mode
    },

    // Test isolation for fail-fast behavior
    testIsolation: true,            // Ensure clean state between tests
    // Media settings for faster execution
    videoCompression: 15,
    screenshotOnRunFailure: true,
    video: process.env.CYPRESS_VIDEO === 'true', // Enable video recording via environment variable
    setupNodeEvents(on, config) {
      // Fail-fast behavior is implemented via cypress.config.js settings above
      // No additional plugins needed

      // Handle browser launch arguments to fix certificate warnings
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser && browser.name === 'chrome') {
          launchOptions.args.push('--disable-web-security');
          launchOptions.args.push('--ignore-certificate-errors');
          launchOptions.args.push('--ignore-ssl-errors');
          launchOptions.args.push('--allow-running-insecure-content');
          launchOptions.args.push('--disable-extensions-file-access-check');
          launchOptions.args.push('--disable-extensions-http-throttling');
        }

        if (browser && browser.name === 'electron') {
          launchOptions.args.push('--ignore-certificate-errors');
          launchOptions.args.push('--ignore-ssl-errors');
          launchOptions.args.push('--allow-running-insecure-content');
        }

        return launchOptions;
      });

      // Register tasks for logging and backend gap detection
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        logBackendGap(gapData) {
          console.log('🔍 Backend Integration Gap Detected:');
          console.log(`  Type: ${gapData.type}`);
          console.log(`  Description: ${gapData.description}`);
          console.log(`  Timestamp: ${gapData.timestamp}`);
          return null;
        },
        logPerformance(perfData) {
          console.log('📊 Performance Metric:');
          console.log(`  Test: ${perfData.testName}`);
          console.log(`  Duration: ${perfData.duration}ms`);
          console.log(`  Success: ${perfData.success}`);
          return null;
        },
        logReport(report) {
          console.log('📋 Test Report Generated:');
          console.log(`  Timestamp: ${report.timestamp}`);
          console.log(`  Gaps: ${report.gaps ? report.gaps.length : 0}`);
          return null;
        },
        saveBrowserLogs(logs) {
          const fs = require('fs');
          const path = require('path');

          // Create browser-logs directory if it doesn't exist
          const logsDir = path.join(__dirname, 'target/browser-logs');
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
          }

          // Generate filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `browser-logs-${timestamp}.json`;
          const filepath = path.join(logsDir, filename);

          // Save logs to file
          fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
          console.log(`🗒️ Browser logs saved to: ${filepath}`);

          return null;
        }
      });

      return config;
    },
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'mochawesome',
      mochawesomeReporterOptions: {
        reportDir: 'target/tests-report',
        overwrite: false,
        html: true,
        json: true
      }
    }
  },
  env: {
    keycloakUrl: 'https://localhost:9085',
    keycloakRealm: 'oauth_integration_tests',
    keycloakClientId: 'test_client',
    keycloakClientSecret: 'test_client_secret',
    allowedConsoleWarnings: ['cypress/support/console-warnings-allowlist.js']
  }
});
