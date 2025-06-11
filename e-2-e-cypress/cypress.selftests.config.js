const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/selftests/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    // Set shorter timeouts for self-tests as they should be fast
    defaultCommandTimeout: 5000,
    video: false,
    // Generate a separate report for self-tests
    reporter: 'junit',
    reporterOptions: {
      mochaFile: 'tests-report/selftests-[hash].xml',
      toConsole: true
    }
  }
});
