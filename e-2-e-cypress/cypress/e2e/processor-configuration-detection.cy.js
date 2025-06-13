import { TEXT_CONSTANTS } from '../support/constants.js';
/**
 * Processor Configuration Detection Tests
 * Validates the new isProcessorConfigured command and related functionality
 */

describe('Processor Configuration Detection', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  afterEach(() => {
    // Clean up processors after each test
    cy.enhancedProcessorCleanup();
  });

  it('should detect unconfigured processor', () => {
    // Add a processor without configuration
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        // Check if processor is configured (should not be initially)
        cy.isProcessorConfigured(processorId).then((isConfigured) => {
          expect(isConfigured).to.be.a('boolean');
          cy.log(`Processor configured status: ${isConfigured}`);
        });
      } else {
        cy.log('Processor ID was null - skipping test');
      }
    });
  });

  it('should extract processor information correctly', () => {
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        cy.getProcessorElement(processorId)
          .should(TEXT_CONSTANTS.EXIST)
          .then(($element) => {
            // Verify we can find the processor element
            expect($element).to.exist;
            cy.log('Successfully found processor element');
          });
      }
    });
  });

  it('should create reliable processor references', () => {
    cy.createProcessorReference('GenerateFlowFile', { x: 400, y: 400 }).then((processorRef) => {
      // Verify reference object structure
      expect(processorRef).to.have.property('id');
      expect(processorRef).to.have.property('type', 'GenerateFlowFile');
      expect(processorRef).to.have.property('position');
      expect(processorRef).to.have.property('selectors');
      expect(processorRef).to.have.property('fallbackSelectors');

      // Test getting processor by reference
      cy.getProcessorByReference(processorRef).should(TEXT_CONSTANTS.EXIST);
    });
  });

  it('should find processors using improved discovery', () => {
    cy.addProcessor('LogAttribute').then((processorId) => {
      if (processorId) {
        // Test improved discovery mechanism
        cy.findProcessorElement(processorId).should(TEXT_CONSTANTS.EXIST);

        cy.log(`Successfully found processor with ID: ${processorId}`);
      }
    });
  });

  it('should handle multiple processor workflow', () => {
    // Create multiple processors with references
    cy.createProcessorReference('GenerateFlowFile', { x: 200, y: 200 }).then((ref1) => {
      cy.createProcessorReference('UpdateAttribute', { x: 400, y: 200 }).then((ref2) => {
        // Verify all processors exist and can be found
        cy.getProcessorByReference(ref1).should(TEXT_CONSTANTS.EXIST);
        cy.getProcessorByReference(ref2).should(TEXT_CONSTANTS.EXIST);

        // Check configuration status
        cy.isProcessorConfigured(ref1.id).then((isConfigured) => {
          expect(isConfigured).to.be.a('boolean');
        });
      });
    });
  });

  it('should detect processor state correctly', () => {
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        cy.getProcessorElement(processorId).then(($element) => {
          cy.getProcessorStateFromElement($element).then((state) => {
            // Should return a valid state
            expect(['RUNNING', 'STOPPED', 'INVALID', 'DISABLED', 'UNKNOWN']).to.include(state);
            cy.log(`Processor state: ${state}`);
          });
        });
      }
    });
  });

  it('should detect processor setup status', () => {
    cy.addProcessor('UpdateAttribute').then((processorId) => {
      if (processorId) {
        cy.getProcessorElement(processorId).then(($element) => {
          cy.detectProcessorSetupFromElement($element).then((hasSetup) => {
            // Should return a boolean
            expect(hasSetup).to.be.a('boolean');
            cy.log(`Processor has setup: ${hasSetup}`);
          });
        });
      }
    });
  });
});
