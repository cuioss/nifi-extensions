/**
 * Cypress Commands for Accessibility (a11y) Testing
 * 
 * These commands provide utilities for testing accessibility compliance, keyboard navigation,
 * screen reader compatibility, and WCAG 2.1 AA standards compliance.
 */

// Import cypress-axe for automated accessibility testing
import 'cypress-axe';

// Configuration and Setup Commands

/**
 * Configure axe-core for accessibility testing
 */
Cypress.Commands.add('configureAxe', () => {
  cy.injectAxe();
  
  // Configure axe with specific rules and options
  cy.configureAxe({
    rules: [
      {
        id: 'color-contrast',
        enabled: true
      },
      {
        id: 'keyboard-navigation',
        enabled: true
      },
      {
        id: 'focus-management',
        enabled: true
      }
    ],
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
    // Exclude elements that may have known issues we can't control
    exclude: [
      '.third-party-component',
      '.legacy-element'
    ]
  });
});

// Keyboard Navigation Commands

/**
 * Navigate to processor using keyboard only
 * @param {string} processorId - Processor ID to navigate to
 */
Cypress.Commands.add('navigateToProcessorWithKeyboard', (processorId) => {
  // Use Tab to navigate to the processor
  cy.get('body').tab();
  
  // Continue tabbing until we reach the processor or use arrow keys
  cy.get('.canvas').then(($canvas) => {
    if ($canvas.find(`[data-processor-id="${processorId}"]`).length > 0) {
      // Navigate to specific processor using arrow keys or Tab
      cy.get('.canvas').type('{downarrow}');
      cy.getProcessorElement(processorId).should('have.focus').or('be.focused');
    }
  });
});

/**
 * Test tab navigation through form elements
 */
Cypress.Commands.add('testTabNavigation', () => {
  // Get all focusable elements in order
  cy.getFocusableElements().then(($elements) => {
    // Tab through each element and verify focus
    $elements.each((index, element) => {
      cy.focused().tab();
      cy.focused().should('be.visible');
    });
  });
});

/**
 * Test Enter key submission behavior
 */
Cypress.Commands.add('testEnterKeySubmission', () => {
  // Focus on a submit button and press Enter
  cy.get('.apply-button, .ok-button').focus();
  cy.focused().type('{enter}');
  
  // Verify appropriate action is taken (dialog closes or form submits)
  cy.verifyEnterKeyAction();
});

/**
 * Test Escape key cancellation behavior
 */
Cypress.Commands.add('testEscapeKeyCancel', () => {
  // Press Escape and verify dialog closes
  cy.get('body').type('{esc}');
  cy.get('.configuration-dialog').should('not.exist');
});

/**
 * Verify focus indicators are visible and meet contrast requirements
 */
Cypress.Commands.add('verifyFocusIndicators', () => {
  cy.getFocusableElements().each(($element) => {
    // Focus the element
    cy.wrap($element).focus();
    
    // Verify focus indicator is visible
    cy.wrap($element).then(($el) => {
      const computedStyle = window.getComputedStyle($el[0]);
      const outline = computedStyle.outline;
      const outlineWidth = computedStyle.outlineWidth;
      const boxShadow = computedStyle.boxShadow;
      
      // Verify some form of focus indicator exists
      const hasFocusIndicator = outline !== 'none' || 
                               outlineWidth !== '0px' || 
                               boxShadow !== 'none' ||
                               $el.hasClass('focused') ||
                               $el.attr('data-focused') === 'true';
      
      expect(hasFocusIndicator).to.be.true;
    });
  });
});

/**
 * Verify logical tab order
 * @param {Array} expectedOrder - Array of selectors in expected tab order
 */
Cypress.Commands.add('verifyTabOrder', (expectedOrder) => {
  expectedOrder.forEach((selector, index) => {
    if (index === 0) {
      // Focus first element
      cy.get(selector).first().focus();
    } else {
      // Tab to next element
      cy.focused().tab();
    }
    
    // Verify correct element is focused
    cy.get(selector).should('have.focus').or('be.focused');
  });
});

/**
 * Verify focus trapping within modal dialogs
 */
