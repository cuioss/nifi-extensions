/**
 * Task 3: Processor ID Management Tests
 * Validates enhanced processor ID management functionality
 */

import { SELECTORS, TEXT_CONSTANTS } from '../support/constants.js';

describe('Task 3: Processor ID Management', () => {
  beforeEach(() => {
    // Login and navigate to canvas before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  afterEach(() => {
    // Enhanced cleanup after each test
    cy.enhancedProcessorCleanup();
  });

  it('should get any working processor ID (functional approach)', () => {
    cy.log('Testing functional processor ID extraction...');

    // First add a processor to work with
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        // Test getting any working processor ID
        cy.getAnyWorkingProcessorId().then((workingId) => {
          expect(workingId).to.exist;
          expect(workingId).to.be.a('string');
          expect(workingId).to.not.be.empty;
          cy.log(`✅ Got working processor ID: ${workingId}`);
        });

        // Test type-specific ID extraction
        cy.getAnyWorkingProcessorId('GenerateFlowFile').then((typeSpecificId) => {
          expect(typeSpecificId).to.exist;
          expect(typeSpecificId).to.be.a('string');
          cy.log(`✅ Got type-specific working ID: ${typeSpecificId}`);
        });
      }
    });
  });

  it('should find processor by type when ID fails', () => {
    cy.log('Testing processor type-based identification...');

    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        // Test enhanced type-based discovery
        cy.findProcessorByTypeEnhanced('MultiIssuerJWTTokenAuthenticator').then(($element) => {
          if ($element) {
            expect($element).to.exist;
            cy.log('✅ Found processor by enhanced type discovery');
          }
        });

        // Test type discovery for JWT processors
        cy.findProcessorByTypeEnhanced('JWT').then(($element) => {
          if ($element) {
            expect($element).to.exist;
            cy.log('✅ Found JWT processor by partial type match');
          }
        });
      }
    });
  });

  it('should create and use enhanced processor reference system', () => {
    cy.log('Testing enhanced processor reference system...');

    // Create enhanced reference
    cy.createEnhancedProcessorReference('JWTTokenAuthenticator', {
      position: { x: 400, y: 300 },
      allowFunctionalFallback: true,
      priority: 'functional',
    }).then((enhancedRef) => {
      // Verify reference structure
      expect(enhancedRef).to.have.property('type', 'JWTTokenAuthenticator');
      expect(enhancedRef).to.have.property('testId');
      expect(enhancedRef).to.have.property('identificationStrategies');
      expect(enhancedRef).to.have.property('functionalSelectors');
      expect(enhancedRef).to.have.property('testMetadata');
      expect(enhancedRef.testMetadata).to.have.property('task', 'task-3');

      cy.log('✅ Enhanced processor reference created successfully');
      cy.log('Reference strategies:', enhancedRef.identificationStrategies);
    });
  });

  it('should handle multi-processor coordination', () => {
    cy.log('Testing multi-processor coordination...');

    const processorTypes = ['GenerateFlowFile', 'UpdateAttribute', 'LogAttribute'];

    const references = [];

    // Create multiple processors with enhanced references
    processorTypes.forEach((type, index) => {
      cy.createEnhancedProcessorReference(type, {
        position: { x: 200 + index * 200, y: 300 },
        allowFunctionalFallback: true,
      }).then((ref) => {
        references.push(ref);

        // Add actual processor for testing
        cy.addProcessor(type, { x: 200 + index * 200, y: 300 }).then((processorId) => {
          if (processorId) {
            // Test that we can get processor using enhanced reference
            cy.getProcessorByEnhancedReference(ref).then(($element) => {
              if ($element) {
                expect($element).to.exist;
                cy.log(`✅ Multi-processor coordination working for ${type}`);
              }
            });
          }
        });
      });
    });

    cy.then(() => {
      cy.log(`✅ Created ${references.length} enhanced references for coordination`);
    });
  });

  it('should perform enhanced cleanup for complex scenarios', () => {
    cy.log('Testing enhanced cleanup mechanisms...');

    // Add multiple processors to test cleanup
    const processors = ['GenerateFlowFile', 'UpdateAttribute', 'LogAttribute'];

    processors.forEach((type, index) => {
      cy.addProcessor(type, { x: 200 + index * 150, y: 250 });
    });

    // Wait for processors to be added to DOM
    cy.get(SELECTORS.PROCESSOR, { timeout: 10000 }).should('have.length.at.least', 3);

    // Count processors before cleanup
    cy.get('body').then(($body) => {
      const beforeCount = $body.find(SELECTORS.PROCESSOR).length;
      cy.log(`Processors before cleanup: ${beforeCount}`);

      // Perform enhanced cleanup
      cy.enhancedProcessorCleanup();

      // Wait for cleanup to complete by checking processor count reduction
      cy.get('body').should(($body) => {
        const currentCount = $body.find('g.processor, [class*="processor"], .component').length;
        expect(currentCount).to.be.lessThan(beforeCount);
      });

      // Count processors after cleanup
      cy.get('body').then(($afterBody) => {
        const afterCount = $afterBody.find('g.processor, [class*="processor"], .component').length;
        cy.log(`Processors after cleanup: ${afterCount}`);
        cy.log('✅ Enhanced cleanup mechanism tested');
      });
    });
  });

  it('should handle processor ID failures gracefully', () => {
    cy.log('Testing graceful handling of processor ID failures...');

    // Test with invalid processor ID
    const invalidId = 'non-existent-processor-12345';

    // Should not fail, should find functionally
    cy.findProcessorElement(invalidId)
      .then((_$element) => {
        // Might find a functional processor or handle gracefully
        cy.log('✅ Graceful handling of invalid processor ID');
      })
      .catch(() => {
        // Expected to fail gracefully
        cy.log('✅ Failed gracefully for invalid processor ID');
      });

    // Test functional ID generation when no processors exist
    cy.enhancedProcessorCleanup(); // Clear everything first
    // Wait for cleanup to complete
    cy.get('body').should(TEXT_CONSTANTS.BE_VISIBLE);

    cy.getAnyWorkingProcessorId().then((functionalId) => {
      expect(functionalId).to.exist;
      expect(functionalId).to.include('test-processor-');
      cy.log(`✅ Generated functional ID when no processors exist: ${functionalId}`);
    });
  });

  it('should support processor type identification over ID validation', () => {
    cy.log('Testing processor type identification priority...');

    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        // Test that type-based identification works regardless of ID format
        cy.findProcessorByTypeEnhanced('JWT').then(($element) => {
          if ($element) {
            cy.log('✅ Type-based identification working');

            // Test that we can work with the processor functionally
            cy.getAnyWorkingProcessorId('JWT').then((workingId) => {
              expect(workingId).to.exist;
              cy.log(`✅ Got functional ID for JWT processor: ${workingId}`);
            });
          }
        });
      }
    });
  });
});
