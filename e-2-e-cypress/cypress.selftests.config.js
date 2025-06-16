const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/selftests/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    // Configure base URL for integration tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:9094/nifi/',
    // Set timeouts to fail fast instead of hanging
    defaultCommandTimeout: 10000, // 10s for commands
    requestTimeout: 15000, // 15s for network requests
    pageLoadTimeout: 30000, // 30s for page loads (fail fast)
    responseTimeout: 15000, // 15s for responses
    visitTimeout: 30000, // 30s for visits (fail fast)
    taskTimeout: 30000, // 30s for tasks
    execTimeout: 30000, // 30s for exec commands
    // Fail fast settings
    exitOnFail: true, // Exit on first failure
    stopSpecOnFirstFailure: true, // Fail fast within a spec
    experimentalRunAllSpecs: false, // Run specs individually
    video: false, // Disable video for faster execution
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