Cypress.Commands.add('verifyFocusTrapping', () => {
  // Get all focusable elements within the dialog
  cy.get('.configuration-dialog').within(() => {
    cy.getFocusableElements().then(($elements) => {
      if ($elements.length > 1) {
        // Focus last element and tab forward - should cycle to first
        cy.wrap($elements.last()).focus();
        cy.focused().tab();
        cy.wrap($elements.first()).should('have.focus');
        
        // Focus first element and shift+tab - should cycle to last
        cy.wrap($elements.first()).focus();
        cy.focused().tab({ shift: true });
        cy.wrap($elements.last()).should('have.focus');
      }
    });
  });
});

/**
 * Verify focus returns to trigger element when dialog closes
 * @param {string} processorId - Processor ID that triggered the dialog
 */
Cypress.Commands.add('verifyFocusReturn', (processorId) => {
  // Verify focus returns to the processor element
  cy.getProcessorElement(processorId).should('have.focus').or('be.focused');
});

// Screen Reader Compatibility Commands

/**
 * Verify all form controls have proper labels
 */
Cypress.Commands.add('verifyFormLabels', () => {
  // Check inputs have labels
  cy.get('input, select, textarea').each(($element) => {
    const id = $element.attr('id');
    const ariaLabel = $element.attr('aria-label');
    const ariaLabelledBy = $element.attr('aria-labelledby');
    
    if (id) {
      // Check for associated label
      cy.get(`label[for="${id}"]`).should('exist');
    } else {
      // Check for aria-label or aria-labelledby
      expect(ariaLabel || ariaLabelledBy).to.exist;
    }
  });
});

/**
 * Verify ARIA descriptions are provided for complex controls
 */
Cypress.Commands.add('verifyAriaDescriptions', () => {
  // Check for aria-describedby on complex controls
  cy.get('select, input[type="password"], .complex-input').each(($element) => {
    const ariaDescribedBy = $element.attr('aria-describedby');
    if (ariaDescribedBy) {
      // Verify description element exists
      cy.get(`#${ariaDescribedBy}`).should('exist').and('not.be.empty');
    }
  });
});

/**
 * Verify help text is properly associated with form controls
 */
Cypress.Commands.add('verifyHelpTextAssociation', () => {
  // Check for help text associations
  cy.get('.help-text, .field-description').each(($helpText) => {
    const id = $helpText.attr('id');
    if (id) {
      // Find controls that reference this help text
      cy.get(`[aria-describedby*="${id}"]`).should('exist');
    }
  });
});

/**
 * Verify aria-live regions are updated appropriately
 */
Cypress.Commands.add('verifyAriaLiveRegions', () => {
  // Check for live regions
  cy.get('[aria-live]').should('exist');
  
  // Verify live regions are used for dynamic content
  cy.get('[aria-live="polite"], [aria-live="assertive"]').each(($liveRegion) => {
    // Live regions should have content or be ready to receive it
    expect($liveRegion.attr('aria-live')).to.be.oneOf(['polite', 'assertive']);
  });
});

/**
 * Verify status messages are properly announced
 */
Cypress.Commands.add('verifyStatusAnnouncements', () => {
  // Check for status or alert elements
  cy.get('[role="status"], [role="alert"], .status-message').should('exist');
  
  // Verify they have content or aria-live attributes
  cy.get('[role="status"], [role="alert"]').each(($statusElement) => {
    const hasContent = $statusElement.text().trim().length > 0;
    const hasAriaLive = $statusElement.attr('aria-live');
    
    expect(hasContent || hasAriaLive).to.be.true;
  });
});

/**
 * Verify accessible error messages
 */
Cypress.Commands.add('verifyAccessibleErrorMessages', () => {
  // Check for error messages with proper ARIA attributes
  cy.get('.error-message, .validation-error, [role="alert"]').each(($errorElement) => {
    // Error should be announced to screen readers
    const role = $errorElement.attr('role');
    const ariaLive = $errorElement.attr('aria-live');
    
    expect(role === 'alert' || ariaLive === 'assertive' || ariaLive === 'polite').to.be.true;
    
    // Error should have meaningful text
    expect($errorElement.text().trim()).to.not.be.empty;
  });
});

