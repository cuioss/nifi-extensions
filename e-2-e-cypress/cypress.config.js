const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:9094/nifi',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
    defaultCommandTimeout: 10000,
    videoCompression: 15,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // Register tasks for logging and backend gap detection
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        logBackendGap(gapData) {
          console.log('🔍 Backend Integration Gap Detected:');
          console.log(`  Component: ${gapData.component}`);
          console.log(`  Expected: ${gapData.expected}`);
          console.log(`  Actual: ${gapData.actual}`);
          console.log(`  Impact: ${gapData.impact}`);
          console.log(`  Timestamp: ${gapData.timestamp}`);
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
