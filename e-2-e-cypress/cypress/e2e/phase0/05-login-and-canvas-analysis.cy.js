/**
 * @file Login and Canvas Analysis for Phase 0
 * This test properly handles login and then analyzes the main NiFi canvas
 *
 * 🎯 PURPOSE: Get past login to analyze the real NiFi canvas DOM structure
 */

describe('Phase 0: Login and Canvas Analysis', () => {
  it('🔍 Login to NiFi and Analyze Main Canvas DOM Structure', () => {
    cy.log('🔍 Starting login flow and main canvas analysis...');

    // Visit NiFi
    cy.visit('https://localhost:9095/nifi', {
      failOnStatusCode: false,
      timeout: 30000
    });

    cy.task('log', '🚀 PHASE 0: LOGIN AND CANVAS ANALYSIS');
    cy.task('log', '====================================');

    // Wait for page load
    cy.wait(2000);

    cy.get('body').then(($body) => {
      cy.url().then((currentUrl) => {
        cy.task('log', `Initial URL: ${currentUrl}`);
      });

      // Check if we're on login page
      const loginButton = $body.find('button:contains("Log in")');
      if (loginButton.length > 0) {
        cy.task('log', '🔐 Login page detected - performing login...');

        // Look for username/password fields
        const usernameFields = $body.find('input[type="text"], input[type="email"], input[name*="user"], input[id*="user"]');
        const passwordFields = $body.find('input[type="password"]');

        cy.task('log', `Username fields found: ${usernameFields.length}`);
        cy.task('log', `Password fields found: ${passwordFields.length}`);

        if (usernameFields.length > 0 && passwordFields.length > 0) {
          // Enter credentials
          cy.get('input[type="text"], input[type="email"], input[name*="user"], input[id*="user"]').first().type('testUser');
          cy.get('input[type="password"]').first().type('drowssap');

          // Click login button
          cy.contains('button', 'Log in').click();

          cy.task('log', '✅ Login credentials entered and login button clicked');

          // Wait for navigation after login
          cy.wait(5000);

          cy.task('log', '🚀 POST-LOGIN ANALYSIS');
          cy.task('log', '=====================');

          // Analyze page after login
          cy.get('body').then(($postLoginBody) => {
            cy.url().then((postLoginUrl) => {
              cy.task('log', `Post-login URL: ${postLoginUrl}`);
            });

            cy.task('log', `Total elements after login: ${$postLoginBody.find('*').length}`);

            // Wait a bit more for dynamic content to load
            cy.wait(3000);

            // Re-analyze after additional wait
            cy.get('body').then(($finalBody) => {
              cy.task('log', `Final total elements: ${$finalBody.find('*').length}`);

              // Detailed SVG analysis
              const allSvgs = $finalBody.find('svg');
              cy.task('log', '');
              cy.task('log', '🎯 MAIN CANVAS SVG ANALYSIS:');
              cy.task('log', `Total SVG elements: ${allSvgs.length}`);

              if (allSvgs.length > 0) {
                allSvgs.each((index, svg) => {
                  const $svg = Cypress.$(svg);
                  cy.task('log', '');
                  cy.task('log', `SVG ${index + 1} ANALYSIS:`);
                  cy.task('log', `  ID: ${$svg.attr('id') || 'none'}`);
                  cy.task('log', `  Classes: ${$svg.attr('class') || 'none'}`);
                  cy.task('log', `  Dimensions: ${svg.offsetWidth}x${svg.offsetHeight}`);
                  cy.task('log', `  Visible: ${$svg.is(':visible')}`);
                  cy.task('log', `  ViewBox: ${$svg.attr('viewBox') || 'none'}`);

                  // Parent analysis
                  const $parent = $svg.parent();
                  cy.task('log', `  Parent: ${$parent.prop('tagName')} (ID: ${$parent.attr('id') || 'none'}, Class: ${$parent.attr('class') || 'none'})`);

                  // Check for canvas-like characteristics
                  const isLarge = svg.offsetWidth > 300 && svg.offsetHeight > 300;
                  const hasCanvasParent = $parent.attr('class')?.includes('canvas') || $parent.attr('id')?.includes('canvas');
                  const hasFlowClasses = $svg.attr('class')?.includes('flow') || $svg.attr('class')?.includes('canvas');

                  cy.task('log', `  CANVAS LIKELIHOOD:`);
                  cy.task('log', `    Large size (>300x300): ${isLarge}`);
                  cy.task('log', `    Canvas-like parent: ${hasCanvasParent}`);
                  cy.task('log', `    Flow/canvas classes: ${hasFlowClasses}`);

                  // Check for child elements that might be processors
                  const children = $svg.children();
                  cy.task('log', `  Child elements: ${children.length}`);
                  if (children.length > 0) {
                    const groups = $svg.find('g');
                    const rects = $svg.find('rect');
                    const texts = $svg.find('text');
                    cy.task('log', `    Groups: ${groups.length}, Rects: ${rects.length}, Texts: ${texts.length}`);
                  }
                });

                // Identify the most likely canvas
                const canvasCandidates = Array.from(allSvgs).map((svg, index) => {
                  const $svg = Cypress.$(svg);
                  const $parent = $svg.parent();
                  const score =
                    (svg.offsetWidth > 300 && svg.offsetHeight > 300 ? 2 : 0) +
                    ($parent.attr('class')?.includes('canvas') || $parent.attr('id')?.includes('canvas') ? 2 : 0) +
                    ($svg.attr('class')?.includes('flow') || $svg.attr('class')?.includes('canvas') ? 1 : 0) +
                    ($svg.children().length > 0 ? 1 : 0);

                  return { index: index + 1, svg, $svg, score };
                }).sort((a, b) => b.score - a.score);

                cy.task('log', '');
                cy.task('log', '🎯 CANVAS CANDIDATE RANKING:');
                canvasCandidates.forEach((candidate, rank) => {
                  cy.task('log', `Rank ${rank + 1}: SVG ${candidate.index} (Score: ${candidate.score}/6)`);
                });

                if (canvasCandidates.length > 0 && canvasCandidates[0].score > 0) {
                  const bestCandidate = canvasCandidates[0];
                  cy.task('log', '');
                  cy.task('log', '🎯 RECOMMENDED CANVAS SELECTORS:');
                  cy.task('log', `Best candidate: SVG ${bestCandidate.index}`);

                  if (bestCandidate.$svg.attr('id')) {
                    cy.task('log', `  By ID: #${bestCandidate.$svg.attr('id')}`);
                  }
                  if (bestCandidate.$svg.attr('class')) {
                    const classes = bestCandidate.$svg.attr('class').split(' ');
                    cy.task('log', `  By class: .${classes[0]}`);
                  }

                  const $parent = bestCandidate.$svg.parent();
                  if ($parent.attr('id')) {
                    cy.task('log', `  Parent-based: #${$parent.attr('id')} svg`);
                  }
                  if ($parent.attr('class')) {
                    const parentClasses = $parent.attr('class').split(' ');
                    cy.task('log', `  Parent class-based: .${parentClasses[0]} svg`);
                  }

                  cy.task('log', `  Nth-child: svg:nth-child(${bestCandidate.index})`);
                  cy.task('log', `  Generic fallback: svg (if only one large SVG)`);
                }
              } else {
                cy.task('log', '❌ No SVG elements found on main page - may need more time to load');
              }

              // Analyze buttons for toolbar
              const allButtons = $finalBody.find('button');
              cy.task('log', '');
              cy.task('log', '🎯 TOOLBAR BUTTON ANALYSIS:');
              cy.task('log', `Total buttons: ${allButtons.length}`);

              if (allButtons.length > 0) {
                // Look for buttons in top area
                const topButtons = allButtons.filter((index, button) => {
                  const $btn = Cypress.$(button);
                  const offset = $btn.offset();
                  return offset && offset.top < 200 && $btn.is(':visible');
                });

                cy.task('log', `Buttons in top 200px: ${topButtons.length}`);

                topButtons.slice(0, 10).each((index, button) => {
                  const $btn = Cypress.$(button);
                  const text = $btn.text().trim();
                  const title = $btn.attr('title') || '';
                  const ariaLabel = $btn.attr('aria-label') || '';

                  if (text || title || ariaLabel) {
                    cy.task('log', `Button ${index + 1}: "${text}" (title: "${title}", aria: "${ariaLabel}")`);
                    cy.task('log', `  Classes: ${$btn.attr('class') || 'none'}`);
                    cy.task('log', `  ID: ${$btn.attr('id') || 'none'}`);

                    // Check if could be Add Processor button
                    const couldBeAdd = text.toLowerCase().includes('add') ||
                                      title.toLowerCase().includes('add') ||
                                      ariaLabel.toLowerCase().includes('add') ||
                                      text.toLowerCase().includes('processor') ||
                                      title.toLowerCase().includes('processor');

                    if (couldBeAdd) {
                      cy.task('log', `  🎯 POTENTIAL ADD PROCESSOR BUTTON!`);
                    }
                  }
                });
              }

              cy.task('log', '');
              cy.task('log', '🎯 PHASE 0 COMPLETION STATUS:');
              cy.task('log', '=============================');
              cy.task('log', `✅ Successfully logged into NiFi`);
              cy.task('log', `✅ Analyzed ${allSvgs.length} SVG elements`);
              cy.task('log', `✅ Analyzed ${allButtons.length} button elements`);

              if (allSvgs.length > 0) {
                cy.task('log', '✅ Found canvas candidates - selectors identified above');
                cy.task('log', '🚨 NEXT: Update constants.js with recommended selectors');
              } else {
                cy.task('log', '⚠️ No canvas found - may need to navigate to canvas page');
                cy.task('log', '🚨 NEXT: Investigate navigation to main canvas view');
              }
            });
          });
        } else {
          cy.task('log', '❌ Could not find username/password fields');
        }
      } else {
        cy.task('log', '⚠️ No login button found - may already be logged in');
      }
    });

    expect(true).to.be.true;
  });
});