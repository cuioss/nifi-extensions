const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/selftests/**/*.cy.js',
    excludeSpecPattern: 'cypress/selftests/backup/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    // Configure base URL for integration tests
    baseUrl: process.env.CYPRESS_BASE_URL || 'https://localhost:9095/nifi/',
    // Set timeouts appropriate for NiFi startup and Angular loading
    defaultCommandTimeout: 30000, // 30s for commands (NiFi can be slow)
    requestTimeout: 30000, // 30s for network requests
    pageLoadTimeout: 180000, // 3 minutes for page loads (NiFi startup)
    responseTimeout: 30000, // 30s for responses
    visitTimeout: 180000, // 3 minutes for visits (NiFi startup)
    taskTimeout: 60000, // 60s for tasks
    execTimeout: 60000, // 60s for exec commands
    // Enable better error reporting
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
