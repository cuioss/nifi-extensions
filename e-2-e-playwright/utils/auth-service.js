/**
 * @fileoverview Consolidated Authentication Service - Modern 2025 Patterns
 * Combines auth-helper.js and login-tool.js with modern Playwright features
 * Removes duplication and uses 2025 best practices
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';
import { authLogger } from './shared-logger.js';

/**
 * Modern authentication service with 2025 Playwright patterns
 */
export class AuthService {
  constructor(page) {
    this.page = page;
  }

  /**
   * Check if services are accessible using modern request API
   */
  async checkServiceAccessibility(serviceUrl, serviceName, timeout = 5000) {
    authLogger.info(`Checking ${serviceName} accessibility...`);

    try {
      const response = await this.page.request.get(serviceUrl, {
        timeout,
        failOnStatusCode: false
      });

      // Consider 401 as accessible (requires auth)
      const isAccessible = response &&
        ((response.status() >= 200 && response.status() < 400) || response.status() === 401);

      if (isAccessible) {
        authLogger.success(`${serviceName} service is accessible`);
      } else {
        authLogger.warn(`${serviceName} not accessible - Status: %s`, response?.status() || 'unknown');
      }

      return isAccessible;
    } catch (error) {
      authLogger.error(`${serviceName} not accessible - %s`, error.message);
      return false;
    }
  }

  /**
   * Check NiFi accessibility
   */
  async checkNiFiAccessibility(timeout = 5000) {
    return this.checkServiceAccessibility(
      CONSTANTS.SERVICE_URLS.NIFI_SYSTEM_DIAGNOSTICS,
      'NiFi',
      timeout
    );
  }

  /**
   * Check Keycloak accessibility
   */
  async checkKeycloakAccessibility(timeout = 5000) {
    return this.checkServiceAccessibility(
      CONSTANTS.SERVICE_URLS.KEYCLOAK_HEALTH,
      'Keycloak',
      timeout
    );
  }

  /**
   * Modern authentication check using semantic locators
   */
  async isAuthenticated() {
    // Use modern locator patterns instead of complex selectors
    const authIndicators = [
      this.page.getByRole('button', { name: /log out|logout/i }),
      this.page.getByRole('link', { name: /process groups/i }),
      this.page.getByRole('button', { name: /operate/i }),
      this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS)
    ];

