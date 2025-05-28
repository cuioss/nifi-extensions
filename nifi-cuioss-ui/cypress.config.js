const { defineConfig } = require('cypress')

module.exports = defineConfig({
  env: {
    keycloakUrl: 'http://localhost:9080',
    keycloakRealm: 'oauth_integration_tests',
    keycloakClientId: 'test_client',
    keycloakClientSecret: 'yTKslWLtf4giJcWCaoVJ20H8sy6STexM',
    nifiUrl: 'https://localhost:9095/nifi/', // Added NiFi URL
  },
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    specPattern: 'cypress/integration/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js'
  },
})
