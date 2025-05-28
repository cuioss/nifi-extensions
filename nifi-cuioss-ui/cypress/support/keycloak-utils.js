// nifi-cuioss-ui/cypress/support/keycloak-utils.js
import axios from 'axios'; // Corrected: use import
import fs from 'fs'; // For saveTokensToFixtures
import path from 'path'; // For saveTokensToFixtures

/**
 * Utility for obtaining real tokens from Keycloak for testing.
 * Adapted from doc/specification/end-to-end-testing.adoc.
 */
class TokenGenerator {
  constructor() {
    // Keycloak connection details from doc/specification/end-to-end-testing.adoc
    // Assuming Cypress tests run on the host machine, accessing Keycloak via localhost.
    this.keycloakUrl = Cypress.env('keycloakUrl') || 'http://localhost:9080'; // Allow override via Cypress.env
    this.realm = Cypress.env('keycloakRealm') || 'oauth_integration_tests';
    this.clientId = Cypress.env('keycloakClientId') || 'test_client';
    this.clientSecret = Cypress.env('keycloakClientSecret') || 'yTKslWLtf4giJcWCaoVJ20H8sy6STexM'; // From spec, for 'test_client'

    // Default test user credentials
    this.defaultUsername = 'testUser';
    this.defaultPassword = 'drowssap'; // From spec for 'testUser'
  }

  /**
   * Get a token for a specific user and password, with optional scopes.
   * @param {string} username The username.
   * @param {string} password The password.
   * @param {string|null} scope Space-separated string of scopes.
   * @returns {Promise<string>} A promise that resolves to the access token.
   */
  async getToken(username, password, scope = null) {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('username', username);
      params.append('password', password);

      if (scope) {
        params.append('scope', scope);
      }

      const tokenEndpoint = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
      
      // Cypress tasks allow node modules like axios, but direct calls in test spec files might need cy.request.
      // This file is in /support, so it can be used by tasks or custom commands.
      const response = await axios.post(tokenEndpoint, params.toString(), { // .toString() for URLSearchParams
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (response.data && response.data.access_token) {
        return response.data.access_token;
      } else {
        throw new Error('Access token not found in Keycloak response.');
      }
    } catch (error) {
      console.error('Failed to get token from Keycloak:', error.response ? error.response.data : error.message);
      throw new Error(`Keycloak token request failed: ${error.response ? error.response.data.error_description || error.response.data.error || JSON.stringify(error.response.data) : error.message}`);
    }
  }

  /**
   * Get a valid token for the default testUser.
   * @returns {Promise<string>} A promise that resolves to the access token.
   */
  async getTestUserToken() {
    return this.getToken(this.defaultUsername, this.defaultPassword);
  }
  
  /**
   * Get a token for the admin user.
   * Admin credentials from spec: admin/admin (for Keycloak itself)
   * This might require a different client or setup if 'admin' is a Keycloak admin user vs. a realm user.
   * Assuming 'admin' is a user within the realm similar to 'testUser' for now.
   * @returns {Promise<string>} A promise that resolves to the access token.
   */
  async getAdminUserToken(adminUsername = 'admin', adminPassword = 'admin') {
    // Note: Keycloak's own admin user for master realm is usually not what's used for client-based auth.
    // This assumes an 'admin' user configured in the 'oauth_integration_tests' realm.
    // If this 'admin' user needs special scopes like 'admin', they should be requested.
    return this.getToken(adminUsername, adminPassword);
  }

  /**
   * Get a token with custom scopes for the default testUser.
   * @param {string[]} scopes Array of scope strings.
   * @returns {Promise<string>} A promise that resolves to the access token.
   */
  asyncgetTokenWithScopes(scopes) {
    return this.getToken(this.defaultUsername, this.defaultPassword, scopes.join(' '));
  }

  /**
   * Save tokens to fixture files for Cypress tests.
   * This part is from the specification example.
   * @param {string} fixturesDir - The directory to save fixtures to.
   */
  async saveTokensToFixtures(fixturesDir = path.join(__dirname, '..', 'fixtures', 'tokens')) {
    try {
      const testUserToken = await this.getTestUserToken();
      // Example for an admin-like token, adjust username/password if different for realm admin role
      const adminUserToken = await this.getToken('testUser', 'drowssap', 'admin realm_management'); // Example scopes

      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(fixturesDir, 'test-user-token.json'),
        JSON.stringify({
          token: testUserToken,
          username: this.defaultUsername,
          retrievedAt: new Date().toISOString(),
        }, null, 2)
      );

      fs.writeFileSync(
        path.join(fixturesDir, 'admin-user-token.json'),
        JSON.stringify({
          token: adminUserToken,
          username: 'testUser', // Assuming admin scopes for testUser
          scopes: 'admin realm_management',
          retrievedAt: new Date().toISOString(),
        }, null, 2)
      );
      
      console.log(`Token fixtures saved successfully to ${fixturesDir}`);
      return { testUserToken, adminUserToken };

    } catch (error) {
      console.error('Failed to save token fixtures:', error);
      throw error;
    }
  }
}

// Export an instance for use in tests (e.g., via Cypress tasks or custom commands)
export default new TokenGenerator();
