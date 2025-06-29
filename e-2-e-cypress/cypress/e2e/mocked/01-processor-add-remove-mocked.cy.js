/**
 * @file Mocked Processor Add/Remove Testing
 * Fast, reliable tests using mocked NiFi API and UI components
 * Demonstrates the hybrid testing approach - same functionality, no server dependency
 */

import '../../support/mock-commands';

describe('JWT Processor Add/Remove Operations (Mocked)', () => {
  // Setup mocked environment before each test
  beforeEach(() => {
    // Visit a minimal HTML page (served by simple HTTP server)
    cy.visit('/cypress/fixtures/mock-base.html');

    cy.setupMockedNiFi({
      enableAuth: true,
      enableProcessors: true,
      enableFlow: true
    });
  });

  // Clean up after each test
  afterEach(() => {
    cy.cleanupMockedJWTProcessors();
  });

  it('Should add JWT_AUTHENTICATOR processor to mocked canvas', () => {
    cy.log('🎭 Adding JWT_AUTHENTICATOR processor to mocked canvas');

    // Add the processor to mocked canvas
    cy.addMockedProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      expect(addedProcessor).to.have.property('type');
      expect(addedProcessor.type).to.equal('JWT_AUTHENTICATOR');
      cy.log(`✅ JWT_AUTHENTICATOR processor successfully added: ${addedProcessor.name}`);
    });

    // Verify processor is on mocked canvas
    cy.findMockedProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.not.be.null;
      expect(processor).to.have.property('name');
      expect(processor.name).to.contain('JWTTokenAuthenticator');
      cy.log('✅ JWT_AUTHENTICATOR processor verified on mocked canvas');
    });
  });

  it('Should add MULTI_ISSUER processor to mocked canvas', () => {
    cy.log('🎭 Adding MULTI_ISSUER processor to mocked canvas');

    // Add the processor to mocked canvas
    cy.addMockedProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 600, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      expect(addedProcessor).to.have.property('type');
      expect(addedProcessor.type).to.equal('MULTI_ISSUER');
      cy.log(`✅ MULTI_ISSUER processor successfully added: ${addedProcessor.name}`);
    });

    // Verify processor is on mocked canvas
    cy.findMockedProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.not.be.null;
      expect(processor).to.have.property('name');
      expect(processor.name).to.contain('MultiIssuerJWTTokenAuthenticator');
      cy.log('✅ MULTI_ISSUER processor verified on mocked canvas');
    });
  });

  it('Should add and remove JWT_AUTHENTICATOR processor from mocked canvas', () => {
    cy.log('🎭 Testing JWT_AUTHENTICATOR processor add and remove cycle on mocked canvas');

    // First add the processor
    cy.addMockedProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      cy.log(`✅ JWT_AUTHENTICATOR processor added: ${addedProcessor.name}`);
    });

    // Verify processor is on mocked canvas
    cy.findMockedProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.not.be.null;
      cy.log('✅ JWT_AUTHENTICATOR processor verified on mocked canvas');
    });

    // Now remove the processor
    cy.removeMockedProcessorFromCanvas('JWT_AUTHENTICATOR', {
      confirmDeletion: true
    }).then((success) => {
      expect(success).to.be.true;
      cy.log('✅ JWT_AUTHENTICATOR processor successfully removed from mocked canvas');
    });

    // Verify processor is no longer on mocked canvas
    cy.findMockedProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.be.null;
      cy.log('✅ JWT_AUTHENTICATOR processor confirmed removed from mocked canvas');
    });
  });

  it('Should add and remove MULTI_ISSUER processor from mocked canvas', () => {
    cy.log('🎭 Testing MULTI_ISSUER processor add and remove cycle on mocked canvas');

    // First add the processor
    cy.addMockedProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 600, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      cy.log(`✅ MULTI_ISSUER processor added: ${addedProcessor.name}`);
    });

    // Verify processor is on mocked canvas
    cy.findMockedProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.not.be.null;
      cy.log('✅ MULTI_ISSUER processor verified on mocked canvas');
    });

    // Now remove the processor
    cy.removeMockedProcessorFromCanvas('MULTI_ISSUER', {
      confirmDeletion: true
    }).then((success) => {
      expect(success).to.be.true;
      cy.log('✅ MULTI_ISSUER processor successfully removed from mocked canvas');
    });

    // Verify processor is no longer on mocked canvas
    cy.findMockedProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.be.null;
      cy.log('✅ MULTI_ISSUER processor confirmed removed from mocked canvas');
    });
  });

  it('Should test complete processor lifecycle with both processors on mocked canvas', () => {
    cy.log('🎭 Testing complete processor lifecycle with both JWT processors on mocked canvas');

    // Add both processors to mocked canvas
    cy.addMockedProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 300, y: 200 },
      skipIfExists: false
    }).then((processor1) => {
      expect(processor1).to.not.be.null;
      cy.log(`✅ JWT_AUTHENTICATOR added to mocked canvas: ${processor1.name}`);
    });

    cy.addMockedProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 500, y: 200 },
      skipIfExists: false
    }).then((processor2) => {
      expect(processor2).to.not.be.null;
      cy.log(`✅ MULTI_ISSUER added to mocked canvas: ${processor2.name}`);
    });

    // Verify both processors are on mocked canvas
    cy.getAllMockedJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      expect(processors.length).to.equal(2);
      cy.log(`✅ Both processors verified on mocked canvas: ${processors.length} found`);

      // Verify each processor has expected properties
      processors.forEach((processor) => {
        expect(processor).to.have.property('name');
        expect(processor).to.have.property('type');
        expect(['JWT_AUTHENTICATOR', 'MULTI_ISSUER']).to.include(processor.type);
      });
    });

    // Test cleanup functionality
    cy.cleanupMockedJWTProcessors().then((removedCount) => {
      expect(removedCount).to.equal(2);
      cy.log(`✅ Mocked cleanup successful: ${removedCount} processors removed`);
    });

    // Verify mocked canvas is clean
    cy.getAllMockedJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      expect(processors.length).to.equal(0);
      cy.log('✅ Mocked canvas confirmed clean after cleanup');
    });
  });

  it('Should handle processor addition with skipIfExists option on mocked canvas', () => {
    cy.log('🎭 Testing processor addition with skipIfExists option on mocked canvas');

    // Add processor first time
    cy.addMockedProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    }).then((processor1) => {
      expect(processor1).to.not.be.null;
    });

    cy.log('✅ First JWT_AUTHENTICATOR added');

    // Try to add same processor with skipIfExists=true (should skip)
    cy.addMockedProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 500, y: 300 },
      skipIfExists: true
    }).then((processor2) => {
      expect(processor2).to.not.be.null;
      // Should return the existing processor
      expect(processor2.position.x).to.equal(400); // Original position
    });

    cy.log('✅ Second addition skipped existing processor as expected');

    // Verify only one processor exists
    cy.getAllMockedJWTProcessorsOnCanvas().then((processors) => {
      expect(processors.length).to.equal(1);
    });

    cy.log('✅ Only one processor exists as expected');
  });

  it('Should demonstrate fast execution time for mocked tests', () => {
    cy.log('🎭 Demonstrating fast execution time for mocked tests');

    const startTime = Date.now();

    // Perform multiple operations quickly
    cy.addMockedProcessorToCanvas('JWT_AUTHENTICATOR', { position: { x: 200, y: 200 } })
      .then(() => cy.addMockedProcessorToCanvas('MULTI_ISSUER', { position: { x: 400, y: 200 } }))
      .then(() => cy.getAllMockedJWTProcessorsOnCanvas())
      .then((processors) => {
        expect(processors.length).to.equal(2);
        return cy.cleanupMockedJWTProcessors();
      })
      .then((removedCount) => {
        expect(removedCount).to.equal(2);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        cy.log(`✅ Mocked test completed in ${executionTime}ms`);

        // Verify it's fast (should be under 1 second for mocked operations)
        expect(executionTime).to.be.lessThan(1000);
        cy.log('✅ Fast execution time verified for mocked tests');
      });
  });
});
