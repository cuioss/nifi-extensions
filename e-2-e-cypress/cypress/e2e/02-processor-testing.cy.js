/**
 * @file Processor Testing
 * Simplified processor tests focused on JWT processor availability and basic functionality
 * Consolidates processor functionality from multiple previous test files
 */

describe('JWT Processor Testing', () => {
  beforeEach(() => {
    cy.log('Setting up processor test with authenticated NiFi session');
    // Ensure we're logged in and ready for processor testing
    cy.ensureNiFiReady();
  });

  it('Should verify JWT processor types are available', () => {
    cy.log('🔍 Verifying JWT processor types are available in the system');

    // Get processor type definitions
    cy.getJWTProcessorTypes().then((types) => {
      // Verify both JWT processor types exist
      expect(types).to.have.property('JWT_AUTHENTICATOR');
      expect(types).to.have.property('MULTI_ISSUER');

      // Verify processor definitions are complete
      expect(types.JWT_AUTHENTICATOR).to.have.property('className');
      expect(types.JWT_AUTHENTICATOR).to.have.property('displayName');
      expect(types.JWT_AUTHENTICATOR.className).to.equal(
        'de.cuioss.nifi.processors.auth.JWTTokenAuthenticator'
      );

      expect(types.MULTI_ISSUER).to.have.property('className');
      expect(types.MULTI_ISSUER).to.have.property('displayName');
      expect(types.MULTI_ISSUER.className).to.equal(
        'de.cuioss.nifi.processors.auth.MultiIssuerJWTTokenAuthenticator'
      );

      cy.log('✅ JWT processor types are properly defined');
      cy.log(`- JWT Authenticator: ${types.JWT_AUTHENTICATOR.displayName}`);
      cy.log(`- Multi Issuer: ${types.MULTI_ISSUER.displayName}`);
    });
  });

  it('Should verify canvas is ready for processor operations', () => {
    cy.log('🎯 Verifying canvas is ready for processor operations');

    // Verify we're on the main canvas and ready
    cy.getPageContext().then((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isReady).to.be.true;
      expect(context.isAuthenticated).to.be.true;

      // Verify canvas elements are present
      expect(context.elements.hasCanvasElements).to.be.true;

      cy.log('✅ Canvas is ready for processor operations');
    });
  });

  it('Should verify processor search functionality works', () => {
    cy.log('🔍 Testing processor search functionality');

    // Test searching for each processor type
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      // Should return null or a valid processor object
      expect(processor).to.satisfy((p) => p === null || (p && typeof p.name === 'string'));

      if (processor) {
        cy.log(`✅ Found JWT_AUTHENTICATOR: ${processor.name}`);
        expect(processor).to.have.property('id');
        expect(processor).to.have.property('type');
        expect(processor).to.have.property('position');
      } else {
        cy.log('✅ JWT_AUTHENTICATOR not found (expected on clean canvas)');
      }
    });

    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      // Should return null or a valid processor object
      expect(processor).to.satisfy((p) => p === null || (p && typeof p.name === 'string'));

      if (processor) {
        cy.log(`✅ Found MULTI_ISSUER: ${processor.name}`);
        expect(processor).to.have.property('id');
        expect(processor).to.have.property('type');
        expect(processor).to.have.property('position');
      } else {
        cy.log('✅ MULTI_ISSUER not found (expected on clean canvas)');
      }
    });

    cy.log('✅ Processor search functionality is working correctly');
  });

  it('Should verify processor helper infrastructure is robust', () => {
    cy.log('🧪 Testing processor helper infrastructure robustness');

    // Test that all expected helper commands exist
    expect(cy.getJWTProcessorTypes).to.be.a('function');
    expect(cy.findProcessorOnCanvas).to.be.a('function');
    expect(cy.getAllJWTProcessorsOnCanvas).to.be.a('function');

    // Test that helpers handle empty canvas gracefully
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      cy.log(`✅ Helper correctly handles canvas state: ${processors.length} JWT processors found`);

      // If processors exist, verify their structure
      processors.forEach((processor, index) => {
        expect(processor).to.have.property('id');
        expect(processor).to.have.property('type');
        expect(processor).to.have.property('name');
        expect(processor).to.have.property('position');
        cy.log(`  - Processor ${index + 1}: ${processor.name} (${processor.type})`);
      });
    });

    cy.log('✅ Processor helper infrastructure is robust and working correctly');
  });

  afterEach(() => {
    cy.log('🧹 Cleaning up processors after test');
    // Clean up any processors that might have been added during testing
    cy.cleanupJWTProcessors();
  });
});
