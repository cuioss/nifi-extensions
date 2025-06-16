const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:9094/nifi',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
    // Fail-fast configuration
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    experimentalRunAllSpecs: false, // Run specs individually to fail fast
    stopSpecOnFirstFailure: true, // Fail fast within a spec
    // Media settings for faster execution
    videoCompression: 15,
    screenshotOnRunFailure: true,
    video: false, // Disable video recording for faster execution
    setupNodeEvents(on, config) {
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
        }
      });
    },
    reporter: 'cypress-multi-reporters',
    reporterOptions: {
      reporterEnabled: 'mochawesome',
      mochawesomeReporterOptions: {
        reportDir: 'tests-report',
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
