const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/selftests/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    // Configure base URL for integration tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi',
    // Set longer timeouts for integration tests against real NiFi
    defaultCommandTimeout: 15000,
    requestTimeout: 10000,
    pageLoadTimeout: 30000,
    // Disable video for faster execution
    video: false,
    // Generate a separate report for self-tests
    reporter: 'junit',
    reporterOptions: {
      mochaFile: 'tests-report/selftests-[hash].xml',
      toConsole: true
    },
    env: {
      // Pass through environment variables
      CYPRESS_BASE_URL: process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi',
      CYPRESS_KEYCLOAK_URL: process.env.CYPRESS_KEYCLOAK_URL || 'https://localhost:9085/auth'
    }
  }
});