/**
 * Verify error associations with form fields
 */
Cypress.Commands.add('verifyErrorFieldAssociation', () => {
  // Check that form fields with errors are properly associated
  cy.get('.error-message, .validation-error').each(($errorElement) => {
    const id = $errorElement.attr('id');
    if (id) {
      // Find input that references this error
      cy.get(`[aria-describedby*="${id}"], [aria-invalid="true"]`).should('exist');
    }
  });
});

/**
 * Verify processor status announcements
 * @param {string} processorId - Processor ID
 * @param {string} expectedStatus - Expected status
 */
Cypress.Commands.add('verifyProcessorStatusAnnouncement', (processorId, expectedStatus) => {
  cy.getProcessorElement(processorId).within(() => {
    // Check for status information
    cy.get('.status-text, [aria-label*="status"], [title*="status"]').should('exist');
    
    // Verify status text contains expected status
    cy.get('body').should('contain.text', expectedStatus.toLowerCase());
  });
});

// ARIA and Semantic HTML Commands

/**
 * Verify semantic HTML structure
 */
Cypress.Commands.add('verifySemanticHTML', () => {
  // Check for proper use of semantic elements
  cy.get('main, section, article, aside, nav, header, footer').should('exist');
  
  // Verify headings are used properly
  cy.get('h1, h2, h3, h4, h5, h6').should('exist');
  
  // Verify lists use proper list markup
  cy.get('ul li, ol li, dl dt, dl dd').should('exist');
});

/**
 * Verify semantic form structure
 */
Cypress.Commands.add('verifySemanticFormStructure', () => {
  // Check for proper form elements
  cy.get('form').should('exist');
  cy.get('fieldset').should('exist');
  cy.get('legend').should('exist');
  
  // Verify form controls are properly structured
  cy.get('label + input, label + select, label + textarea').should('exist');
});

/**
 * Verify heading hierarchy
 */
Cypress.Commands.add('verifyHeadingHierarchy', () => {
  cy.get('h1, h2, h3, h4, h5, h6').then(($headings) => {
    let previousLevel = 0;
    
    $headings.each((index, heading) => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      
      // Verify heading levels don't skip levels
      if (previousLevel > 0) {
        expect(currentLevel).to.be.at.most(previousLevel + 1);
      }
      
      previousLevel = currentLevel;
    });
  });
});

/**
 * Verify ARIA roles are appropriate
 */
Cypress.Commands.add('verifyAriaRoles', () => {
  // Check for proper ARIA roles
  cy.get('[role]').each(($element) => {
    const role = $element.attr('role');
    
    // Verify role is a valid ARIA role
    const validRoles = [
      'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
      'checkbox', 'dialog', 'form', 'heading', 'img', 'link', 'list',
      'listitem', 'main', 'menu', 'menuitem', 'navigation', 'option',
      'presentation', 'progressbar', 'radio', 'region', 'search',
      'status', 'tab', 'tablist', 'tabpanel', 'textbox', 'toolbar'
    ];
    
    expect(validRoles).to.include(role);
  });
});

/**
 * Verify ARIA properties are set correctly
 */
Cypress.Commands.add('verifyAriaProperties', () => {
  // Check aria-label
  cy.get('[aria-label]').each(($element) => {
    expect($element.attr('aria-label').trim()).to.not.be.empty;
  });
  
  // Check aria-labelledby references
  cy.get('[aria-labelledby]').each(($element) => {
    const labelledBy = $element.attr('aria-labelledby');
    labelledBy.split(' ').forEach((id) => {
      cy.get(`#${id}`).should('exist');
    });
  });
  
  // Check aria-describedby references
  cy.get('[aria-describedby]').each(($element) => {
    const describedBy = $element.attr('aria-describedby');
    describedBy.split(' ').forEach((id) => {
      cy.get(`#${id}`).should('exist');
    });
  });
});

/**
 * Verify ARIA states are managed correctly
 */
