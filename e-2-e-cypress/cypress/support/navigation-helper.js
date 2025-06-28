/**
 * @file Navigation Helper - Simplified NiFi Navigation for Processor Testing
 * Provides reliable navigation and page verification focused on NiFi login functionality
 * Minimized variants for detecting login URL as requested
 * @version 1.0.0
 */

import { PAGE_TYPES, PAGE_DEFINITIONS } from './constants';
import { findCanvasElements, logMessage } from './utils';

/**
 * @typedef {Object} PageContext
 * @property {string} url - Current page URL
 * @property {boolean} isAuthenticated - User authentication status
 * @property {string} pageType - Detected page type (LOGIN, MAIN_CANVAS, UNKNOWN)
 * @property {boolean} isReady - Page ready state
 */

/**
 * Minimal page type detection - single URL pattern for login as specified
 * NiFi provides only one URL for login: https://localhost:9095/nifi/#/login
 * @param {string} url - Current page URL
 * @returns {string} Detected page type
 */
function detectPageType(url) {
  const normalizedUrl = url.toLowerCase();

  // Single login URL pattern as specified in requirements
  if (normalizedUrl.includes('#/login')) {
    return PAGE_TYPES.LOGIN;
  }

  // Main canvas detection - if not login and has canvas indicators
  if (normalizedUrl.includes('#/canvas') || normalizedUrl.includes('/nifi')) {
    return PAGE_TYPES.MAIN_CANVAS;
  }

  return PAGE_TYPES.UNKNOWN;
}

/**
 * Minimal element detection for login/canvas identification
 * @returns {Object} Elements analysis result
 */
function analyzePageElements() {
  const $body = Cypress.$('body');
  const canvasAnalysis = findCanvasElements($body);

  return {
    hasLoginElements: $body.find('input[type="password"]').length > 0,
    hasCanvasElements: canvasAnalysis.hasCanvas,
  };
}

/**
 * Populate content indicators based on page context
 * @param {Object} context - Page context object
 */
function populateIndicators(context) {
  if (context.elements.hasLoginElements) {
    context.indicators.push('login-form');
  }
  if (context.elements.hasCanvasElements) {
    context.indicators.push('canvas-elements');
  }
  if (context.isAuthenticated) {
    context.indicators.push('authenticated');
  }
  if (context.pageType !== PAGE_TYPES.UNKNOWN) {
    context.indicators.push(`page-type-${context.pageType.toLowerCase()}`);
  }
  if (context.url.includes('nifi')) {
    context.indicators.push('nifi-url');
  }
}

/**
 * Get current page context with simplified detection
 * @returns {PageContext} Current page context
 */
Cypress.Commands.add('getPageContext', () => {
  return cy.url().then((currentUrl) => {
    return cy.location('pathname').then((pathname) => {
      return cy.title().then((pageTitle) => {
        return cy.get('body', { log: false }).then(() => {
          // Analyze elements
          const elements = analyzePageElements();

          // Simple authentication detection
          let isAuthenticated = false;
          const isOnLoginPage = currentUrl.includes('/login') || currentUrl.includes('#/login');

          if (!isOnLoginPage) {
            // Check if session was explicitly cleared
            let sessionWasCleared = false;
            try {
              sessionWasCleared =
                window.sessionStorage.getItem('cypress-session-cleared') === 'true';
            } catch (error) {
              // Ignore sessionStorage errors
            }

            if (!sessionWasCleared && elements.hasCanvasElements) {
              isAuthenticated = true;
            }
          }

          // Build context
          const context = {
            url: currentUrl,
            pathname: pathname,
            title: pageTitle,
            isAuthenticated: isAuthenticated,
            elements: elements,
            indicators: [], // Initialize as empty array, will be populated below
            timestamp: new Date().toISOString(),
          };

          // Detect page type
          context.pageType = detectPageType(context.url);

          // Populate indicators based on detected elements and page type
          populateIndicators(context);

          // Determine ready state - simplified logic
          context.isReady =
            context.pageType !== PAGE_TYPES.UNKNOWN &&
            (context.pageType === PAGE_TYPES.LOGIN
              ? context.elements.hasLoginElements
              : context.pageType === PAGE_TYPES.MAIN_CANVAS
                ? context.elements.hasCanvasElements && context.isAuthenticated
                : false);

          // Simple logging
          logMessage(
            'info',
            `Page: ${context.pageType} | Auth: ${context.isAuthenticated} | Ready: ${context.isReady}`
          );

          return cy.wrap(context);
        });
      });
    });
  });
});

/**
 * Navigate to a specific page - simplified version
 * @param {string} pathOrPageType - Path to navigate to OR page type
 * @param {Object} options - Navigation options
 * @param {string} [options.expectedPageType] - Expected page type after navigation
 * @param {number} [options.timeout=10000] - Navigation timeout
 * @param {boolean} [options.waitForReady=true] - Wait for page ready state
 */
