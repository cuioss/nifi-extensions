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
      expect(types).to.have.property('SINGLE_ISSUER');
      expect(types).to.have.property('MULTI_ISSUER');
      
      // Verify processor definitions are complete
      expect(types.SINGLE_ISSUER).to.have.property('className');
      expect(types.SINGLE_ISSUER).to.have.property('displayName');
      expect(types.SINGLE_ISSUER.className).to.equal('de.cuioss.nifi.processors.auth.JWTTokenAuthenticator');
      
      expect(types.MULTI_ISSUER).to.have.property('className');
      expect(types.MULTI_ISSUER).to.have.property('displayName');
      expect(types.MULTI_ISSUER.className).to.equal('de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator');
      
      cy.log('✅ JWT processor types are properly defined');
      cy.log(`Single Issuer: ${types.SINGLE_ISSUER.displayName}`);
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
    cy.findProcessorOnCanvas('SINGLE_ISSUER').then((processor) => {
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

  // Note: Processor addition/removal tests will be added once we verify 
  // the basic functionality works and understand how NiFi's UI handles 
  // processor addition in this specific environment
});
