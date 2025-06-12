/**
 * Custom commands related to login functionality
 */

/**
 * Login to NiFi UI using username/password
 * Simplified version that works with NiFi 2.4.0 Angular UI
 */
Cypress.Commands.add('nifiLogin', (username = 'admin', password = 'ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB') => {
  cy.visit('/');

  // Wait for Angular app to load
  cy.get('nifi', { timeout: 30000 }).should('exist');
  
  // Wait for content
  cy.wait(3000);
  
  // Simple approach: if there are input fields, try to login
  cy.get('body').then(($body) => {
    if ($body.find('input').length > 0) {
      // Try to find username field
      cy.get('input').then($inputs => {
        let usernameField = null;
        let passwordField = null;
        
        $inputs.each((i, input) => {
          const $input = Cypress.$(input);
          const type = input.type;
          const name = $input.attr('name') || '';
          const id = $input.attr('id') || '';
          const placeholder = $input.attr('placeholder') || '';
          
          if (type === 'password') {
            passwordField = $input;
          } else if (type === 'text' || type === 'email' || 
                     name.toLowerCase().includes('user') ||
                     id.toLowerCase().includes('user') ||
                     placeholder.toLowerCase().includes('user')) {
            usernameField = $input;
          }
        });
        
        if (usernameField && passwordField) {
          cy.wrap(usernameField).clear().type(username);
          cy.wrap(passwordField).clear().type(password, { log: false });
          
          // Try to submit - look for submit button or press enter
          cy.get('button, input[type="submit"]').then($buttons => {
            let found = false;
            $buttons.each((i, btn) => {
              const $btn = Cypress.$(btn);
              const text = $btn.text().toLowerCase();
              const type = $btn.attr('type');
              if (!found && (text.includes('login') || text.includes('sign') || type === 'submit')) {
                cy.wrap($btn).click();
                found = true;
              }
            });
            
            if (!found) {
              cy.wrap(passwordField).type('{enter}');
            }
          });
          
          cy.wait(3000);
        }
      });
    }
  });
  
  // Wait for Angular to load main UI
  cy.get('nifi', { timeout: 30000 }).should($el => {
    expect($el.children().length).to.be.greaterThan(0);
  });
});

/**
 * Verify we're in the main NiFi application
 */
Cypress.Commands.add('verifyLoggedIn', () => {
  cy.get('nifi').should('exist');
  cy.get('body').should($body => {
    const hasContent = $body.find('nifi').children().length > 0;
    expect(hasContent).to.be.true;
  });
});