Cypress.Commands.add('navigateToPage', (pathOrPageType, options = {}) => {
  const { expectedPageType, timeout = 10000, waitForReady = true } = options;

  // Resolve page type to path
  let actualPath = pathOrPageType;
  let expectedType = expectedPageType;

  if (pathOrPageType === PAGE_TYPES.LOGIN) {
    actualPath = '/#/login';
    expectedType = expectedType || PAGE_TYPES.LOGIN;
  } else if (pathOrPageType === PAGE_TYPES.MAIN_CANVAS) {
    actualPath = '/';
    expectedType = expectedType || PAGE_TYPES.MAIN_CANVAS;
  }

  logMessage('info', `Navigating to: ${actualPath} (expecting: ${expectedType || 'any'})`);

  // Simple navigation
  cy.visit(actualPath, {
    timeout: timeout,
    failOnStatusCode: false,
  });

  // Verify if expected type is specified
  if (expectedType) {
    // For LOGIN page, wait for elements to appear before checking readiness
    if (expectedType === PAGE_TYPES.LOGIN) {
      cy.get('input[type="password"], input[type="text"]', { timeout: 10000 }).should('be.visible');
    }

    cy.getPageContext().should((context) => {
      if (context.pageType !== expectedType) {
        throw new Error(`Expected ${expectedType}, got ${context.pageType}`);
      }
      if (waitForReady && !context.isReady) {
        throw new Error(`Page ${expectedType} not ready for testing`);
      }
    });
  }

  return cy.getPageContext();
});

/**
 * Verify current page type
 * @param {string} expectedPageType - Expected page type
 * @param {Object} options - Verification options
 * @param {boolean} [options.strict=true] - Strict verification
 * @param {boolean} [options.waitForReady=true] - Ensure page is ready
 */
Cypress.Commands.add('verifyPageType', (expectedPageType, options = {}) => {
  const { strict = true, waitForReady = true } = options;

  logMessage('search', `Verifying page type: ${expectedPageType}`);

  // For LOGIN page, wait for elements to appear before checking readiness
  if (expectedPageType === PAGE_TYPES.LOGIN) {
    cy.get('input[type="password"], input[type="text"]', { timeout: 10000 }).should('be.visible');
  }

  return cy.getPageContext().should((context) => {
    if (context.pageType !== expectedPageType) {
      const message = `Expected ${expectedPageType}, got ${context.pageType}`;
      if (strict) {
        throw new Error(message);
      } else {
        logMessage('warn', message);
      }
    }

    if (waitForReady && !context.isReady) {
      const message = `Page ${expectedPageType} not ready for testing`;
      if (strict) {
        throw new Error(message);
      } else {
        logMessage('warn', message);
      }
    }
  });
});

/**
 * Wait for a specific page type to load
 * @param {string} expectedPageType - Page type to wait for
 * @param {Object} options - Wait options
 * @param {number} [options.timeout=10000] - Total timeout
 */
Cypress.Commands.add('waitForPageType', (expectedPageType, options = {}) => {
  const { timeout = 10000 } = options;

  logMessage('info', `Waiting for page type: ${expectedPageType}`);

  return cy
    .getPageContext({ timeout })
    .should((context) => {
      if (context.pageType !== expectedPageType || !context.isReady) {
        throw new Error(
          `Waiting for ${expectedPageType}, got ${context.pageType}, ready: ${context.isReady}`
        );
      }
    })
    .then(() => {
      return cy.getPageContext();
    });
});

/**
 * Navigate with authentication check - delegates to auth-helper
 * @param {string} path - Path to navigate to
 * @param {Object} options - Navigation options
 */
Cypress.Commands.add('navigateWithAuth', (path, options = {}) => {
  logMessage('info', `Navigating with auth check to: ${path}`);

  // Ensure authentication first (from auth-helper)
  cy.ensureNiFiReady();

  // Then navigate
  return cy.navigateToPage(path, options);
});

/**
 * Get available page type definitions
 * @returns {Object} Page type definitions
 */
Cypress.Commands.add('getAvailablePageTypes', () => {
  return cy.wrap(PAGE_DEFINITIONS);
});

/**
 * Test multiple navigation paths - simplified version
 * @param {Array<Object>} navigationPaths - Array of navigation test cases
 */
Cypress.Commands.add('testNavigationPaths', (navigationPaths) => {
  logMessage('info', `Testing ${navigationPaths.length} navigation paths`);

  navigationPaths.forEach((navPath, index) => {
    const { path, expectedPageType, description = `Navigation ${index + 1}` } = navPath;

    logMessage('info', `Testing: ${description} (${path} → ${expectedPageType})`);

    cy.navigateToPage(path, { expectedPageType }).then((context) => {
      expect(context.pageType).to.equal(expectedPageType);
      logMessage('success', `${description}: ${context.pageType}`);
    });
  });

  logMessage('success', 'All navigation paths tested successfully');
});
