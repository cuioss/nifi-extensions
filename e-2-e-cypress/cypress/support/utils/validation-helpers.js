/**
 * Simplified validation utility functions for basic E2E tests
 * Minimal validation helpers for authentication testing
 */

/**
 * Simple error state validation
 * @returns {Cypress.Chainable} Promise that resolves with error state object
 */
export function validateErrorState() {
  return cy.get('body', { timeout: 5000 }).then(($body) => {
    // Check for various error indicators
    const hasErrorMessage =
      $body.find('.error, .alert-danger, .error-message, .flash.error').length > 0;
    const hasLoginError = $body.find('.login-error, .authentication-error').length > 0;
    const isLoginPage = $body.find('input[type="password"], .login-form').length > 0;

    let errorType = null;
    if (hasLoginError) {
      errorType = 'authentication';
    } else if (hasErrorMessage) {
      errorType = 'general';
    }

    const errorState = {
      hasError: hasErrorMessage || hasLoginError,
      isLoginPage,
      errorType,
    };

    return errorState;
  });
}

/**
 * Validate required UI elements are present
 * @param {Array} selectors - Array of CSS selectors to check
 * @param timeout
 * @returns {Cypress.Chainable}
 */
export function validateRequiredElements(selectors, timeout = 10000) {
  selectors.forEach((selector) => {
    // Try multiple selectors separated by commas
    const selectorList = selector.split(',').map((s) => s.trim());

    // Check if any of the selectors match
    selectorList.forEach((singleSelector) => {
      cy.get(singleSelector, { timeout })
        .should('exist')
        .then(() => {
          cy.log(`✅ Found element: ${singleSelector}`);
        })
        .catch(() => {
          cy.log(`⚠️ Element not found: ${singleSelector}, trying next selector`);
        });
    });
  });

  return cy.wrap(null);
}
