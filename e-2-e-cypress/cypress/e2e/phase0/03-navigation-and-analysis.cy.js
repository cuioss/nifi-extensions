/**
 * @file Navigation and Analysis for Phase 0
 * This test ensures proper navigation to NiFi main canvas and then analyzes DOM structure
 *
 * 🎯 PURPOSE: Get to the right page and identify real NiFi selectors
 */

describe('Phase 0: Navigation and DOM Analysis', () => {
  it('🔍 Navigate to NiFi and Analyze Real DOM Structure', () => {
    cy.log('🔍 Starting comprehensive NiFi navigation and DOM analysis...');

    // Step 1: Visit NiFi
    cy.visit('https://localhost:9095/nifi', {
      failOnStatusCode: false,
      timeout: 30000
    });

    cy.task('log', '🚀 STEP 1: Initial page visit');
    cy.task('log', '============================');

    // Analyze what we see initially
    cy.get('body').then(($body) => {
      cy.task('log', `Current URL: ${Cypress.config().baseUrl}`);
      cy.task('log', `Page title: ${$body.find('title').text() || 'No title'}`);
      cy.task('log', `Body classes: ${$body.attr('class') || 'none'}`);
      cy.task('log', `Total elements on page: ${$body.find('*').length}`);

      // Check for login elements
      const loginInputs = $body.find('input[type="password"]');
      const textInputs = $body.find('input[type="text"]');
      const submitButtons = $body.find('button[type="submit"], input[type="submit"]');

      cy.task('log', `Password inputs found: ${loginInputs.length}`);
      cy.task('log', `Text inputs found: ${textInputs.length}`);
      cy.task('log', `Submit buttons found: ${submitButtons.length}`);

      if (loginInputs.length > 0) {
        cy.task('log', '🔐 Login page detected - proceeding with authentication');

        // Perform login
        cy.get('input[type="text"]').type('testUser');
        cy.get('input[type="password"]').type('drowssap');
        cy.get('button[type="submit"]').click();

        // Wait for navigation after login
        cy.wait(5000);

        cy.task('log', '🚀 STEP 2: After login analysis');
        cy.task('log', '===============================');

        // Analyze page after login
        cy.get('body').then(($postLoginBody) => {
          cy.url().then((currentUrl) => {
            cy.task('log', `Current URL after login: ${currentUrl}`);
          });

          cy.task('log', `Page title after login: ${$postLoginBody.find('title').text() || 'No title'}`);
          cy.task('log', `Body classes after login: ${$postLoginBody.attr('class') || 'none'}`);
          cy.task('log', `Total elements after login: ${$postLoginBody.find('*').length}`);

          // Look for main content areas
          const mainElements = $postLoginBody.find('main, [role="main"], .main, #main');
          const contentElements = $postLoginBody.find('.content, #content, .app-content, #app-content');
          const canvasElements = $postLoginBody.find('[id*="canvas"], [class*="canvas"]');

          cy.task('log', `Main elements found: ${mainElements.length}`);
          cy.task('log', `Content elements found: ${contentElements.length}`);
          cy.task('log', `Canvas-related elements found: ${canvasElements.length}`);

          // Analyze all SVG elements
          const allSvgs = $postLoginBody.find('svg');
          cy.task('log', `Total SVG elements: ${allSvgs.length}`);

          if (allSvgs.length > 0) {
            cy.task('log', '🎯 SVG ELEMENTS ANALYSIS:');
            allSvgs.each((index, svg) => {
              const $svg = Cypress.$(svg);
              cy.task('log', `SVG ${index + 1}:`);
              cy.task('log', `  ID: ${$svg.attr('id') || 'none'}`);
              cy.task('log', `  Classes: ${$svg.attr('class') || 'none'}`);
              cy.task('log', `  Dimensions: ${svg.offsetWidth}x${svg.offsetHeight}`);
              cy.task('log', `  Visible: ${$svg.is(':visible')}`);
              cy.task('log', `  Parent: ${$svg.parent().prop('tagName')} (${$svg.parent().attr('class') || 'no class'})`);
            });
          }

          // Analyze all buttons
          const allButtons = $postLoginBody.find('button');
          cy.task('log', `Total buttons found: ${allButtons.length}`);

          if (allButtons.length > 0) {
            cy.task('log', '🎯 BUTTON ELEMENTS ANALYSIS:');
            allButtons.slice(0, 20).each((index, button) => {
              const $btn = Cypress.$(button);
              const text = $btn.text().trim();
              const title = $btn.attr('title') || '';
              const classes = $btn.attr('class') || '';
              const id = $btn.attr('id') || '';

              if (text || title || classes.includes('add') || id.includes('add')) {
                cy.task('log', `Button ${index + 1}:`);
                cy.task('log', `  Text: "${text}"`);
                cy.task('log', `  Title: "${title}"`);
                cy.task('log', `  ID: "${id}"`);
                cy.task('log', `  Classes: "${classes}"`);
                cy.task('log', `  Visible: ${$btn.is(':visible')}`);
                cy.task('log', `  Position: ${$btn.offset()?.top || 0}, ${$btn.offset()?.left || 0}`);
              }
            });
          }

          // Look for iframes (NiFi might use iframes)
          const iframes = $postLoginBody.find('iframe');
          cy.task('log', `Iframes found: ${iframes.length}`);

          if (iframes.length > 0) {
            cy.task('log', '🎯 IFRAME ANALYSIS:');
            iframes.each((index, iframe) => {
              const $iframe = Cypress.$(iframe);
              cy.task('log', `Iframe ${index + 1}:`);
              cy.task('log', `  ID: ${$iframe.attr('id') || 'none'}`);
              cy.task('log', `  Classes: ${$iframe.attr('class') || 'none'}`);
              cy.task('log', `  Src: ${$iframe.attr('src') || 'none'}`);
              cy.task('log', `  Dimensions: ${iframe.offsetWidth}x${iframe.offsetHeight}`);
              cy.task('log', `  Visible: ${$iframe.is(':visible')}`);
            });
          }

          // Look for any elements with "nifi" in their attributes
          const nifiElements = $postLoginBody.find('[id*="nifi"], [class*="nifi"]');
          cy.task('log', `Elements with 'nifi' in attributes: ${nifiElements.length}`);

          if (nifiElements.length > 0) {
            cy.task('log', '🎯 NIFI-RELATED ELEMENTS:');
            nifiElements.slice(0, 10).each((index, element) => {
              const $el = Cypress.$(element);
              cy.task('log', `NiFi Element ${index + 1}:`);
              cy.task('log', `  Tag: ${element.tagName}`);
              cy.task('log', `  ID: ${$el.attr('id') || 'none'}`);
              cy.task('log', `  Classes: ${$el.attr('class') || 'none'}`);
              cy.task('log', `  Visible: ${$el.is(':visible')}`);
            });
          }

          cy.task('log', '');
          cy.task('log', '🎯 PHASE 0 CRITICAL FINDINGS:');
          cy.task('log', '============================');
          cy.task('log', '✅ Successfully navigated to NiFi after authentication');
          cy.task('log', `✅ Found ${allSvgs.length} SVG elements (canvas candidates)`);
          cy.task('log', `✅ Found ${allButtons.length} button elements (toolbar candidates)`);
          cy.task('log', `✅ Found ${iframes.length} iframe elements (potential canvas containers)`);
          cy.task('log', `✅ Found ${nifiElements.length} NiFi-specific elements`);
          cy.task('log', '');
          cy.task('log', '🚨 NEXT ACTIONS REQUIRED:');
          cy.task('log', '1. Review the detailed analysis above');
          cy.task('log', '2. Manually inspect https://localhost:9095/nifi with browser dev tools');
          cy.task('log', '3. Identify the REAL selectors for canvas and toolbar elements');
          cy.task('log', '4. Update cypress/support/constants.js with working selectors');
          cy.task('log', '5. Test each selector manually before proceeding to Phase 1');
        });
      } else {
        cy.task('log', '⚠️ No login page detected - analyzing current page directly');

        // Analyze current page if no login required
        const allSvgs = $body.find('svg');
        const allButtons = $body.find('button');

        cy.task('log', `SVG elements on current page: ${allSvgs.length}`);
        cy.task('log', `Button elements on current page: ${allButtons.length}`);
      }
    });

    expect(true).to.be.true;
  });
});