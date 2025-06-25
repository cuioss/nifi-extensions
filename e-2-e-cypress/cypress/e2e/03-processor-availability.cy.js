/**
 * @file 03 - JWT Processor Availability Verification
 * Tests that the two specific JWT processors are available and can be managed on the NiFi canvas
 * - JWTTokenAuthenticator (Single Issuer)
 * - MultiIssuerJWTTokenAuthenticator (Multi Issuer)
 * 
 * Each test is self-sufficient and uses the processor helper to interact with actual processors
 */

describe('03 - JWT Processor Availability Verification', () => {
  beforeEach(() => {
    // Each test is self-sufficient - login and ensure canvas is ready
    cy.ensureNiFiReady();
  });

  it('R-PROC-001: Should verify JWT processor types are available in the system', () => {
    cy.log('Testing availability of JWT processor types');

    // Verify processor type constants are available
    cy.getJWTProcessorTypes().then((types) => {
      expect(types).to.have.property('JWT_AUTHENTICATOR');
      expect(types).to.have.property('MULTI_ISSUER');
      
      // Verify processor definitions are complete
      expect(types.JWT_AUTHENTICATOR).to.have.property('className');
      expect(types.JWT_AUTHENTICATOR).to.have.property('displayName');
      expect(types.JWT_AUTHENTICATOR.className).to.equal('de.cuioss.nifi.processors.auth.JWTTokenAuthenticator');
      
      expect(types.MULTI_ISSUER).to.have.property('className');
      expect(types.MULTI_ISSUER).to.have.property('displayName');
      expect(types.MULTI_ISSUER.className).to.equal('de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator');
      
      cy.log('✅ JWT processor types are properly defined');
      cy.log(`JWT Authenticator: ${types.JWT_AUTHENTICATOR.displayName}`);
      cy.log(`Multi Issuer: ${types.MULTI_ISSUER.displayName}`);
    });
  });

  it('R-PROC-002: Should verify canvas is ready for processor operations', () => {
    cy.log('Testing canvas readiness for processor operations');

    // Verify we're on the main canvas and ready for processor operations
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isReady).to.be.true;
      expect(context.isAuthenticated).to.be.true;
      
      // Verify canvas elements are present for processor operations
      const hasCanvas = context.elements['#canvas'] || context.elements['svg'];
      expect(hasCanvas).to.be.true;
      
      cy.log('✅ Canvas is ready for processor operations');
    });
  });

  it('R-PROC-003: Should verify no JWT processors exist initially', () => {
    cy.log('Testing initial state - no JWT processors on canvas');

    // Verify canvas starts clean
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.have.length(0);
      cy.log('✅ Canvas starts clean - no JWT processors found');
    });
  });

  it('R-PROC-004: Should be able to search for processors (even if not found)', () => {
    cy.log('Testing processor search functionality');

    // Test that we can search for each processor type without errors
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      // Should return null since we haven't added any processors yet
      expect(processor).to.be.null;
      cy.log('✅ Single issuer search completed (correctly returns null)');
    });

    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      // Should return null since we haven't added any processors yet  
      expect(processor).to.be.null;
      cy.log('✅ Multi issuer search completed (correctly returns null)');
    });

    cy.log('✅ Processor search functionality is working');
  });

  it('R-PROC-005: Should be able to add JWT Authenticator processor to canvas', () => {
    cy.log('Testing JWT Authenticator processor addition');

    // Ensure canvas starts clean
    cy.cleanupJWTProcessors();

    // Add JWT Authenticator processor
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      // Verify processor was added successfully
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor.type).to.equal('JWT_AUTHENTICATOR');
      expect(addedProcessor.name).to.contain('JWTTokenAuthenticator');
      expect(addedProcessor.isVisible).to.be.true;
      cy.log(`✅ JWT Authenticator added successfully: ${addedProcessor.name}`);
    });

    // Verify processor is now findable on canvas
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((foundProcessor) => {
      expect(foundProcessor).to.not.be.null;
      cy.log('✅ Added processor is findable on canvas');
    });
  });

  it('R-PROC-006: Should be able to add Multi-Issuer JWT processor to canvas', () => {
    cy.log('Testing Multi-Issuer JWT processor addition');

    // Ensure canvas starts clean
    cy.cleanupJWTProcessors();

    // Add Multi-Issuer JWT processor
    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 600, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      // Verify processor was added successfully
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor.type).to.equal('MULTI_ISSUER');
      expect(addedProcessor.name).to.contain('MultiIssuerJWTTokenAuthenticator');
      expect(addedProcessor.isVisible).to.be.true;
      cy.log(`✅ Multi-Issuer JWT processor added successfully: ${addedProcessor.name}`);
    });

    // Verify processor is now findable on canvas
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((foundProcessor) => {
      expect(foundProcessor).to.not.be.null;
      cy.log('✅ Added processor is findable on canvas');
    });
  });

  it('R-PROC-007: Should be able to add both JWT processors simultaneously', () => {
    cy.log('Testing addition of both JWT processors to canvas');

    // Ensure canvas starts clean
    cy.cleanupJWTProcessors();

    // Add both processors
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 350, y: 250 },
      skipIfExists: false
    });

    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 550, y: 250 },
      skipIfExists: false
    });

    // Verify both processors are on canvas
    cy.getAllJWTProcessorsOnCanvas().then((allProcessors) => {
      expect(allProcessors).to.have.length(2);
      
      const processorTypes = allProcessors.map(p => p.type);
      expect(processorTypes).to.include('JWT_AUTHENTICATOR');
      expect(processorTypes).to.include('MULTI_ISSUER');
      
      cy.log('✅ Both JWT processors successfully added to canvas');
      cy.log(`Processors on canvas: ${allProcessors.map(p => p.name).join(', ')}`);
    });
  });

  it('R-PROC-008: Should be able to remove JWT Authenticator processor from canvas', () => {
    cy.log('Testing JWT Authenticator processor removal');

    // Setup: Add a processor to remove
    cy.cleanupJWTProcessors();
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    });

    // Remove the processor
    cy.removeProcessorFromCanvas('JWT_AUTHENTICATOR', {
      confirmDeletion: true
    }).then((removeSuccess) => {
      expect(removeSuccess).to.be.true;
      cy.log('✅ Processor removal completed');
    });

    // Verify processor is no longer on canvas
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((foundProcessor) => {
      expect(foundProcessor).to.be.null;
      cy.log('✅ Processor successfully removed from canvas');
    });

    // Verify canvas is clean
    cy.getAllJWTProcessorsOnCanvas().then((remainingProcessors) => {
      expect(remainingProcessors).to.have.length(0);
      cy.log('✅ Canvas is clean after processor removal');
    });
  });

  it('R-PROC-009: Should be able to remove Multi-Issuer JWT processor from canvas', () => {
    cy.log('Testing Multi-Issuer JWT processor removal');

    // Setup: Add a processor to remove
    cy.cleanupJWTProcessors();
    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    });

    // Remove the processor
    cy.removeProcessorFromCanvas('MULTI_ISSUER', {
      confirmDeletion: true
    }).then((removeSuccess) => {
      expect(removeSuccess).to.be.true;
      cy.log('✅ Processor removal completed');
    });

    // Verify processor is no longer on canvas
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((foundProcessor) => {
      expect(foundProcessor).to.be.null;
      cy.log('✅ Processor successfully removed from canvas');
    });

    // Verify canvas is clean
    cy.getAllJWTProcessorsOnCanvas().then((remainingProcessors) => {
      expect(remainingProcessors).to.have.length(0);
      cy.log('✅ Canvas is clean after processor removal');
    });
  });

  it('R-PROC-010: Should demonstrate complete processor lifecycle management', () => {
    cy.log('Testing complete processor lifecycle - add, verify, and cleanup');

    // Phase 1: Start with clean canvas
    cy.cleanupJWTProcessors();
    
    // Phase 2: Add both processors
    cy.log('📋 Phase 1: Adding both processors');
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 300, y: 200 },
      skipIfExists: false
    });

    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 500, y: 200 },
      skipIfExists: false
    });

    // Phase 3: Verify both processors exist
    cy.log('📋 Phase 2: Verifying processors exist');
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.have.length(2);
      cy.log(`✅ Both processors confirmed: ${processors.length} found`);
    });

    // Phase 4: Cleanup all processors using helper
    cy.log('📋 Phase 3: Cleaning up all processors');
    cy.cleanupJWTProcessors().then((removedCount) => {
      expect(removedCount).to.be.greaterThan(0);
      cy.log(`✅ Cleanup completed: ${removedCount} processors removed`);
    });

    // Phase 5: Final verification - canvas should be empty
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.have.length(0);
      cy.log('✅ Complete lifecycle test successful - canvas is clean');
    });
  });

  // Cleanup after all tests to ensure canvas is clean for subsequent runs
  afterEach(() => {
    cy.log('🧹 Cleaning up processors after test');
    cy.cleanupJWTProcessors();
  });
});
