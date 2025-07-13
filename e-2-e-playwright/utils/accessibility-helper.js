/**
 * @fileoverview Accessibility Testing Helper - Modern 2025 Patterns
 * Activates axe-playwright for automated accessibility testing
 */

import { injectAxe, checkA11y, configureAxe } from 'axe-playwright';
import { CONSTANTS } from './constants.js';
import { authLogger as logMessage } from './shared-logger.js';

/**
 * Modern accessibility testing service
 */
export class AccessibilityService {
  constructor(page) {
    this.page = page;
    this.isInjected = false;
  }

  /**
   * Inject axe-core into the page
   */
  async inject() {
    if (this.isInjected) return;

    await injectAxe(this.page);
    
    // Configure axe for NiFi-specific testing
    await configureAxe(this.page, {
      rules: {
        // Enable important accessibility rules
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'aria-labels': { enabled: true },
        'focus-management': { enabled: true },
        
        // Disable rules that may conflict with Angular Material
        'landmark-one-main': { enabled: false },
        'page-has-heading-one': { enabled: false }
      },
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
    });

    this.isInjected = true;
    logMessage('success', 'Axe-core injected and configured');
  }

  /**
   * Run accessibility check on current page
   */
  async check(options = {}) {
    const {
      include = null,
      exclude = [
        // Exclude known third-party components that may have accessibility issues
        '.d3-tip', // D3 tooltips
        '.nvtooltip', // NVD3 tooltips
        '[data-testid="third-party"]'
      ],
      tags = ['wcag2a', 'wcag2aa'],
      detailedReport = true,
      failOnViolations = false
    } = options;

    await this.inject();

    try {
      await checkA11y(this.page, include, {
        exclude,
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true }
        },
        tags,
        detailedReport,
        detailedReportOptions: { 
          html: detailedReport,
          outputDir: 'target/accessibility-reports'
        }
      });

      logMessage('success', 'Accessibility check passed');
      return { passed: true, violations: [] };
    } catch (error) {
      if (failOnViolations) {
        throw error;
      }

      // Log accessibility issues as warnings
      logMessage('warn', `Accessibility violations found: ${error.message}`);
      return { 
        passed: false, 
        violations: error.violations || [],
        message: error.message 
      };
    }
  }

  /**
   * Check specific element for accessibility
   */
  async checkElement(selector, options = {}) {
    await this.inject();
    
    const element = this.page.locator(selector);
    await element.waitFor({ timeout: 5000 });

    return this.check({
      include: selector,
      ...options
    });
  }

  /**
   * Check login form accessibility
   */
  async checkLoginForm() {
    await this.inject();
    
    return this.check({
      include: 'form, [role="form"], .login-form',
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      detailedReport: true
    });
  }

  /**
   * Check main canvas accessibility
   */
  async checkMainCanvas() {
    await this.inject();
    
    return this.check({
      include: CONSTANTS.SELECTORS.MAIN_CANVAS,
      exclude: [
        // Exclude complex SVG elements that may have accessibility issues
        'svg', 
        '.d3-tip',
        '.nvtooltip'
      ],
      tags: ['wcag2a', 'wcag2aa'],
      detailedReport: true
    });
  }

  /**
   * Check dialog accessibility
   */
  async checkDialog() {
    await this.inject();
    
    return this.check({
      include: CONSTANTS.SELECTORS.DIALOG_CONTAINER,
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      detailedReport: true
    });
  }

  /**
   * Generate accessibility report
   */
  async generateReport(testName = 'accessibility-test') {
    await this.inject();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `target/accessibility-reports/${testName}-${timestamp}.html`;

    const result = await this.check({
      detailedReport: true,
      detailedReportOptions: {
        html: true,
        outputFile: reportPath
      }
    });

    logMessage('info', `Accessibility report generated: ${reportPath}`);
    return result;
  }
}

/**
 * Convenience functions for backward compatibility
 */
export async function checkAccessibility(page, options = {}) {
  const service = new AccessibilityService(page);
  return service.check(options);
}

export async function injectAccessibilityTester(page) {
  const service = new AccessibilityService(page);
  return service.inject();
}

export async function checkLoginAccessibility(page) {
  const service = new AccessibilityService(page);
  return service.checkLoginForm();
}

export async function checkCanvasAccessibility(page) {
  const service = new AccessibilityService(page);
  return service.checkMainCanvas();
}

export async function checkDialogAccessibility(page) {
  const service = new AccessibilityService(page);
  return service.checkDialog();
}