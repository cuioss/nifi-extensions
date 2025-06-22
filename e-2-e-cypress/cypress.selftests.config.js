const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/selftests/0[1-9]-*.cy.js', // Run tests 01-09 (includes NiFi-dependent tests)
    excludeSpecPattern: [
      'cypress/selftests/backup/**/*.cy.js',
      'cypress/selftests/minimal-test.cy.js',
      'cypress/selftests/command-unit-tests-simple.cy.js'
    ],
    supportFile: 'cypress/support/e2e.js',
    // Configure base URL for integration tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi/',
    // Realistic fail-fast timeout configuration for when NiFi is running
    defaultCommandTimeout: 3000,   // 3s - NiFi should respond quickly when running
    requestTimeout: 5000,           // 5s for network requests
    pageLoadTimeout: 10000,         // 10s for page loads - NiFi should load quickly when running
    responseTimeout: 5000,          // 5s for responses
    visitTimeout: 10000,            // 10s for visits
    taskTimeout: 8000,              // 8s for tasks
    execTimeout: 8000,              // 8s for exec commands
    
    // Fail-fast execution settings
    stopSpecOnFirstFailure: true,   // Stop immediately on first failure
    exitOnFail: true,               // Exit process on failure
    
    // Retry configuration - no retries for self-tests to fail fast
    retries: {
      runMode: 0,    // No retries in run mode
      openMode: 0    // No retries in open mode
    },
    
    // Test isolation
    testIsolation: true,
    
    // Enable better error reporting
    video: false, // Disable video for faster execution
    
    // Setup fail-fast plugin
    setupNodeEvents(on, config) {
      // Import and setup fail-fast plugin
      const failFastPlugin = require('./cypress/plugins/fail-fast');
      return failFastPlugin(on, config);
    },
    // Generate a separate report for self-tests
    reporter: 'junit',
    reporterOptions: {
      mochaFile: 'tests-report/selftests-[hash].xml',
      toConsole: true
    },
    env: {
      // Pass through environment variables
      CYPRESS_BASE_URL: process.env.CYPRESS_BASE_URL || 'http://localhost:9094/nifi/',
      CYPRESS_KEYCLOAK_URL: process.env.CYPRESS_KEYCLOAK_URL || 'https://localhost:9085'
    }
  }
});
