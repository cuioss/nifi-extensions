/**
 * @fileoverview Login Page Object - Modern 2025 Patterns
 * Implements Page Object Model with fixtures integration
 */

import { expect } from '@playwright/test';
import { CONSTANTS } from '../utils/constants.js';

/**
 * Modern Login Page Object with 2025 best practices
 */
export class LoginPage {
  constructor(page) {
    this.page = page;
    this.initializeLocators();
  }

  /**
   * Initialize locators using modern Playwright patterns
   */
  initializeLocators() {
    // Use semantic locators instead of complex selectors
    this.usernameInput = this.page.getByLabel(/username|email/i);
    this.passwordInput = this.page.getByLabel(/password/i);
    this.loginButton = this.page.getByRole('button', { name: /log in|login|sign in/i });
    this.errorMessage = this.page.locator('.login-error, .error-message, .alert-danger');
    this.loginForm = this.page.locator('form, [role="form"]');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto('/nifi');
    await this.page.waitForLoadState('networkidle');
    
    // Check if login button is available (might already be on login page)
    const needsLogin = await this.page.getByRole('button', { name: /log in|login/i })
      .isVisible()
      .catch(() => false);
    
    if (needsLogin) {
      await this.page.getByRole('button', { name: /log in|login/i }).click();
    }
  }

  /**
   * Fill login credentials
   */
  async fillCredentials(username, password) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Submit login form
   */
  async submit() {
    await this.loginButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Perform complete login flow
   * Always uses constants directly - passwords are never passed as parameters
   */
  async login() {
    await this.goto();
    await this.fillCredentials(CONSTANTS.AUTH.USERNAME, CONSTANTS.AUTH.PASSWORD);
    await this.submit();
  }

  /**
   * Verify login success
   */
  async verifyLoginSuccess() {
    // Check for main canvas or dashboard
    await expect(this.page.locator(CONSTANTS.SELECTORS.MAIN_CANVAS))
      .toBeVisible({ timeout: 30000 });
    
    // Verify page title
    await expect(this.page).toHaveTitle(/NiFi/);
  }

  /**
   * Verify login failure
   */
  async verifyLoginFailure(expectedErrorText = null) {
    // Should still be on login page
    await expect(this.loginButton).toBeVisible();
    
    // Check for error message if specified
    if (expectedErrorText) {
      await expect(this.errorMessage).toContainText(expectedErrorText);
    }
  }

  /**
   * Get error message text
   */
  async getErrorMessage() {
    return this.errorMessage.textContent().catch(() => null);
  }

  /**
   * Check if login form is visible
   */
  async isLoginFormVisible() {
    return this.loginForm.isVisible();
  }

  /**
   * Validate form elements are present
   */
  async validateFormElements() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }
}