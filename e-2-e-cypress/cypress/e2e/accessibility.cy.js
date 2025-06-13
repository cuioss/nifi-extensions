/**
 * End-to-End Tests for Accessibility (a11y) - Phase 5.4
 *
 * This test suite validates the accessibility of the MultiIssuerJWTTokenAuthenticator UI,
 * ensuring compliance with WCAG 2.1 AA standards and proper screen reader support.
 *
 * Test Categories:
 * 1. Keyboard Navigation and Focus Management
 * 2. Screen Reader Compatibility
 * 3. ARIA Attributes and Semantic HTML
 * 4. Color and Contrast Compliance
 * 5. Responsive Design Accessibility
 * 6. Error Handling and User Feedback
 */

import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from '../support/constants.js';

/**
 * Accessibility Testing Scenarios
 * CUI Standards Compliant
 */

describe('Accessibility (a11y) Tests', () => {
  let processorId;

  beforeEach(() => {
    // Configure accessibility testing
    cy.configureAxe();

    // Start with a clean session
    cy.clearAllSessionStorage();
    cy.clearAllLocalStorage();
    cy.clearCookies();

    // Login and navigate to canvas
    cy.loginToNiFi();
    cy.navigateToCanvas();

    // Add processor for accessibility testing
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((id) => {
      processorId = id;
    });
  });

  afterEach(() => {
    // Clean up processor after each test
    if (processorId) {
      cy.removeProcessor(processorId);
    }
  });

  describe('Keyboard Navigation and Focus Management', () => {
    it('should support full keyboard navigation on canvas', () => {
      // Test canvas keyboard navigation
      cy.get('.canvas').focus();

      // Navigate to processor using keyboard
      cy.navigateToProcessorWithKeyboard(processorId);

      // Verify processor is focused
      cy.getProcessorElement(processorId)
        .should('have.focus')
        .or('have.class', 'focused')
        .or('have.attr', 'aria-selected', 'true');
    });

    it('should support keyboard navigation in configuration dialog', () => {
      // Open configuration dialog
      cy.openProcessorConfigDialog(processorId);

      // Test tab navigation through form elements
      cy.testTabNavigation();

      // Test Enter key to submit
      cy.testEnterKeySubmission();

      // Test Escape key to cancel
      cy.testEscapeKeyCancel();

      cy.closeDialog();
    });

    it('should maintain focus visibility and proper tab order', () => {
      cy.openProcessorConfigDialog(processorId);

      // Verify focus indicators are visible
      cy.verifyFocusIndicators();

      // Test logical tab order
      cy.verifyTabOrder([
        'input[name="Name"]',
        'select[name="JWKS Source Type"]',
        'input[name="Token Audience"]',
        'input[name="Default Issuer"]',
        '.apply-button',
        '.cancel-button',
      ]);

      cy.closeDialog();
    });

    it('should handle modal dialog focus trapping', () => {
      cy.openProcessorConfigDialog(processorId);

      // Verify focus is trapped within dialog
      cy.verifyFocusTrapping();

      // Test that focus returns to trigger element when closed
      cy.closeDialog();
      cy.verifyFocusReturn(processorId);
    });

    it('should support keyboard shortcuts and hotkeys', () => {
      // Test processor-specific keyboard shortcuts
      cy.getProcessorElement(processorId).focus();

      // Test Space or Enter to configure
      cy.focused().type('{enter}');
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.BE_VISIBLE);

      // Test Escape to close
      cy.focused().type('{esc}');
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.NOT_EXIST);
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should provide proper labels and descriptions for all controls', () => {
      cy.openProcessorConfigDialog(processorId);

      // Verify all form controls have labels
      cy.verifyFormLabels();

      // Verify complex controls have descriptions
      cy.verifyAriaDescriptions();

      // Verify help text is properly associated
      cy.verifyHelpTextAssociation();

      cy.closeDialog();
    });

    it('should announce dynamic content changes', () => {
      cy.openProcessorConfigDialog(processorId);

      // Change a property that triggers validation
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SOURCE_TYPE, TEST_DATA.SERVER);

      // Verify aria-live regions are updated
      cy.verifyAriaLiveRegions();

      // Verify status messages are announced
      cy.verifyStatusAnnouncements();

      cy.closeDialog();
    });

    it('should provide meaningful error messages for screen readers', () => {
      cy.openProcessorConfigDialog(processorId);

      // Trigger validation errors
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SOURCE_TYPE, TEST_DATA.SERVER);
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SERVER_URL, TEST_DATA.INVALID_URL);
      cy.clickApplyButton();

      // Verify error messages are accessible
      cy.verifyAccessibleErrorMessages();

      // Verify error associations with form fields
      cy.verifyErrorFieldAssociation();

      cy.closeDialog();
    });

    it('should provide processor status information to screen readers', () => {
      // Verify processor state is announced
      cy.verifyProcessorStatusAnnouncement(processorId, TEST_DATA.STOPPED);

      // Start processor and verify status change
      cy.startProcessor(processorId);
      cy.verifyProcessorStatusAnnouncement(processorId, 'RUNNING');

      // Stop processor and verify status change
      cy.stopProcessor(processorId);
      cy.verifyProcessorStatusAnnouncement(processorId, TEST_DATA.STOPPED);
    });
  });

  describe('ARIA Attributes and Semantic HTML', () => {
    it('should use semantic HTML elements appropriately', () => {
      cy.openProcessorConfigDialog(processorId);

      // Verify proper semantic elements are used
      cy.verifySemanticHTML();

      // Verify form structure is semantic
      cy.verifySemanticFormStructure();

      // Verify headings hierarchy
      cy.verifyHeadingHierarchy();

      cy.closeDialog();
    });

    it('should implement ARIA attributes correctly', () => {
      cy.openProcessorConfigDialog(processorId);

      // Verify ARIA roles are appropriate
      cy.verifyAriaRoles();

      // Verify ARIA properties are set
      cy.verifyAriaProperties();

      // Verify ARIA states are managed
      cy.verifyAriaStates();

      cy.closeDialog();
    });

    it('should provide proper landmark regions', () => {
      // Verify main content areas are marked as landmarks
      cy.verifyLandmarkRegions();

      // Verify navigation landmarks
      cy.verifyNavigationLandmarks();

      // Verify complementary content landmarks
      cy.verifyComplementaryLandmarks();
    });

    it('should handle dynamic ARIA updates correctly', () => {
      cy.openProcessorConfigDialog(processorId);

      // Change configuration and verify ARIA updates
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SOURCE_TYPE, 'FILE');
      cy.verifyDynamicAriaUpdates();

      // Verify aria-expanded for collapsible sections
      cy.verifyAriaExpanded();

      cy.closeDialog();
    });
  });

  describe('Color and Contrast Compliance', () => {
    it('should meet WCAG AA color contrast requirements', () => {
      // Run automated contrast checks
      cy.checkColorContrast();

      // Verify processor colors meet contrast requirements
      cy.verifyProcessorColorContrast(processorId);

      // Test configuration dialog contrast
      cy.openProcessorConfigDialog(processorId);
      cy.verifyDialogColorContrast();
      cy.closeDialog();
    });

    it('should not rely solely on color for information', () => {
      // Verify error states use more than just color
      cy.openProcessorConfigDialog(processorId);
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SERVER_URL, TEST_DATA.INVALID_URL);
      cy.clickApplyButton();

      // Verify errors are indicated with icons, text, or other non-color cues
      cy.verifyNonColorErrorIndicators();

      cy.closeDialog();
    });

    it('should support high contrast mode', () => {
      // Enable high contrast mode (if supported)
      cy.enableHighContrastMode();

      // Verify UI remains functional and readable
      cy.verifyHighContrastCompatibility();

      // Test processor visibility in high contrast
      cy.verifyProcessorHighContrastVisibility(processorId);

      cy.disableHighContrastMode();
    });

    it('should handle custom color schemes appropriately', () => {
      // Test dark mode compatibility
      cy.enableDarkMode();
      cy.verifyDarkModeAccessibility();

      // Test processor in dark mode
      cy.verifyProcessorDarkModeVisibility(processorId);

      cy.disableDarkMode();
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility across different viewport sizes', () => {
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' },
      ];

      viewports.forEach((viewport) => {
        cy.viewport(viewport.width, viewport.height);
        cy.log(`Testing accessibility at ${viewport.name} resolution`);

        // Run accessibility checks at this viewport
        cy.checkA11y();

        // Verify processor remains accessible
        cy.verifyProcessorAccessibility(processorId);

        // Test configuration dialog accessibility
        cy.openProcessorConfigDialog(processorId);
        cy.verifyDialogAccessibility();
        cy.closeDialog();
      });
    });

    it('should handle touch accessibility requirements', () => {
      // Set mobile viewport
      cy.viewport(375, 667);

      // Verify touch targets meet size requirements (44px minimum)
      cy.verifyTouchTargetSizes();

      // Test processor touch accessibility
      cy.verifyProcessorTouchAccessibility(processorId);

      // Test configuration dialog touch accessibility
      cy.openProcessorConfigDialog(processorId);
      cy.verifyDialogTouchAccessibility();
      cy.closeDialog();
    });

    it('should support zoom up to 200% without horizontal scrolling', () => {
      // Test various zoom levels
      const zoomLevels = [125, 150, 200];

      zoomLevels.forEach((zoom) => {
        cy.setZoomLevel(zoom);
        cy.log(`Testing accessibility at ${zoom}% zoom`);

        // Verify no horizontal scrolling required
        cy.verifyNoHorizontalScroll();

        // Verify processor remains accessible
        cy.verifyProcessorAccessibility(processorId);

        // Test configuration dialog at zoom level
        cy.openProcessorConfigDialog(processorId);
        cy.verifyDialogZoomAccessibility();
        cy.closeDialog();
      });

      cy.resetZoomLevel();
    });
  });

  describe('Error Handling and User Feedback', () => {
    it('should provide accessible error messages', () => {
      cy.openProcessorConfigDialog(processorId);

      // Create configuration errors
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SOURCE_TYPE, TEST_DATA.SERVER);
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SERVER_URL, '');
      cy.clickApplyButton();

      // Verify error messages are accessible
      cy.verifyAccessibleErrorMessages();

      // Verify screen reader announcements
      cy.verifyErrorAnnouncements();

      cy.closeDialog();
    });

    it('should provide clear success feedback', () => {
      cy.openProcessorConfigDialog(processorId);

      // Configure processor successfully
      cy.configureProcessorForTesting(processorId);
      cy.clickApplyButton();

      // Verify success feedback is accessible
      cy.verifyAccessibleSuccessFeedback();

      cy.closeDialog();
    });

    it('should handle loading states accessibly', () => {
      cy.openProcessorConfigDialog(processorId);

      // Set configuration that may cause loading
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SOURCE_TYPE, TEST_DATA.SERVER);
      cy.setProcessorProperty(TEXT_CONSTANTS.JWKS_SERVER_URL, 'https://httpbin.org/delay/2');

      // Verify loading states are announced
      cy.verifyLoadingStateAnnouncements();

      cy.closeDialog();
    });

    it('should provide helpful guidance for complex configurations', () => {
      cy.openProcessorConfigDialog(processorId);

      // Verify help text is accessible
      cy.verifyAccessibleHelpText();

      // Verify complex field guidance
      cy.verifyComplexFieldGuidance();

      // Verify contextual help is accessible
      cy.verifyContextualHelpAccessibility();

      cy.closeDialog();
    });
  });

  describe('Comprehensive Accessibility Validation', () => {
    it('should pass automated accessibility tests', () => {
      // Run comprehensive axe-core tests
      cy.checkA11y();

      // Test processor-specific accessibility
      cy.verifyProcessorAccessibility(processorId);

      // Test configuration dialog accessibility
      cy.openProcessorConfigDialog(processorId);
      cy.checkA11y('.configuration-dialog');
      cy.closeDialog();
    });

    it('should handle accessibility across different processor states', () => {
      // Test accessibility in STOPPED state
      cy.verifyProcessorAccessibility(processorId);

      // Test accessibility in RUNNING state
      cy.startProcessor(processorId);
      cy.verifyProcessorAccessibility(processorId);

      // Test accessibility in ERROR state
      cy.configureProcessorForError(processorId);
      cy.verifyProcessorAccessibility(processorId);

      cy.stopProcessor(processorId);
    });

    it('should maintain accessibility during interactions', () => {
      // Test right-click context menu accessibility
      cy.getProcessorElement(processorId).rightclick();
      cy.verifyContextMenuAccessibility();
      cy.get('body').click(); // Close menu

      // Test drag and drop accessibility (if applicable)
      cy.verifyDragDropAccessibility(processorId);

      // Test selection accessibility
      cy.verifySelectionAccessibility(processorId);
    });

    it('should provide comprehensive screen reader experience', () => {
      // Simulate screen reader interaction flow
      cy.simulateScreenReaderFlow(processorId);

      // Verify all critical information is available to screen readers
      cy.verifyScreenReaderInformation(processorId);

      // Test complex workflows with screen reader
      cy.testScreenReaderWorkflow(processorId);
    });
  });
});
