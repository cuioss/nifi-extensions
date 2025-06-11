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

  // Wait for the Angular app to load - look for the nifi element to be populated
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // Wait for Angular to bootstrap by checking for either canvas or login form
  cy.get('body', { timeout: 30000 }).should(($body) => {
    const hasCanvas = $body.find('[id*="canvas"], [class*="canvas"]').length > 0;
    const hasLoginForm = $body.find('input[id*="username"], input[name="username"], input[type="text"]').length > 0;
    const hasNiFiContent = $body.find('[class*="nifi"], [id*="nifi"]').length > 0;
    
    // Angular should have loaded something by now
    expect(hasCanvas || hasLoginForm || hasNiFiContent).to.be.true;
  });

  // Check if we're already on the canvas (open access NiFi)
  cy.get('body').then(($body) => {
    const canvasElements = $body.find('[id*="canvas"], [class*="canvas"]');
    if (canvasElements.length > 0) {
      // Already on canvas - NiFi is configured for open access
      cy.log('NiFi is configured for open access - canvas detected');
      return;
    }

    // Look for login form elements
    if ($body.find('input[id$="username"]').length > 0) {
      // Traditional login form found
      cy.get('input[id$="username"]').should('be.visible');
      cy.get('input[id$="username"]').clear();
      cy.get('input[id$="username"]').type(username);
      cy.get('input[id$="password"]').clear();
      cy.get('input[id$="password"]').type(password);
      cy.get('input[value="Login"]').click();
    } else {
      // Check for other common login patterns
      const hasUsernameField = $body.find('input[name="username"], input[type="text"]').length > 0;
      const hasPasswordField = $body.find('input[name="password"], input[type="password"]').length > 0;
      
      if (hasUsernameField && hasPasswordField) {
        cy.get('input[name="username"], input[type="text"]').first().clear().type(username);
        cy.get('input[name="password"], input[type="password"]').first().clear().type(password);
        cy.get('button[type="submit"], input[type="submit"], button:contains("Login")').click();
      } else {
        cy.log('No login form detected - NiFi may be configured for open access');
      }
    }
  });

  // Wait for canvas or main UI to be available (whether after login or immediately for open access)
  // Use a more flexible selector that might match various canvas implementations
  cy.get('body', { timeout: 30000 }).should(($body) => {
    const hasCanvas = $body.find('[id*="canvas"], [class*="canvas"]').length > 0;
    const hasFlowStatus = $body.find('[class*="flow-status"], [id*="flow-status"]').length > 0;
    const hasToolbar = $body.find('[class*="toolbar"], [id*="toolbar"]').length > 0;
    const hasMainContent = $body.find('[class*="nifi-main"], [id*="main"]').length > 0;
    
    // At least one main UI element should be present
    expect(hasCanvas || hasFlowStatus || hasToolbar || hasMainContent).to.be.true;
  });
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
  // Wait for main UI elements to be present (flexible approach)
  cy.get('body', { timeout: 30000 }).should(($body) => {
    const hasCanvas = $body.find('[id*="canvas"], [class*="canvas"]').length > 0;
    const hasFlowStatus = $body.find('[class*="flow-status"], [id*="flow-status"]').length > 0;
    const hasToolbar = $body.find('[class*="toolbar"], [id*="toolbar"]').length > 0;
    const hasMainContent = $body.find('[class*="nifi-main"], [id*="main"]').length > 0;
    
    // At least one main UI element should be present
    expect(hasCanvas || hasFlowStatus || hasToolbar || hasMainContent).to.be.true;
  });
  
  // Check for canvas or other main UI elements that indicate we're in the main application
  cy.get('body').then(($body) => {
    // Look for various indicators that we're in the main NiFi UI
    const hasCanvas = $body.find('[id*="canvas"], [class*="canvas"]').length > 0;
    const hasFlowStatus = $body.find('[class*="flow-status"], [id*="flow-status"]').length > 0;
    const hasToolbar = $body.find('[class*="toolbar"], [id*="toolbar"]').length > 0;
    const hasUserMenu = $body.find('.fa-user').length > 0;
    const hasLogoutLink = $body.find('#user-logout-link').length > 0;
    
    // For open access NiFi, we might not have user menu/logout, but should have canvas
    if (hasCanvas || hasFlowStatus || hasToolbar) {
      cy.log('Verified: In main NiFi UI');
    } else if (hasUserMenu || hasLogoutLink) {
      cy.log('Verified: Logged in to authenticated NiFi');
    } else {
      // Fallback: just ensure we're not on a login page
      const hasLoginForm = $body.find('input[id$="username"], input[name="username"]').length > 0;
      expect(hasLoginForm).to.be.false;
      cy.log('Verified: Not on login page, assuming valid access');
    }
  });
});
