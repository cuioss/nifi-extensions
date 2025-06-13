/**
 * Comprehensive NiFi UI Analysis Test
 * This test analyzes the NiFi 2.4.0 Angular UI to understand
 * how processor addition should work
 */

describe('NiFi UI Analysis for Processor Addition', () => {
  beforeEach(() => {
    cy.nifiLogin('admin', 'adminadminadmin');
  });

  it('should analyze UI structure for processor addition patterns', () => {
    cy.log('🔍 Analyzing NiFi UI for processor addition methods');

    cy.get('body').then(($body) => {
      const analysis = {
        buttons: [],
        menus: [],
        toolbars: [],
        canvas: [],
        dialogs: [],
        addButtons: [],
      };

      // Analyze buttons
      $body.find('button').each((index, element) => {
        const $btn = Cypress.$(element);
        const text = $btn.text().trim();
        const title = $btn.attr('title') || '';
        const ariaLabel = $btn.attr('aria-label') || '';
        const classes = $btn.attr('class') || '';

        if (text || title || ariaLabel) {
          analysis.buttons.push({
            text,
            title,
            ariaLabel,
            classes,
            isAddButton: /add|create|new|\+/i.test(text + title + ariaLabel),
          });
        }
      });

      // Look for potential "Add" buttons
      analysis.addButtons = analysis.buttons.filter((btn) => btn.isAddButton);

      // Analyze toolbars
      $body
        .find('[role="toolbar"], .toolbar, .mat-toolbar, .flow-toolbar')
        .each((index, element) => {
          const $toolbar = Cypress.$(element);
          const buttons = $toolbar.find('button').length;
          analysis.toolbars.push({
            classes: $toolbar.attr('class') || '',
            buttonCount: buttons,
            hasAddButton: $toolbar
              .find('button')
              .toArray()
              .some((btn) =>
                /add|create|new|\+/i.test(Cypress.$(btn).text() + Cypress.$(btn).attr('title'))
              ),
          });
        });

      // Analyze canvas elements
      $body.find('svg, canvas').each((index, element) => {
        const $canvas = Cypress.$(element);
        analysis.canvas.push({
          tagName: element.tagName,
          classes: $canvas.attr('class') || '',
          id: $canvas.attr('id') || '',
          width: $canvas.width(),
          height: $canvas.height(),
        });
      });

      // Look for existing dialogs
      $body.find('[role="dialog"], .mat-dialog-container, .dialog').each((index, element) => {
        const $dialog = Cypress.$(element);
        analysis.dialogs.push({
          classes: $dialog.attr('class') || '',
          visible: $dialog.is(':visible'),
          hasProcessorContent: $dialog.text().toLowerCase().includes('processor'),
        });
      });

      // Log comprehensive analysis
      cy.log('📊 UI Analysis Results:');
      cy.log(`Total buttons: ${analysis.buttons.length}`);
      cy.log(`Add-like buttons: ${analysis.addButtons.length}`);
      cy.log(`Toolbars: ${analysis.toolbars.length}`);
      cy.log(`Canvas elements: ${analysis.canvas.length}`);
      cy.log(`Existing dialogs: ${analysis.dialogs.length}`);

      // Log potential add buttons
      if (analysis.addButtons.length > 0) {
        cy.log('🎯 Potential Add Buttons Found:');
        analysis.addButtons.forEach((btn, index) => {
          cy.log(
            `  ${index + 1}. Text: "${btn.text}", Title: "${btn.title}", Aria: "${btn.ariaLabel}"`
          );
        });
      }

      // Log toolbars with add buttons
      const addToolbars = analysis.toolbars.filter((t) => t.hasAddButton);
      if (addToolbars.length > 0) {
        cy.log('🔧 Toolbars with Add Buttons:');
        addToolbars.forEach((toolbar, index) => {
          cy.log(`  ${index + 1}. Classes: "${toolbar.classes}", Buttons: ${toolbar.buttonCount}`);
        });
      }

      // Log canvas elements
      if (analysis.canvas.length > 0) {
        cy.log('🎨 Canvas Elements Found:');
        analysis.canvas.forEach((canvas, index) => {
          cy.log(
            `  ${index + 1}. ${canvas.tagName}, Classes: "${canvas.classes}", Size: ${canvas.width}x${canvas.height}`
          );
        });
      }

      // Save analysis to file for further reference
      cy.writeFile('cypress/temp/ui-analysis.json', analysis);
    });
  });

  it('should test actual button interactions', () => {
    cy.log('🔄 Testing button interactions to find processor addition');

    cy.get('body').then(($body) => {
      // Find potential add buttons and test them
      const potentialAddButtons = $body.find('button').filter((index, element) => {
        const $btn = Cypress.$(element);
        const text = $btn.text().trim();
        const title = $btn.attr('title') || '';
        const ariaLabel = $btn.attr('aria-label') || '';

        return /add|create|new|\+/i.test(text + title + ariaLabel);
      });

      cy.log(`Found ${potentialAddButtons.length} potential add buttons to test`);

      if (potentialAddButtons.length > 0) {
        // Test each potential add button
        potentialAddButtons.each((index, button) => {
          const $btn = Cypress.$(button);
          const buttonText = $btn.text().trim();
          const buttonTitle = $btn.attr('title') || '';

          cy.log(`Testing button ${index + 1}: "${buttonText}" (title: "${buttonTitle}")`);

          // Click the button and see what happens
          cy.wrap($btn).click({ force: true });

          // Wait a moment for any dialog to appear
          cy.wait(500);

          // Check if a dialog appeared
          cy.get('body').then(($checkBody) => {
            const dialogs = $checkBody.find('[role="dialog"], .mat-dialog-container, .dialog');
            if (dialogs.length > 0) {
              cy.log(`✅ Button "${buttonText}" opened a dialog!`);

              // Check if the dialog contains processor-related content
              const dialogText = dialogs.text().toLowerCase();
              if (dialogText.includes('processor') || dialogText.includes('component')) {
                cy.log(`🎯 This might be the processor addition dialog!`);

                // Take a screenshot for analysis
                cy.screenshot(`processor-dialog-${index}`);

                // Try to close the dialog
                cy.get('button')
                  .contains(/cancel|close|×/i)
                  .first()
                  .click({ force: true });
              } else {
                // Close other dialogs
                cy.get('button')
                  .contains(/cancel|close|×/i)
                  .first()
                  .click({ force: true });
              }
            } else {
              cy.log(`❌ Button "${buttonText}" did not open a dialog`);
            }
          });
        });
      } else {
        cy.log('⚠️ No potential add buttons found in the UI');
      }
    });
  });

  it('should test right-click context menu', () => {
    cy.log('🖱️ Testing right-click context menu for processor addition');

    // Try right-clicking on different elements
    const elementsToTest = ['svg', 'canvas', '[role="main"]', 'nifi'];

    elementsToTest.forEach((selector) => {
      cy.get('body').then(($body) => {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          cy.log(`Right-clicking on ${selector}`);
          cy.get(selector).first().rightclick({ force: true });

          cy.wait(500);

          // Check for context menu
          cy.get('body').then(($contextBody) => {
            const contextMenus = $contextBody.find('.context-menu, .mat-menu-panel, [role="menu"]');
            if (contextMenus.length > 0) {
              cy.log(`✅ Right-click on ${selector} opened a context menu`);
              cy.screenshot(`context-menu-${selector.replace(/[\[\]]/g, '')}`);

              // Check for processor-related options
              const menuText = contextMenus.text().toLowerCase();
              if (
                menuText.includes('processor') ||
                menuText.includes('add') ||
                menuText.includes('component')
              ) {
                cy.log(`🎯 Context menu contains processor-related options!`);
              }

              // Close menu by clicking elsewhere
              cy.get('body').click(10, 10);
            } else {
              cy.log(`❌ Right-click on ${selector} did not open a context menu`);
            }
          });
        }
      });
    });
  });
});
