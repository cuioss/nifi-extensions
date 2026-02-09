/**
 * @fileoverview Keycloak Token Service - Access Token Management
 * Provides methods to fetch valid and invalid access tokens from Keycloak
 * Uses constants for configuration and implements fail-loud pattern
 */

import { CONSTANTS } from './constants.js';
import { testLogger } from './test-logger.js';

/**
 * Keycloak token service for obtaining access tokens
 */
export class KeycloakTokenService {
  constructor() {
    // Keycloak configuration from constants
    this.keycloakBase = CONSTANTS.SERVICE_URLS.KEYCLOAK_BASE;
    this.realm = CONSTANTS.KEYCLOAK_CONFIG.REALM;
    this.clientId = CONSTANTS.KEYCLOAK_CONFIG.CLIENT_ID;
    this.clientSecret = CONSTANTS.KEYCLOAK_CONFIG.CLIENT_SECRET;
    this.tokenEndpoint = CONSTANTS.SERVICE_URLS.KEYCLOAK_TOKEN;
  }

  /**
   * Fetch a valid access token from Keycloak
   * Implements fail-loud pattern - throws on any error
   * @returns {Promise<string>} Valid JWT access token
   * @throws {Error} If token cannot be obtained
   */
  async getValidAccessToken() {
    testLogger.info('Auth','Fetching valid access token from Keycloak...');
    
    try {
      // Make the token request using fetch
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username: CONSTANTS.AUTH.USERNAME,
          password: CONSTANTS.AUTH.PASSWORD,
          scope: 'openid'
        })
      });

      // Check if request was successful
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Failed to obtain access token from Keycloak. ` +
          `Status: ${response.status} ${response.statusText}. ` +
          `Response: ${errorBody}. ` +
          `Endpoint: ${this.tokenEndpoint}`
        );
      }

      // Parse the response
      const tokenData = await response.json();
      
      // Validate we got an access token
      if (!tokenData.access_token) {
        throw new Error(
          `Keycloak response did not contain access_token. ` +
          `Response: ${JSON.stringify(tokenData)}`
        );
      }

      testLogger.info('Auth','Successfully obtained valid access token from Keycloak');
      return tokenData.access_token;
      
    } catch (error) {
      // Fail loud - enhance error with context
      const enhancedError = new Error(
        `CRITICAL: Failed to obtain access token from Keycloak. ` +
        `Make sure Keycloak is running at ${this.keycloakBase}. ` +
        `Run './integration-testing/src/main/docker/run-and-deploy.sh' to start containers. ` +
        `Original error: ${error.message}`
      );
      
      testLogger.error('Auth',enhancedError.message);
      throw enhancedError;
    }
  }

  /**
   * Get an invalid access token for negative testing
   * @returns {string} Invalid JWT token
   */
  getInvalidAccessToken() {
    testLogger.info('Auth','Returning invalid access token for testing');
    
    // Return a static invalid token that looks like a JWT but is invalid
    // This has correct JWT structure (header.payload.signature) but invalid signature
    return 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbnZhbGlkLXVzZXIiLCJpc3MiOiJpbnZhbGlkLWlzc3VlciIsImF1ZCI6ImludmFsaWQtYXVkaWVuY2UiLCJleHAiOjE5OTk5OTk5OTksImlhdCI6MTAwMDAwMDAwMH0.invalid-signature-that-will-never-validate';
  }

  /**
   * Check if Keycloak is accessible
   * @returns {Promise<boolean>} True if Keycloak is accessible
   */
  async isKeycloakAccessible() {
    try {
      // Use the dedicated health endpoint on port 9086
      const healthUrl = CONSTANTS.SERVICE_URLS.KEYCLOAK_HEALTH;
      const response = await fetch(healthUrl, {
        method: 'GET',
        // Allow self-signed certificates in test environment
        ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' && {
          agent: new (await import('https')).Agent({
            rejectUnauthorized: false
          })
        })
      });
      
      return response.ok || response.status === 200;
    } catch (error) {
      testLogger.warn('Auth',`Keycloak not accessible: ${error.message}`);
      return false;
    }
  }

  /**
   * Get token endpoint URL for debugging
   * @returns {string} Token endpoint URL
   */
  getTokenEndpoint() {
    return this.tokenEndpoint;
  }
}

/**
 * Convenience function to get a valid access token
 * @returns {Promise<string>} Valid JWT access token
 * @throws {Error} If token cannot be obtained
 */
export async function getValidAccessToken() {
  const service = new KeycloakTokenService();
  return service.getValidAccessToken();
}

/**
 * Convenience function to get an invalid access token
 * @returns {string} Invalid JWT token
 */
export function getInvalidAccessToken() {
  const service = new KeycloakTokenService();
  return service.getInvalidAccessToken();
}

/**
 * Export the service class as default
 */
export default KeycloakTokenService;