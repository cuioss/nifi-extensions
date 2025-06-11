const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://localhost:8443/nifi',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    chromeWebSecurity: false,
    defaultCommandTimeout: 10000,
    videoCompression: 15,
    screenshotOnRunFailure: true,
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
    keycloakUrl: 'https://localhost:8443/auth',
    keycloakRealm: 'oauth_integration_tests',
    keycloakClientId: 'test_client',
    keycloakClientSecret: 'test_client_secret',
    allowedConsoleWarnings: ['cypress/support/console-warnings-allowlist.js']
  }
});
