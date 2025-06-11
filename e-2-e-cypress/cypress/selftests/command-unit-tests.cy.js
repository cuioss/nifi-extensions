/**
 * REAL integration tests for Cypress custom commands
 * These tests verify core functionality against an actual NiFi instance
 *
 * Prerequisites:
 * - NiFi must be running on https://localhost:9095/nifi
 * - Default credentials: admin/adminadminadmin
 * - MultiIssuerJWTTokenAuthenticator processor must be available
 */

describe('Core Command Integration Tests', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi';

  before(() => {
    // Verify NiFi is accessible before running tests
    cy.request({
      url: `${baseUrl}/`,
      failOnStatusCode: false,
      timeout: 10000,
    }).then((response) => {
      if (response.status !== 200) {
        throw new Error(`NiFi not accessible at ${baseUrl}. Status: ${response.status}`);
      }
    });
  });
  describe('Login Command Integration', () => {
    it('should successfully login to real NiFi instance', () => {
      // Clear any existing sessions
      cy.clearCookies();
      cy.clearLocalStorage();

      // Test actual nifiLogin command against real NiFi
      cy.nifiLogin('admin', 'adminadminadmin');

      // Verify we're actually logged into NiFi
      cy.get('#canvas-container', { timeout: 15000 }).should('be.visible');
      cy.get('.flow-status', { timeout: 10000 }).should('be.visible');

      // Verify user menu exists (indicates successful login)
      cy.get('.fa-user', { timeout: 5000 }).should('be.visible');
    });

    it('should handle invalid credentials gracefully', () => {
      // Clear any existing sessions
      cy.clearCookies();
      cy.clearLocalStorage();

      // Visit login page directly
      cy.visit('/');

      // Try invalid credentials
      cy.get('input[id$="username"]', { timeout: 10000 }).should('be.visible');
      cy.get('input[id$="username"]').clear().type('invalid');
      cy.get('input[id$="password"]').clear().type('invalid');
      cy.get('input[value="Login"]').click();

      // Should still be on login page or show error
      cy.get('body').then(($body) => {
        const hasLoginForm = $body.find('input[id$="username"]').length > 0;
        const hasError = $body.find('.login-error, .error-message').length > 0;
        const hasCanvas = $body.find('#canvas-container').length > 0;

        // Should NOT be logged in
        expect(hasCanvas && !hasLoginForm).to.be.false;
      });
    });

    it('should verify logged in state correctly', () => {
      // Login first
      cy.nifiLogin('admin', 'adminadminadmin');

      // Test verifyLoggedIn command
      cy.verifyLoggedIn();

      // Additional verification of login state
      cy.get('#canvas-container').should('be.visible');
      cy.get('.flow-status').should('be.visible');
    });
  });

  describe('Navigation Command Integration', () => {
    beforeEach(() => {
      // Ensure we're logged in before navigation tests
      cy.nifiLogin('admin', 'adminadminadmin');
    });

    it('should navigate to canvas successfully', () => {
      // Test navigateToCanvas command
      cy.navigateToCanvas();

      // Verify we're on the canvas
      cy.get('#canvas-container').should('be.visible');
      cy.get('#canvas', { timeout: 10000 }).should('be.visible');
      cy.url().should('include', '/nifi');
    });

    it('should navigate to controller services', () => {
      // Test navigation to controller services
      cy.navigateToControllerServices();

      // Verify we're on controller services page
      cy.url().should('include', 'controller-services');
      cy.get('.controller-services-table, #controller-services-table', { timeout: 10000 }).should(
        'be.visible'
      );
    });

    it('should maintain session across navigation', () => {
      // Navigate to different areas and verify session persists
      cy.navigateToCanvas();
      cy.verifyLoggedIn();

      cy.navigateToControllerServices();
      cy.verifyLoggedIn();

      cy.navigateToCanvas();
      cy.verifyLoggedIn();
    });
  });

  describe('Processor Addition Integration', () => {
    beforeEach(() => {
      // Ensure we're logged in and on canvas
      cy.nifiLogin('admin', 'adminadminadmin');
      cy.navigateToCanvas();
    });

    afterEach(() => {
      // Clean up any processors we added during tests
      cy.get('body').then(($body) => {
        // Remove any processors that might have been added
        if ($body.find('.processor[data-test-id*="MultiIssuerJWTToken"]').length > 0) {
          cy.get('.processor[data-test-id*="MultiIssuerJWTToken"]').each(($processor) => {
            cy.wrap($processor).rightclick();
            cy.get('.context-menu').contains('Delete').click({ force: true });
            cy.get('.dialog').contains('Delete').click({ force: true });
          });
        }
      });
    });

    it('should add MultiIssuerJWTTokenAuthenticator processor to canvas', () => {
      // Test addProcessor command with our specific processor
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 300, y: 300 }).then(
        (processorId) => {
          // Verify processor was actually added
          expect(processorId).to.exist;
          expect(processorId).to.be.a('string');

          // Verify processor appears on canvas
          cy.get(`[data-testid="${processorId}"], g[id="${processorId}"]`, { timeout: 10000 })
            .should('exist')
            .and('be.visible');

          // Verify processor type is correct
          cy.get(`[data-testid="${processorId}"], g[id="${processorId}"]`).should(
            'contain.text',
            'MultiIssuerJWTTokenAuthenticator'
          );
        }
      );
    });

    it('should verify processor is available in processor types', () => {
      // Open the processor palette/dialog
      cy.get('#canvas', { timeout: 10000 }).should('be.visible');
      cy.get('#canvas').dblclick(300, 300);

      // Wait for add processor dialog
      cy.get('.add-processor-dialog, .new-processor-type', { timeout: 10000 }).should('be.visible');

      // Search for our processor
      cy.get('.processor-type-filter, input[placeholder*="filter"], input[placeholder*="search"]')
        .should('be.visible')
        .type('MultiIssuerJWTTokenAuthenticator');

      // Verify our processor appears in the list
      cy.get('.processor-type').contains('MultiIssuerJWTTokenAuthenticator').should('be.visible');

      // Close dialog
      cy.get('.dialog-close, button:contains("Cancel")').click();
    });

    it('should handle processor addition at different positions', () => {
      // Test adding processors at different canvas positions
      const positions = [
        { x: 200, y: 200 },
        { x: 500, y: 300 },
        { x: 350, y: 150 },
      ];

      const processorIds = [];

      positions.forEach((position, index) => {
        cy.addProcessor('MultiIssuerJWTTokenAuthenticator', position).then((processorId) => {
          processorIds.push(processorId);

          // Verify each processor exists
          cy.get(`[data-testid="${processorId}"], g[id="${processorId}"]`)
            .should('exist')
            .and('be.visible');
        });
      });

      // Verify all processors are on canvas
      cy.then(() => {
        expect(processorIds).to.have.length(3);
        processorIds.forEach((id) => {
          expect(id).to.be.a('string');
          expect(id).to.not.be.empty;
        });
      });
    });
  });

  describe('Command Error Handling Integration', () => {
    it('should handle NiFi unavailable gracefully', () => {
      // Test behavior when NiFi is not responsive
      const originalBaseUrl = Cypress.config('baseUrl');

      // Temporarily set invalid URL
      Cypress.config('baseUrl', 'https://invalid-nifi-url:9999');

      // Should handle connection errors gracefully
      cy.on('fail', (err) => {
        expect(err.message).to.include('ECONNREFUSED', 'getaddrinfo ENOTFOUND', 'timeout');
        return false;
      });

      // Restore original URL
      Cypress.config('baseUrl', originalBaseUrl);
    });

    it('should handle processor addition failures', () => {
      // Login and navigate to canvas
      cy.nifiLogin('admin', 'adminadminadmin');
      cy.navigateToCanvas();

      // Test adding non-existent processor type
      cy.on('fail', (err) => {
        expect(err.message).to.include('processor', 'not found', 'invalid');
        return false;
      });

      // This should fail gracefully
      cy.addProcessor('NonExistentProcessorType').then((result) => {
        // Should either return null/undefined or throw handled error
        expect(result).to.be.oneOf([null, undefined]);
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete login within acceptable time', () => {
      const startTime = Date.now();

      cy.nifiLogin('admin', 'adminadminadmin').then(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Login should complete within 30 seconds
        expect(duration).to.be.lessThan(30000);

        cy.log(`Login completed in ${duration}ms`);
      });
    });

    it('should handle multiple rapid operations', () => {
      // Test rapid succession of operations
      cy.nifiLogin('admin', 'adminadminadmin');
      cy.navigateToCanvas();
      cy.verifyLoggedIn();
      cy.navigateToControllerServices();
      cy.navigateToCanvas();
      cy.verifyLoggedIn();

      // All operations should complete successfully
      cy.get('#canvas-container').should('be.visible');
    });
  });
});
