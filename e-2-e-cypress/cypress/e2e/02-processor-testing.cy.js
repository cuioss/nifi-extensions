/**
 * @file Processor Testing
 * Simplified processor tests focused on JWT processor availability and basic functionality
 * Consolidates processor functionality from multiple previous test files
 */

import {
  verifyProcessorDefinition,
  testProcessorSearch,
  verifyCommandsExist,
  verifyCanvasReady,
  ProcessorTestPatterns,
} from '../support/test-helpers.js';

describe('JWT Processor Testing', () => {
  // Common test setup
  beforeEach(() => {
    cy.ensureNiFiReady();
  });

  // Common cleanup
  afterEach(() => {
    cy.cleanupJWTProcessors();
  });

  it('Should verify JWT processor types are available', () => {
    // Verify both processor types using shared constants
    Object.entries(ProcessorTestPatterns.JWT_PROCESSOR_CLASSES).forEach(([type, className]) => {
      verifyProcessorDefinition(type, className);
    });
  });

  it('Should verify canvas is ready for processor operations', () => {
    verifyCanvasReady();
  });

  it('Should verify processor search functionality works', () => {
    // Test both processor types using shared constants
    ProcessorTestPatterns.JWT_PROCESSOR_TYPES.forEach((processorType) => {
      testProcessorSearch(processorType);
    });
  });

  it('Should verify processor helper infrastructure is robust', () => {
    // Verify helper functions exist using shared constants
    verifyCommandsExist(ProcessorTestPatterns.REQUIRED_COMMANDS);

    // Test canvas state handling
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      cy.log(`Helper correctly handles canvas state: ${processors.length} JWT processors found`);

      // Verify processor structure using shared constants
      processors.forEach((processor, index) => {
        ProcessorTestPatterns.REQUIRED_PROCESSOR_PROPERTIES.forEach((prop) => {
          expect(processor).to.have.property(prop);
        });
        cy.log(`Processor ${index + 1}: ${processor.name} (${processor.type})`);
      });
    });
  });
});