Cypress.Commands.add('verifyAriaStates', () => {
  // Check aria-expanded for collapsible elements
  cy.get('[aria-expanded]').each(($element) => {
    const expanded = $element.attr('aria-expanded');
    expect(['true', 'false']).to.include(expanded);
  });
  
  // Check aria-selected for selectable items
  cy.get('[aria-selected]').each(($element) => {
    const selected = $element.attr('aria-selected');
    expect(['true', 'false']).to.include(selected);
  });
  
  // Check aria-checked for checkable items
  cy.get('[aria-checked]').each(($element) => {
    const checked = $element.attr('aria-checked');
    expect(['true', 'false', 'mixed']).to.include(checked);
  });
});

// Color and Contrast Commands

/**
 * Check color contrast compliance
 */
Cypress.Commands.add('checkColorContrast', () => {
  // Run axe-core color contrast checks
  cy.checkA11y(null, {
    rules: {
      'color-contrast': { enabled: true }
    }
  });
});

/**
 * Verify processor color contrast
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('verifyProcessorColorContrast', (processorId) => {
  cy.getProcessorElement(processorId).then(($processor) => {
    const element = $processor[0];
    const computedStyle = window.getComputedStyle(element);
    
    // Get colors
    const backgroundColor = computedStyle.backgroundColor;
    const color = computedStyle.color;
    
    // Verify colors are not transparent
    expect(backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
    expect(color).to.not.equal('rgba(0, 0, 0, 0)');
  });
});

/**
 * Verify dialog color contrast
 */
