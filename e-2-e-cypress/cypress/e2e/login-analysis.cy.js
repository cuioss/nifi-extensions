// Simple test to understand login flow and available elements
describe('NiFi Login Analysis', () => {
  it('should identify login requirements', () => {
    cy.visit('https://localhost:9095/nifi/');
    
    // Wait for Angular app to load
    cy.get('nifi', { timeout: 30000 }).should('exist');
    
    // Wait a bit more for content to load
    cy.wait(10000);
    
    // Check if we need to login or if we're already logged in
    cy.get('body').then(($body) => {
      const bodyText = $body.text();
      const hasUsernameField = $body.find('input[type="text"], input[type="email"], input[name*="user"], input[placeholder*="user"], input[id*="user"]').length > 0;
      const hasPasswordField = $body.find('input[type="password"]').length > 0;
      const hasLoginButton = $body.find('button').filter((i, btn) => {
        const $btn = Cypress.$(btn);
        const text = $btn.text().toLowerCase();
        return text.includes('login') || text.includes('sign in') || text.includes('submit');
      }).length > 0;
      
      if (hasUsernameField && hasPasswordField) {
        cy.log('LOGIN REQUIRED - Found username and password fields');
        
        // Find and fill username field
        cy.get('input[type="text"], input[type="email"], input[name*="user"], input[placeholder*="user"], input[id*="user"]')
          .first()
          .clear()
          .type('admin');
        
        // Find and fill password field  
        cy.get('input[type="password"]')
          .first()
          .clear()
          .type('ctsBtRBKHRAx69EqUghvvgEvjnaLjFEB');
        
        // Find and click login button
        if (hasLoginButton) {
          cy.get('button').filter((i, btn) => {
            const $btn = Cypress.$(btn);
            const text = $btn.text().toLowerCase();
            return text.includes('login') || text.includes('sign in') || text.includes('submit');
          }).first().click();
        } else {
          // Try form submission
          cy.get('form').first().submit();
        }
        
        // Wait for login to complete
        cy.wait(5000);
      } else {
        cy.log('NO LOGIN REQUIRED - Direct access to NiFi');
      }
    });
    
    // After login (or if no login needed), take screenshot
    cy.screenshot('nifi-after-login');
  });
});
