/**
 * Custom commands related to login functionality
 */

/**
 * Login to NiFi UI using username/password
 * @param {string} username - The username to log in with
 * @param {string} password - The password to log in with
 */
Cypress.Commands.add('nifiLogin', (username, password) => {
  cy.visit('/');

  // Wait for login form to be visible
  cy.get('input[id$="username"]').should('be.visible');

  // Fill in username and password
  cy.get('input[id$="username"]').clear();
  cy.get('input[id$="username"]').type(username);
  cy.get('input[id$="password"]').clear();
  cy.get('input[id$="password"]').type(password);

  // Click login button
  cy.get('input[value="Login"]').click();

  // Check if login successful (NiFi canvas should be visible)
  cy.get('#canvas-container').should('exist');
});

/**
 * Login to Keycloak using username/password
 * @param {string} username - The username to log in with
 * @param {string} password - The password to log in with
 */
Cypress.Commands.add('keycloakLogin', (username, password) => {
  const keycloakUrl = Cypress.env('keycloakUrl');
  const realm = Cypress.env('keycloakRealm');

  cy.visit(`${keycloakUrl}/realms/${realm}/account`);

  // Check if already logged in
  cy.get('body').then(($body) => {
    if ($body.find('#kc-login-form').length > 0) {
      // Not logged in, fill form
      cy.get('#username').clear();
      cy.get('#username').type(username);
      cy.get('#password').clear();
      cy.get('#password').type(password);
      cy.get('#kc-login').click();
    }
  });

  // Verify login successful
  cy.get('.kc-dropdown').should('be.visible');
});

/**
 * Verify successful login state in NiFi UI
 */
Cypress.Commands.add('verifyLoggedIn', () => {
  // Check for elements that only appear when logged in
  cy.get('#canvas-container').should('exist');
  cy.get('#user-logout-link').should('exist');
});
