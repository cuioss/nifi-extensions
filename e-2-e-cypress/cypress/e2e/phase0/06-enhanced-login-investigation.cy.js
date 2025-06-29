describe('Phase 0: Enhanced Login Investigation', () => {
  it('🔍 Investigate Login Process and Authentication Flow', () => {
    cy.log('🚀 ENHANCED LOGIN INVESTIGATION');
    cy.log('====================================');

    // Visit login page
    cy.visit('https://localhost:9095/nifi/#/login');
    cy.log('Initial URL: ' + Cypress.config().baseUrl + '/#/login');

    // Wait for page to load
    cy.wait(2000);

    // Check for any error messages on page
    cy.get('body').then(($body) => {
      const errorElements = $body.find('[class*="error"], [class*="alert"], .mat-error, .error-message');
      cy.log(`Error elements found: ${errorElements.length}`);
      if (errorElements.length > 0) {
        errorElements.each((index, element) => {
          cy.log(`Error ${index + 1}: ${element.textContent}`);
        });
      }
    });

    // Analyze login form structure
    cy.get('body').then(($body) => {
      const usernameFields = $body.find('input[type="text"], input[name*="username"], input[id*="username"]');
      const passwordFields = $body.find('input[type="password"], input[name*="password"], input[id*="password"]');
      const loginButtons = $body.find('button[type="submit"], button:contains("Log"), input[type="submit"]');

      cy.log(`Username fields: ${usernameFields.length}`);
      cy.log(`Password fields: ${passwordFields.length}`);
      cy.log(`Login buttons: ${loginButtons.length}`);

      // Log field attributes
      usernameFields.each((index, element) => {
        cy.log(`Username field ${index + 1}: id="${element.id}", name="${element.name}", class="${element.className}"`);
      });

      passwordFields.each((index, element) => {
        cy.log(`Password field ${index + 1}: id="${element.id}", name="${element.name}", class="${element.className}"`);
      });

      loginButtons.each((index, element) => {
        cy.log(`Login button ${index + 1}: type="${element.type}", text="${element.textContent}", class="${element.className}"`);
      });
    });

    // Attempt login with detailed monitoring
    cy.log('🔐 Attempting login with testUser/drowssap...');

    // Intercept any authentication requests
    cy.intercept('POST', '**/access/token').as('tokenRequest');
    cy.intercept('POST', '**/login').as('loginRequest');
    cy.intercept('GET', '**/access').as('accessRequest');

    // Fill in credentials
    cy.get('input[type="text"], input[name*="username"], input[id*="username"]').first().type('testUser');
    cy.get('input[type="password"], input[name*="password"], input[id*="password"]').first().type('drowssap');

    // Click login button
    cy.get('button[type="submit"], button:contains("Log"), input[type="submit"]').first().click();

    // Wait for potential network requests
    cy.wait(3000);

    // Check if any intercepted requests occurred
    cy.then(() => {
      cy.log('🌐 Checking for intercepted requests...');
    });

    // Check current URL after login attempt
    cy.url().then((url) => {
      cy.log(`Post-login URL: ${url}`);
    });

    // Check for any new error messages after login attempt
    cy.get('body').then(($body) => {
      const errorElements = $body.find('[class*="error"], [class*="alert"], .mat-error, .error-message');
      cy.log(`Post-login error elements: ${errorElements.length}`);
      if (errorElements.length > 0) {
        errorElements.each((index, element) => {
          cy.log(`Post-login Error ${index + 1}: ${element.textContent}`);
        });
      }
    });

    // Try manual navigation to main canvas
    cy.log('🎯 Attempting manual navigation to main canvas...');
    cy.visit('https://localhost:9095/nifi/#/');
    cy.wait(3000);

    cy.url().then((url) => {
      cy.log(`Manual navigation URL: ${url}`);
    });

    // Analyze page after manual navigation
    cy.get('body').then(($body) => {
      const totalElements = $body.find('*').length;
      const svgElements = $body.find('svg').length;
      const canvasElements = $body.find('[class*="canvas"], #canvas, .canvas').length;
      const toolbarElements = $body.find('[class*="toolbar"], mat-toolbar, .mat-toolbar').length;
      const buttonElements = $body.find('button').length;

      cy.log(`🎯 MANUAL NAVIGATION ANALYSIS:`);
      cy.log(`Total elements: ${totalElements}`);
      cy.log(`SVG elements: ${svgElements}`);
      cy.log(`Canvas elements: ${canvasElements}`);
      cy.log(`Toolbar elements: ${toolbarElements}`);
      cy.log(`Button elements: ${buttonElements}`);

      // If we find SVG elements, analyze them
      if (svgElements > 0) {
        cy.log('✅ SVG elements found! Analyzing structure...');
        $body.find('svg').each((index, svg) => {
          cy.log(`SVG ${index + 1}: class="${svg.className.baseVal}", id="${svg.id}"`);
          cy.log(`  - Parent: ${svg.parentElement.tagName}.${svg.parentElement.className}`);
          cy.log(`  - Children: ${svg.children.length}`);
        });
      }

      // If we find toolbar elements, analyze them
      if (toolbarElements > 0) {
        cy.log('✅ Toolbar elements found! Analyzing structure...');
        $body.find('[class*="toolbar"], mat-toolbar, .mat-toolbar').each((index, toolbar) => {
          cy.log(`Toolbar ${index + 1}: class="${toolbar.className}", id="${toolbar.id}"`);
          const toolbarButtons = $(toolbar).find('button').length;
          cy.log(`  - Buttons in toolbar: ${toolbarButtons}`);
        });
      }
    });

    // Final status
    cy.log('🎯 ENHANCED LOGIN INVESTIGATION COMPLETE');
    cy.log('==========================================');
  });
});