    for (const locator of authIndicators) {
      if (await locator.isVisible().catch(() => false)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Modern login with semantic locators and auto-waiting
   * Always uses constants directly - passwords are never passed as parameters
   */
  async login() {
    // Check if NiFi is accessible before attempting login
    const isAccessible = await this.checkNiFiAccessibility();
    if (!isAccessible) {
      authLogger.warn('NiFi is not accessible - skipping login attempt');
      const { test } = await import('@playwright/test');
      test.skip(true, 'NiFi service is not accessible - cannot perform login');
      return;
    }

    const start = Date.now();
    authLogger.info(`Starting login for user: ${CONSTANTS.AUTH.USERNAME}...`);
    try {
      const result = await (async () => {
      // Navigate to login page
      await this.page.goto('/nifi');
      await this.page.waitForLoadState('networkidle');

      // Check if already authenticated
      if (await this.isAuthenticated()) {
        authLogger.info('Already authenticated');
        return true;
      }

      // First get the CSRF token by navigating to the login page
      await this.page.goto('/nifi');
      await this.page.waitForLoadState('networkidle');

      // Extract CSRF token from cookies
      const cookies = await this.page.context().cookies();
      const requestTokenCookie = cookies.find(c => c.name === '__Secure-Request-Token');
      const requestToken = requestTokenCookie?.value;

      if (!requestToken) {
        throw new Error('Could not obtain CSRF token from login page');
      }

      // Use API-based authentication (like HAR file shows)
      const response = await this.page.request.post('/nifi-api/access/token', {
        headers: {
          'Request-Token': requestToken,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
        },
        form: {
          username: CONSTANTS.AUTH.USERNAME,
          password: CONSTANTS.AUTH.PASSWORD
        }
      });

      if (!response.ok()) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`API login failed: ${response.status()} ${response.statusText()} - ${errorBody}`);
      }

      // Get the JWT token from response
      const token = await response.text();

      if (!token || token.trim().length === 0) {
        throw new Error('Received empty token from authentication API');
      }

      // Set the authorization header for subsequent requests
      await this.page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`
      });

      // Navigate to main canvas after successful authentication
      await this.page.goto('/nifi');

      // Wait for authentication with proper error handling
      try {
        // Wait for page to be fully loaded
        await this.page.waitForLoadState('networkidle');

        // Check multiple indicators that login was successful
        const mainCanvasVisible = await this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS).isVisible().catch(() => false);
        const logoutVisible = await this.page.getByRole('button', { name: /log out|logout/i }).isVisible().catch(() => false);
        const usernameVisible = await this.page.locator(`text=${CONSTANTS.AUTH.USERNAME}`).isVisible().catch(() => false);

        const authSuccess = mainCanvasVisible || logoutVisible || usernameVisible;

        if (!authSuccess) {
          // Wait a bit more and try again
          await this.page.waitForTimeout(2000);

          const retryMainCanvas = await this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS).isVisible().catch(() => false);
          const retryLogout = await this.page.getByRole('button', { name: /log out|logout/i }).isVisible().catch(() => false);
          const retryUsername = await this.page.locator(`text=${CONSTANTS.AUTH.USERNAME}`).isVisible().catch(() => false);

          const retrySuccess = retryMainCanvas || retryLogout || retryUsername;

          if (!retrySuccess) {
            throw new Error('Authentication indicators not found after retry');
          }
        }

        authLogger.success(`Successfully logged in as ${CONSTANTS.AUTH.USERNAME}`);
        return true;
      } catch (error) {
        // Check for error messages
        const errorElement = this.page.locator('.login-error, .error-message, .alert-danger');
        const errorText = await errorElement.textContent().catch(() => null);

        const errorMsg = errorText
          ? `Login failed - ${errorText}`
          : `Login failed for user: ${CONSTANTS.AUTH.USERNAME}`;

        authLogger.error(errorMsg);
        throw new Error(errorMsg);
      }
      })();
      const duration = Date.now() - start;
      authLogger.success(`Login for user: ${CONSTANTS.AUTH.USERNAME} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      authLogger.error(`Login for user: ${CONSTANTS.AUTH.USERNAME} failed after ${duration}ms: %s`, error.message);
      throw error;
    }
  }

  /**
   * Modern logout with proper cleanup
   */
  async logout() {
    authLogger.info('Performing logout...');

    // Clear authentication state
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear authorization headers
    await this.page.setExtraHTTPHeaders({});

    // Navigate to login page
    await this.page.goto('/nifi');
    await this.page.waitForLoadState('networkidle');

    // Verify logout success by checking if authentication indicators are gone
    const isStillAuthenticated = await this.isAuthenticated();

    if (!isStillAuthenticated) {
      authLogger.success('Successfully logged out');
    } else {
      throw new Error('Logout failed - Still appears to be authenticated');
    }
  }

  /**
   * Ensure NiFi is ready for testing with modern patterns
   */
  async ensureReady() {
    authLogger.info('Ensuring NiFi is ready for testing...');

    // Check service accessibility
    const isAccessible = await this.checkNiFiAccessibility();
    
    if (!isAccessible) {
      authLogger.warn('NiFi is not accessible - skipping test due to service unavailability');
      // Use Playwright's skip functionality to mark test as skipped instead of failed
      const { test } = await import('@playwright/test');
      test.skip(true, 'NiFi service is not accessible - integration tests require running NiFi instance');
      return;
    }

    // Ensure authentication
    if (!(await this.isAuthenticated())) {
      await this.login();
    }

    // Final verification using modern locators
    await expect(this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS))
      .toBeVisible({ timeout: 10000 });

    await expect(this.page).toHaveTitle(/NiFi/);

    authLogger.success('NiFi is ready for testing');
  }

  /**
   * Navigate to specific page with verification
   */
  async navigateToPage(pageType) {
    const pageConfig = CONSTANTS.PAGE_TYPES[pageType];

    if (!pageConfig) {
      throw new Error(`Unknown page type: ${pageType}`);
    }

    authLogger.info(`Navigating to ${pageConfig.description || pageType}`);

    await this.page.goto(pageConfig.path || pageConfig);
    await this.page.waitForLoadState('networkidle');

    // Verify navigation success if elements are defined
    if (pageConfig.elements) {
      let found = false;
      for (const selector of pageConfig.elements) {
        if (await this.page.locator(selector).isVisible()) {
          found = true;
          break;
        }
      }
      expect(found, `Navigation to ${pageType} failed`).toBeTruthy();
    }

    authLogger.success(`Successfully navigated to ${pageType}`);
  }
}

/**
 * Convenience functions for backward compatibility
 */
export async function checkNiFiAccessibility(page, timeout = 5000) {
  const authService = new AuthService(page);
  return authService.checkNiFiAccessibility(timeout);
}

export async function checkKeycloakAccessibility(page, timeout = 5000) {
  const authService = new AuthService(page);
  return authService.checkKeycloakAccessibility(timeout);
}

export async function login(page, credentials = {}) {
  const authService = new AuthService(page);
  return authService.login(credentials);
}

export async function logout(page) {
  const authService = new AuthService(page);
  return authService.logout();
}

export async function ensureNiFiReady(page) {
  const authService = new AuthService(page);
  return authService.ensureReady();
}

export async function navigateToPage(page, pageType) {
  const authService = new AuthService(page);
  return authService.navigateToPage(pageType);
}

// Additional convenience function for backward compatibility
export async function loginNiFi(page, credentials = {}) {
  const authService = new AuthService(page);
  return authService.login(credentials);
}