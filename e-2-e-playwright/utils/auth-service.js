/**
 * @fileoverview Consolidated Authentication Service - Modern 2025 Patterns
 * Combines auth-helper.js and login-tool.js with modern Playwright features
 * Removes duplication and uses 2025 best practices
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from './constants.js';
// Simplified logging - using console.log instead of custom logger

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
    console.log(`🔵 AUTH: Checking ${serviceName} accessibility...`);

    try {
      const response = await this.page.request.get(serviceUrl, {
        timeout,
        failOnStatusCode: false
      });

      // Consider 401 as accessible (requires auth)
      const isAccessible = response && 
        ((response.status() >= 200 && response.status() < 400) || response.status() === 401);

      if (isAccessible) {
        console.log(`✅ AUTH: ${serviceName} service is accessible`);
      } else {
        console.log(`🔴 AUTH: ${serviceName} not accessible - Status: ${response?.status() || 'unknown'}`);
      }

      return isAccessible;
    } catch (error) {
      console.log(`🔴 AUTH: ${serviceName} not accessible - ${error.message}`);
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
   */
  async login(credentials = {}) {
    const username = credentials.username || CONSTANTS.AUTH.USERNAME;
    const password = credentials.password || CONSTANTS.AUTH.PASSWORD;

    const start = Date.now();
    console.log(`🔵 AUTH: Starting login for user: ${username}...`);
    try {
      const result = await (async () => {
      // Navigate to login page
      await this.page.goto('/nifi');
      await this.page.waitForLoadState('networkidle');

      // Check if already authenticated
      if (await this.isAuthenticated()) {
        console.log('🔵 AUTH: Already authenticated');
        return true;
      }

      // Look for login button with modern selectors
      const loginButton = this.page.getByRole('button', { name: /log in|login/i });
      if (await loginButton.isVisible()) {
        await loginButton.click();
      }

      // Fill credentials using semantic locators
      await this.page.getByLabel(/username|email/i).fill(username);
      await this.page.getByLabel(/password/i).fill(password);

      // Submit login form
      await this.page.getByRole('button', { name: /sign in|login|submit/i }).click();

      // Wait for authentication with proper error handling
      try {
        await expect(this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS))
          .toBeVisible({ timeout: 30000 });
        
        console.log(`✅ AUTH: Successfully logged in as ${username}`);
        return true;
      } catch (error) {
        // Check for error messages
        const errorElement = this.page.locator('.login-error, .error-message, .alert-danger');
        const errorText = await errorElement.textContent().catch(() => null);
        
        const errorMsg = errorText 
          ? `Login failed - ${errorText}` 
          : `Login failed for user: ${username}`;
        
        console.log(`🔴 AUTH: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      })();
      const duration = Date.now() - start;
      console.log(`✅ AUTH: Login for user: ${username} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`🔴 AUTH: Login for user: ${username} failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Modern logout with proper cleanup
   */
  async logout() {
    console.log('info', 'Performing logout...');

    // Clear authentication state
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate to login page
    await this.page.goto('/nifi');
    await this.page.waitForLoadState('networkidle');

    // Verify logout success
    const isLoggedOut = await this.page.getByRole('button', { name: /log in|login/i })
      .isVisible()
      .catch(() => false);

    if (isLoggedOut) {
      console.log('success', 'Successfully logged out');
    } else {
      throw new Error('Logout failed - Login button not visible');
    }
  }

  /**
   * Ensure NiFi is ready for testing with modern patterns
   */
  async ensureReady() {
    console.log('info', 'Ensuring NiFi is ready for testing...');

    // Check service accessibility
    const isAccessible = await this.checkNiFiAccessibility();
    expect(isAccessible, 'NiFi is not accessible').toBeTruthy();

    // Ensure authentication
    if (!(await this.isAuthenticated())) {
      await this.login();
    }

    // Final verification using modern locators
    await expect(this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS))
      .toBeVisible({ timeout: 10000 });
    
    await expect(this.page).toHaveTitle(/NiFi/);

    console.log('success', 'NiFi is ready for testing');
  }

  /**
   * Navigate to specific page with verification
   */
  async navigateToPage(pageType) {
    const pageConfig = CONSTANTS.PAGE_TYPES[pageType];
    
    if (!pageConfig) {
      throw new Error(`Unknown page type: ${pageType}`);
    }

    console.log('info', `Navigating to ${pageConfig.description || pageType}`);

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

    console.log('success', `Successfully navigated to ${pageType}`);
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