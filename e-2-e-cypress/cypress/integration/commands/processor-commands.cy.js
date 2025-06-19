/**
 * Self-verification tests for processor commands
 * These tests verify that the custom processor commands work correctly
 */

import { SELECTORS, TEXT_CONSTANTS } from '../../support/constants.js';

describe('Processor Commands Self-Verification', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  it('should add a processor to the canvas', () => {
    // Test the addProcessor command
    cy.addProcessor(TEXT_CONSTANTS.GENERATE_FLOW_FILE, { x: 300, y: 300 }).then((processorId) => {
      // Verify processor was added
      expect(processorId).to.not.be.undefined;
      cy.get(`g[id="${processorId}"]`).should('exist');

      // Verify processor is visible on canvas
      cy.get(`g[id="${processorId}"]`).should(TEXT_CONSTANTS.BE_VISIBLE);
    });
  });

  it('should configure processor properties', () => {
    // Add a processor first
    cy.addProcessor(TEXT_CONSTANTS.GENERATE_FLOW_FILE).then((processorId) => {
      const testConfig = {
        name: 'Test Generate FlowFile',
        properties: {
          'File Size': '1024B',
          'Batch Size': '5',
        },
      };

      // Test the configureProcessor command
      cy.configureProcessor(processorId, testConfig);

      // Verify configuration was applied
      cy.verifyProcessorProperties(processorId, testConfig.properties);
    });
  });

  it('should verify processor properties correctly', () => {
    // Add and configure a processor
    cy.addProcessor(TEXT_CONSTANTS.GENERATE_FLOW_FILE).then((processorId) => {
      const testProperties = {
        'File Size': '2048B',
        'Batch Size': '10',
      };

      // Configure the processor
      cy.configureProcessor(processorId, { properties: testProperties });

      // Test the verifyProcessorProperties command
      cy.verifyProcessorProperties(processorId, testProperties);
    });
  });

  it('should handle processor configuration dialog lifecycle', () => {
    // Add a processor
    cy.addProcessor(TEXT_CONSTANTS.GENERATE_FLOW_FILE).then((processorId) => {
      // Open configuration dialog
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.BE_VISIBLE);

      // Close dialog with Cancel
      cy.get('button').contains('Cancel').click();
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should('not.exist');

      // Open again and close with Apply
      cy.navigateToProcessorConfig(processorId);
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should(TEXT_CONSTANTS.BE_VISIBLE);
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();
      cy.get(SELECTORS.CONFIGURATION_DIALOG).should('not.exist');
    });
  });

  it('should handle multiple processors on canvas', () => {
    const processors = [TEXT_CONSTANTS.GENERATE_FLOW_FILE, 'LogAttribute', 'UpdateAttribute'];
    const processorIds = [];

    // Add multiple processors
    processors.forEach((processorType, index) => {
      cy.addProcessor(processorType, { x: 200 + index * 150, y: 300 }).then((processorId) => {
        processorIds.push(processorId);

        // Verify each processor exists
        cy.get(`g[id="${processorId}"]`).should('exist');
      });
    });

    // Verify all processors are on canvas
    cy.get('g.processor').should('have.length.at.least', processors.length);
  });

  it('should handle processor property validation', () => {
    // Add a processor that has validation requirements
    cy.addProcessor(TEXT_CONSTANTS.GENERATE_FLOW_FILE).then((processorId) => {
      // Configure with invalid property value
      cy.navigateToProcessorConfig(processorId);
      cy.get('.processor-configuration-tab').contains('Properties').click();

      // Try to set an invalid file size
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('File Size')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .clear();
      cy.get(SELECTORS.PROCESSOR_PROPERTY_NAME)
        .contains('File Size')
        .parents(SELECTORS.PROCESSOR_PROPERTY_ROW)
        .find('input')
        .type('invalid-size');

      // Apply and check for validation errors
      cy.get('button').contains(TEXT_CONSTANTS.APPLY).click();

      // Should show validation error or keep dialog open
      cy.get('body').then(($body) => {
        const hasError = $body.find('.validation-error, .error-message').length > 0;
        const dialogStillOpen = $body.find(SELECTORS.CONFIGURATION_DIALOG).length > 0;

        expect(hasError || dialogStillOpen).to.be.true;

        // Clean up by canceling if dialog is still open
        if (dialogStillOpen) {
          cy.get('button').contains('Cancel').click();
        }
      });
    });
  });
});
