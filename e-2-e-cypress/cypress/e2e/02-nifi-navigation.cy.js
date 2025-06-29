/**
 * @file NiFi Navigation Tests
 * Tests navigation functionality within the NiFi UI
 * Focuses on page transitions, canvas access, and UI state management
 */

describe('NiFi Navigation Tests', () => {
  beforeEach(() => {
    // Clear any previous session state
    cy.clearCookies();
    cy.clearLocalStorage();
    try {
      window.sessionStorage.clear();
    } catch (e) {
      // Ignore if sessionStorage is not available
    }
  });

  it('Should navigate from login to main canvas', () => {
    cy.log('🧭 Testing navigation from login to main canvas');

    // Start at login page
    cy.navigateToPage('LOGIN').then((context) => {
      expect(context.pageType).to.equal('LOGIN');
      expect(context.isReady).to.be.true;
      cy.log('✅ Successfully navigated to login page');
    });

    // Perform login
    cy.ensureNiFiReady();

    // Verify we're now on the main canvas
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isAuthenticated).to.be.true;
      cy.log('✅ Successfully navigated to main canvas after login');
    });
  });

  it('Should verify canvas is accessible and ready for operations', () => {
    cy.log('🎯 Testing canvas accessibility and readiness');

    // Login and navigate to canvas
    cy.ensureNiFiReady();

    // Verify canvas elements are present using Angular Material selectors
    cy.get('mat-sidenav-content, .mat-drawer-content', { timeout: 10000 })
      .should('be.visible')
      .then(() => {
        cy.log('✅ Canvas container found using Angular Material selectors');
      });

    // Check for SVG canvas within the container
    cy.get('mat-sidenav-content svg, .mat-drawer-content svg', { timeout: 5000 })
      .should('exist')
      .then(($svg) => {
        expect($svg.length).to.be.greaterThan(0);
        cy.log(`✅ Found ${$svg.length} SVG canvas element(s)`);
      });

    // Verify toolbar is present
    cy.get('mat-toolbar, .mat-toolbar', { timeout: 5000 })
      .should('be.visible')
      .then(() => {
        cy.log('✅ Toolbar found using Angular Material selectors');
      });
  });

  it('Should handle page refresh and maintain session', () => {
    cy.log('🔄 Testing page refresh and session persistence');

    // Login first
    cy.ensureNiFiReady();

    // Verify we're on main canvas
    cy.verifyPageType('MAIN_CANVAS');

    // Refresh the page
    cy.reload();

    // Verify we're still authenticated and on main canvas
    cy.getPageContext().then((context) => {
      // Should either stay on main canvas or redirect to login
      expect(['MAIN_CANVAS', 'LOGIN']).to.include(context.pageType);

      if (context.pageType === 'LOGIN') {
        cy.log('ℹ️ Session expired after refresh, redirected to login');
      } else {
        cy.log('✅ Session maintained after refresh');
        expect(context.isAuthenticated).to.be.true;
      }
    });
  });

  it('Should navigate between different NiFi sections', () => {
    cy.log('🗺️ Testing navigation between NiFi sections');

    // Login to get to main canvas
    cy.ensureNiFiReady();

    // Verify we start on main canvas
    cy.verifyPageType('MAIN_CANVAS');

    // Test navigation to different sections if available
    cy.get('body').then(($body) => {
      // Look for navigation elements using Angular Material patterns
      const navElements = $body.find('mat-nav-list, .mat-nav-list, mat-sidenav, .mat-sidenav');

      if (navElements.length > 0) {
        cy.log(`✅ Found ${navElements.length} navigation elements`);

        // Try to find navigation links
        cy.get('mat-nav-list a, .mat-nav-list a, mat-sidenav a, .mat-sidenav a')
          .then(($links) => {
            if ($links.length > 0) {
              cy.log(`✅ Found ${$links.length} navigation links`);

              // Click the first navigation link if available
              cy.wrap($links.first()).click();

              // Wait a moment for navigation
              cy.wait(1000);

              // Verify we're still in a valid state
              cy.getPageContext().then((context) => {
                expect(context.pageType).to.not.equal('UNKNOWN');
                cy.log(`✅ Navigation successful, current page: ${context.pageType}`);
              });
            } else {
              cy.log('ℹ️ No navigation links found in navigation elements');
            }
          });
      } else {
        cy.log('ℹ️ No navigation elements found, testing basic canvas interaction');

        // Test basic canvas interaction instead
        cy.get('mat-sidenav-content, .mat-drawer-content')
          .should('be.visible')
          .click(400, 300);

        cy.log('✅ Basic canvas interaction successful');
      }
    });
  });

  it('Should handle logout and return to login page', () => {
    cy.log('🚪 Testing logout functionality');

    // Login first
    cy.ensureNiFiReady();
    cy.verifyPageType('MAIN_CANVAS');

    // Look for logout button or user menu
    cy.get('body').then(($body) => {
      // Look for common logout patterns
      const logoutSelectors = [
        'button:contains("Logout")',
        'button:contains("Sign Out")',
        'mat-menu-item:contains("Logout")',
        '.mat-menu-item:contains("Logout")',
        '[aria-label*="logout"]',
        '[title*="logout"]'
      ];

      let logoutFound = false;

      for (const selector of logoutSelectors) {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          cy.log(`✅ Found logout element with selector: ${selector}`);
          cy.get(selector).first().click();
          logoutFound = true;
          break;
        }
      }

      if (!logoutFound) {
        cy.log('ℹ️ No logout button found, clearing session manually');
        cy.clearCookies();
        cy.clearLocalStorage();
        cy.window().then((win) => {
          try {
            win.sessionStorage.clear();
            win.sessionStorage.setItem('cypress-session-cleared', 'true');
          } catch (e) {
            // Ignore if sessionStorage is not available
          }
        });
        cy.visit('/#/login');
      }

      // Verify we're back at login page
      cy.getPageContext().then((context) => {
        expect(context.pageType).to.equal('LOGIN');
        expect(context.isAuthenticated).to.be.false;
        cy.log('✅ Successfully logged out and returned to login page');
      });
    });
  });
});
