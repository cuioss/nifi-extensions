describe('Phase 0: Login Analysis with File Output', () => {
  it('🔍 Investigate Login and Output Findings to File', () => {
    let findings = [];

    const addFinding = (message) => {
      findings.push(message);
      cy.log(message);
    };

    addFinding('🚀 ENHANCED LOGIN INVESTIGATION WITH FILE OUTPUT');
    addFinding('====================================================');

    // Visit login page
    cy.visit('https://localhost:9095/nifi/#/login');
    addFinding('Initial URL: https://localhost:9095/nifi/#/login');

    // Wait for page to load
    cy.wait(2000);

    // Check for any error messages on page
    cy.get('body').then(($body) => {
      const errorElements = $body.find('[class*="error"], [class*="alert"], .mat-error, .error-message');
      addFinding(`Error elements found: ${errorElements.length}`);
      if (errorElements.length > 0) {
        errorElements.each((index, element) => {
          addFinding(`Error ${index + 1}: ${element.textContent}`);
        });
      }
    });

    // Analyze login form structure
    cy.get('body').then(($body) => {
      const usernameFields = $body.find('input[type="text"], input[name*="username"], input[id*="username"]');
      const passwordFields = $body.find('input[type="password"], input[name*="password"], input[id*="password"]');
      const loginButtons = $body.find('button[type="submit"], button:contains("Log"), input[type="submit"]');

      addFinding(`Username fields: ${usernameFields.length}`);
      addFinding(`Password fields: ${passwordFields.length}`);
      addFinding(`Login buttons: ${loginButtons.length}`);

      // Log field attributes
      usernameFields.each((index, element) => {
        addFinding(`Username field ${index + 1}: id="${element.id}", name="${element.name}", class="${element.className}"`);
      });

      passwordFields.each((index, element) => {
        addFinding(`Password field ${index + 1}: id="${element.id}", name="${element.name}", class="${element.className}"`);
      });

      loginButtons.each((index, element) => {
        addFinding(`Login button ${index + 1}: type="${element.type}", text="${element.textContent}", class="${element.className}"`);
      });
    });

    // Attempt login with detailed monitoring
    addFinding('🔐 Attempting login with testUser/drowssap...');

    // Fill in credentials
    cy.get('input[type="text"], input[name*="username"], input[id*="username"]').first().type('testUser');
    cy.get('input[type="password"], input[name*="password"], input[id*="password"]').first().type('drowssap');

    // Click login button
    cy.get('button[type="submit"], button:contains("Log"), input[type="submit"]').first().click();

    // Wait for potential network requests
    cy.wait(3000);

    // Check current URL after login attempt
    cy.url().then((url) => {
      addFinding(`Post-login URL: ${url}`);
    });

    // Check for any new error messages after login attempt
    cy.get('body').then(($body) => {
      const errorElements = $body.find('[class*="error"], [class*="alert"], .mat-error, .error-message');
      addFinding(`Post-login error elements: ${errorElements.length}`);
      if (errorElements.length > 0) {
        errorElements.each((index, element) => {
          addFinding(`Post-login Error ${index + 1}: ${element.textContent}`);
        });
      }
    });

    // Try manual navigation to main canvas
    addFinding('🎯 Attempting manual navigation to main canvas...');
    cy.visit('https://localhost:9095/nifi/#/');
    cy.wait(3000);

    cy.url().then((url) => {
      addFinding(`Manual navigation URL: ${url}`);
    });

    // Analyze page after manual navigation
    cy.get('body').then(($body) => {
      const totalElements = $body.find('*').length;
      const svgElements = $body.find('svg').length;
      const canvasElements = $body.find('[class*="canvas"], #canvas, .canvas').length;
      const toolbarElements = $body.find('[class*="toolbar"], mat-toolbar, .mat-toolbar').length;
      const buttonElements = $body.find('button').length;

      addFinding(`🎯 MANUAL NAVIGATION ANALYSIS:`);
      addFinding(`Total elements: ${totalElements}`);
      addFinding(`SVG elements: ${svgElements}`);
      addFinding(`Canvas elements: ${canvasElements}`);
      addFinding(`Toolbar elements: ${toolbarElements}`);
      addFinding(`Button elements: ${buttonElements}`);

      // If we find SVG elements, analyze them
      if (svgElements > 0) {
        addFinding('✅ SVG elements found! Analyzing structure...');
        $body.find('svg').each((index, svg) => {
          addFinding(`SVG ${index + 1}: class="${svg.className.baseVal}", id="${svg.id}"`);
          addFinding(`  - Parent: ${svg.parentElement.tagName}.${svg.parentElement.className}`);
          addFinding(`  - Children: ${svg.children.length}`);
        });
      }

      // If we find toolbar elements, analyze them
      if (toolbarElements > 0) {
        addFinding('✅ Toolbar elements found! Analyzing structure...');
        $body.find('[class*="toolbar"], mat-toolbar, .mat-toolbar').each((index, toolbar) => {
          addFinding(`Toolbar ${index + 1}: class="${toolbar.className}", id="${toolbar.id}"`);
          const toolbarButtons = $(toolbar).find('button').length;
          addFinding(`  - Buttons in toolbar: ${toolbarButtons}`);
        });
      }

      // Look for any elements that might be the canvas
      const potentialCanvasElements = $body.find('div[class*="canvas"], div[id*="canvas"], div[class*="flow"], div[class*="graph"], div[class*="workspace"]');
      addFinding(`Potential canvas elements: ${potentialCanvasElements.length}`);
      if (potentialCanvasElements.length > 0) {
        potentialCanvasElements.each((index, element) => {
          addFinding(`Potential canvas ${index + 1}: tag="${element.tagName}", class="${element.className}", id="${element.id}"`);
        });
      }

      // Look for Angular Material components
      const matComponents = $body.find('[class*="mat-"]');
      addFinding(`Angular Material components: ${matComponents.length}`);

      // Look for router outlet
      const routerOutlets = $body.find('router-outlet');
      addFinding(`Router outlets: ${routerOutlets.length}`);

      // Final status
      addFinding('🎯 ENHANCED LOGIN INVESTIGATION COMPLETE');
      addFinding('==========================================');
    });

    // Write findings to file
    cy.then(() => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `target/phase0-findings-${timestamp}.txt`;
      const content = findings.join('\n');

      cy.writeFile(filename, content);
      addFinding(`📝 Findings written to: ${filename}`);
    });
  });
});