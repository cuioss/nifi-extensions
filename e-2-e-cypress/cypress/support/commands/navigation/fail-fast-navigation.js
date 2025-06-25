/**
 * Navigation commands with fail-fast approach for processor availability testing
 * Focus: Fast navigation to main page with aggressive timeouts
 */

/**
 * Navigate to main NiFi page with fail-fast approach
 * Uses existing authentication state - no additional login
 */
Cypress.Commands.add('navigateToMainPage', () => {
  cy.log('🚀 Navigating to main NiFi page (fail-fast mode)');

  // Start timer for fail-fast
  cy.startTestTimer('navigate-to-main');

  // Visit the main page - should use existing session
  cy.visit('/', { timeout: 8000 });

  // Verify we're not redirected to login (fail-fast)
  cy.url({ timeout: 5000 }).should('not.contain', '/login');

  // Wait for canvas container with aggressive timeout
  const canvasSelectors = [
    '#canvas',
    '#canvas-container',
    '[data-testid="canvas-container"]',
    '.canvas-container',
    '.canvas',
    'svg',
    '.flow-canvas',
  ];

  cy.get(canvasSelectors.join(', '), { timeout: 10000 })
    .should('be.visible')
    .then(() => {
      cy.log('✅ Main page loaded successfully');
      cy.endTestTimer('navigate-to-main');
    });
});

/**
 * Navigate directly to canvas with fail-fast error handling
 */
Cypress.Commands.add('navigateToCanvasFast', () => {
  cy.log('🎯 Fast navigation to canvas');

  cy.startTestTimer('navigate-to-canvas');

  // Try multiple navigation strategies with fail-fast
  cy.get('body').then(($body) => {
    if ($body.find('#canvas-container').length > 0) {
      cy.log('✅ Canvas already visible');
      cy.endTestTimer('navigate-to-canvas');
      return;
    }

    // Navigate to NiFi main page
    cy.visit('/nifi', { timeout: 8000 });

    // Wait for any canvas indicator with tight timeout
    const canvasSelectors = [
      '#canvas',
      '#canvas-container',
      '[data-testid="canvas-container"]',
      '.canvas-container',
      '.canvas',
      'svg',
      '.flow-canvas',
    ];

    cy.get(canvasSelectors.join(', '), { timeout: 10000 })
      .should('be.visible')
      .then(() => {
        cy.log('✅ Canvas navigation completed');
        cy.endTestTimer('navigate-to-canvas');
      });
  });
});