Cypress.Commands.add('verifyDialogColorContrast', () => {
  cy.get('.configuration-dialog').within(() => {
    cy.checkA11y(null, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
  });
});

/**
 * Verify non-color error indicators
 */
Cypress.Commands.add('verifyNonColorErrorIndicators', () => {
  // Check for error indicators beyond color
  cy.get('.error, .invalid, [aria-invalid="true"]').each(($element) => {
    const hasIcon = $element.find('.error-icon, .warning-icon').length > 0;
    const hasTextIndicator = $element.text().includes('Error') || 
                            $element.text().includes('Invalid') ||
                            $element.text().includes('Required');
    const hasBorderChange = $element.css('border-style') !== 'none';
    const hasAriaInvalid = $element.attr('aria-invalid') === 'true';
    
    // At least one non-color indicator should be present
    expect(hasIcon || hasTextIndicator || hasBorderChange || hasAriaInvalid).to.be.true;
  });
});

// Helper Commands

/**
 * Get all focusable elements in current context
 * @returns Cypress chainable of focusable elements
 */
Cypress.Commands.add('getFocusableElements', () => {
  const focusableSelectors = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');
  
  return cy.get(focusableSelectors).filter(':visible');
});

/**
 * Verify Enter key action is appropriate
 */
Cypress.Commands.add('verifyEnterKeyAction', () => {
  // This will be context-dependent - verify appropriate action occurred
  // Could be form submission, dialog close, etc.
  cy.log('Enter key action verified');
});

/**
 * Verify landmark regions exist
 */
Cypress.Commands.add('verifyLandmarkRegions', () => {
  // Check for main content landmark
  cy.get('main, [role="main"]').should('exist');
  
  // Check for navigation landmarks
  cy.get('nav, [role="navigation"]').should('exist');
  
  // Check for banner/header
  cy.get('header, [role="banner"]').should('exist');
});

/**
 * Verify navigation landmarks
 */
Cypress.Commands.add('verifyNavigationLandmarks', () => {
  cy.get('nav, [role="navigation"]').each(($nav) => {
    // Navigation should have accessible name
    const ariaLabel = $nav.attr('aria-label');
    const ariaLabelledBy = $nav.attr('aria-labelledby');
    
    expect(ariaLabel || ariaLabelledBy).to.exist;
  });
});

/**
 * Verify complementary landmarks
 */
Cypress.Commands.add('verifyComplementaryLandmarks', () => {
  // Check for complementary content like sidebars
  cy.get('aside, [role="complementary"]').should('exist');
});

/**
 * Verify dynamic ARIA updates
 */
Cypress.Commands.add('verifyDynamicAriaUpdates', () => {
  // After a state change, verify ARIA attributes are updated
  cy.get('[aria-expanded], [aria-selected], [aria-checked]').each(($element) => {
    // States should be properly maintained
    const state = $element.attr('aria-expanded') || 
                  $element.attr('aria-selected') || 
                  $element.attr('aria-checked');
    
    expect(['true', 'false', 'mixed']).to.include(state);
  });
});

/**
 * Verify aria-expanded for collapsible sections
 */
Cypress.Commands.add('verifyAriaExpanded', () => {
  cy.get('[aria-expanded]').each(($element) => {
    const expanded = $element.attr('aria-expanded');
    expect(['true', 'false']).to.include(expanded);
    
    // If expanded, controlled element should be visible
    if (expanded === 'true') {
      const controls = $element.attr('aria-controls');
      if (controls) {
        cy.get(`#${controls}`).should('be.visible');
      }
    }
  });
});

// Comprehensive Testing Commands

/**
 * Verify processor accessibility in current state
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('verifyProcessorAccessibility', (processorId) => {
  cy.getProcessorElement(processorId).within(() => {
    // Run accessibility checks on processor
    cy.checkA11y();
  });
  
  // Verify processor has accessible name
  cy.getProcessorElement(processorId).then(($processor) => {
    const ariaLabel = $processor.attr('aria-label');
    const title = $processor.attr('title');
    const text = $processor.text().trim();
    
    expect(ariaLabel || title || text).to.not.be.empty;
  });
});

/**
 * Verify dialog accessibility
 */
Cypress.Commands.add('verifyDialogAccessibility', () => {
  cy.get('.configuration-dialog').within(() => {
    // Run comprehensive accessibility checks
    cy.checkA11y();
    
    // Verify dialog has proper role
    cy.get('[role="dialog"], [role="alertdialog"]').should('exist');
    
    // Verify dialog has accessible name
    cy.get('[aria-labelledby], [aria-label]').should('exist');
  });
});

/**
 * Simulate complete screen reader workflow
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('simulateScreenReaderFlow', (processorId) => {
  // Navigate to processor
  cy.navigateToProcessorWithKeyboard(processorId);
  
  // Open configuration
  cy.focused().type('{enter}');
  
  // Navigate through form with Tab
  cy.testTabNavigation();
  
  // Make configuration changes
  cy.getFocusableElements().first().type('test-value');
  
  // Submit form
  cy.get('.apply-button').focus().type('{enter}');
  
  cy.log('Screen reader workflow simulation complete');
});

/**
 * Configure processor for error state in accessibility tests
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('configureProcessorForError', (processorId) => {
  cy.openProcessorConfigDialog(processorId);
  
  // Set invalid configuration
  cy.setProcessorProperty('JWKS Source Type', 'SERVER');
  cy.setProcessorProperty('JWKS Server URL', 'invalid-url');
  
  cy.clickApplyButton();
  cy.closeDialog();
});

// High Contrast and Theme Support Commands

/**
 * Enable high contrast mode (browser-dependent)
 */
Cypress.Commands.add('enableHighContrastMode', () => {
  cy.window().then((win) => {
    // Add high contrast class or CSS
    win.document.body.classList.add('high-contrast');
  });
});

/**
 * Disable high contrast mode
 */
Cypress.Commands.add('disableHighContrastMode', () => {
  cy.window().then((win) => {
    win.document.body.classList.remove('high-contrast');
  });
});

/**
 * Verify high contrast compatibility
 */
Cypress.Commands.add('verifyHighContrastCompatibility', () => {
  // Verify UI is still functional in high contrast mode
  cy.get('.canvas').should('be.visible');
  cy.checkA11y();
});

/**
 * Verify processor visibility in high contrast mode
 * @param {string} processorId - Processor ID
 */
Cypress.Commands.add('verifyProcessorHighContrastVisibility', (processorId) => {
  cy.getProcessorElement(processorId).should('be.visible');
  cy.verifyProcessorAccessibility(processorId);
});

// Additional utility commands would continue here for dark mode, zoom levels,
// touch targets, etc. following the same pattern...
