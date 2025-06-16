const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/selftests/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    // Configure base URL for integration tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:9094/nifi/',
    // Set timeouts to fail fast instead of hanging
    defaultCommandTimeout: 30000, // 30s for commands
    requestTimeout: 20000, // 20s for network requests
    pageLoadTimeout: 180000, // 3 minutes for page loads
    responseTimeout: 20000, // 20s for responses
    visitTimeout: 180000, // 3 minutes for visits
    taskTimeout: 60000, // 1 minute for tasks
    execTimeout: 60000, // 1 minute for exec commands
    // Fail fast settings
    exitOnFail: true, // Exit on first failure
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
