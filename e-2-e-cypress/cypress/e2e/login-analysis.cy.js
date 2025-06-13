import { SELECTORS, TEXT_CONSTANTS } from '../support/constants.js';

// Simple test to understand login flow and available elements
describe('NiFi Login Analysis', () => {
  it('should identify login requirements', () => {
    // Use centralized URL configuration instead of hardcoded URL
    cy.visit('/');

    // Wait for Angular app to load
    cy.get('nifi', { timeout: 30000 }).should(TEXT_CONSTANTS.EXIST);

    // Wait for content to load completely
    cy.get('nifi').should(TEXT_CONSTANTS.BE_VISIBLE);

    // Check if we need to login or if we're already logged in
    cy.get('body').then(($body) => {
      // Check for login elements without storing unused variable
      const hasUsernameField = $body.find(SELECTORS.USERNAME_FIELD_SELECTOR).length > 0;
      const hasPasswordField = $body.find(SELECTORS.PASSWORD_FIELD_SELECTOR).length > 0;
      const hasLoginButton =
        $body.find(SELECTORS.BUTTON).filter((i, btn) => {
          const $btn = Cypress.$(btn);
          const text = $btn.text().toLowerCase();
          return text.includes('login') || text.includes('sign in') || text.includes('submit');
        }).length > 0;

      if (hasUsernameField && hasPasswordField) {
        cy.log('LOGIN REQUIRED - Found username and password fields');

        // Find and fill username field
        cy.get(SELECTORS.USERNAME_FIELD_SELECTOR).first();
        cy.get(SELECTORS.USERNAME_FIELD_SELECTOR).first().clear();
        cy.get(SELECTORS.USERNAME_FIELD_SELECTOR).first().type('admin');

        // Find and fill password field
        cy.get(SELECTORS.PASSWORD_FIELD_SELECTOR).first();
        cy.get(SELECTORS.PASSWORD_FIELD_SELECTOR).first().clear();
        cy.get(SELECTORS.PASSWORD_FIELD_SELECTOR).first().type('ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB');

        // Find and click login button
        if (hasLoginButton) {
          cy.get(SELECTORS.BUTTON)
            .filter((i, btn) => {
              const $btn = Cypress.$(btn);
              const text = $btn.text().toLowerCase();
              return text.includes('login') || text.includes('sign in') || text.includes('submit');
            })
            .first()
            .click();
        } else {
          // Try form submission
          cy.get('form').first().submit();
        }

        // Wait for login to complete
        cy.url().should('include', '/nifi');
      } else {
        cy.log('NO LOGIN REQUIRED - Direct access to NiFi');
      }
    });

    // After login (or if no login needed), take screenshot
    cy.screenshot('nifi-after-login');
  });
});
