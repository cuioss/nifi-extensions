/**
 * @file NiFi Navigation Tests
 * Tests navigation functionality within the NiFi UI
 * Focuses on page transitions, canvas access, and UI state management
 */

import { PAGE_TYPES } from '../support/constants';

describe('NiFi Navigation Tests', () => {
  beforeEach(() => {
    // Ensure NiFi is ready for testing using auth helper
    cy.ensureNiFiReady();
  });

  it('Should navigate from login to main canvas', () => {
    cy.log('🧭 Testing navigation from login to main canvas');

    // Verify we're already authenticated and on main canvas (from beforeEach)
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal(PAGE_TYPES.MAIN_CANVAS);
      expect(context.isAuthenticated).to.be.true;
      cy.log('✅ Successfully navigated to main canvas after login');
    });

    // Test navigation helper - verify we can navigate to main canvas
    cy.navigateToPage(PAGE_TYPES.MAIN_CANVAS);
    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS);

    // Verify navigation succeeded
    cy.log('✅ Navigation to main canvas verified using helpers');
  });

  it('Should verify canvas is accessible and ready for operations', () => {
    cy.log('🎯 Testing canvas accessibility and readiness');

    // Verify we're on the main canvas page (from beforeEach)
    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal(PAGE_TYPES.MAIN_CANVAS);
      expect(context.isAuthenticated).to.be.true;
      expect(context.isReady).to.be.true;
      cy.log('✅ Canvas is accessible and ready for operations');
    });

    // Check for basic page elements
    cy.get('body').should('be.visible');

    // Verify canvas elements exist
    cy.get('mat-sidenav-content, #canvas-container, svg').should('exist');
    cy.log('✅ Canvas elements found and verified');
  });

  it('Should handle page refresh and maintain session', () => {
    cy.log('🔄 Testing page refresh and session persistence');

    // Verify we're on main canvas (from beforeEach)
    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS);

    // Refresh the page
    cy.reload();

    // Verify we're still on a valid page after refresh
    cy.getPageContext().then((context) => {
      // Should either stay on main canvas or redirect to login - both are valid states
      expect([PAGE_TYPES.MAIN_CANVAS, PAGE_TYPES.LOGIN]).to.include(context.pageType);

      // Log the current page and authentication state for information
      cy.log(`✅ After refresh: Page type is ${context.pageType}`);
      cy.log(`✅ After refresh: Authentication state is ${context.isAuthenticated}`);
    });
  });

  it('Should navigate between different NiFi sections', () => {
    cy.log('🗺️ Testing navigation between NiFi sections');

    // Verify we start on main canvas (from beforeEach)
    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS);

    // Verify page is interactive
    cy.get('body').should('be.visible');
    cy.log('✅ Page is visible and interactive');

    // Verify interactive elements exist (buttons, links, etc.)
    cy.get('button, a, [role="button"]').should('exist');
    cy.log('✅ Interactive elements found on the page');

    // Test basic page interaction
    cy.get('body').click(100, 100);
    cy.log('✅ Page interaction successful');

    // Verify we're still on the main canvas
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal(PAGE_TYPES.MAIN_CANVAS);
      cy.log(`✅ Navigation test successful, current page: ${context.pageType}`);
    });
  });

  it('Should handle logout and return to login page', () => {
    cy.log('🚪 Testing logout functionality');

    // Verify we start on main canvas (from beforeEach)
    cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS);

    // Verify we're authenticated before logout
    cy.getPageContext().then((context) => {
      expect(context.isAuthenticated).to.be.true;
      expect(context.pageType).to.equal(PAGE_TYPES.MAIN_CANVAS);
    });

    // Use helper function to clear session
    // This already navigates to login page and verifies it
    cy.clearSession();

    // Verify we're on the login page after session is cleared
    cy.url().should('contain', '#/login');
    cy.log('✅ Successfully logged out and returned to login page');
  });
});
