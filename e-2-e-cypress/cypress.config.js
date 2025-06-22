const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://localhost:9095/nifi',
    specPattern: process.env.CYPRESS_SPEC_PATTERN || 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false, // Required for NiFi's iframe-based architecture and cross-origin requests
    modifyObstructiveCode: false, // Prevent Cypress from modifying NiFi's code
    experimentalWebKitSupport: false,
    // Fail-fast configuration - aggressive timeouts to prevent hanging
    defaultCommandTimeout: 15000,  // Reduced from 30s - fail faster on stuck commands
    requestTimeout: 20000,          // Reduced from 30s - fail faster on network issues
    responseTimeout: 20000,         // Reduced from 30s - fail faster on slow responses
    pageLoadTimeout: 60000,         // Reduced from 180s - fail faster on page load issues
    visitTimeout: 45000,            // Fail faster on visit timeouts
    taskTimeout: 30000,             // Fail faster on custom tasks
    execTimeout: 30000,             // Fail faster on exec commands
    
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
    video: false, // Disable video recording for faster execution
    setupNodeEvents(on, config) {
      // Import and setup fail-fast plugin
      const failFastPlugin = require('./cypress/plugins/fail-fast');
      config = failFastPlugin(on, config);
      
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
      
      return config;
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
