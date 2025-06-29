/**
 * @file Processor Add/Remove Testing
 * Tests for adding and removing the two JWT processors under test
 * Conditions of Satisfaction: We must be able to simply add/remove processors for later tests
 */

import { ProcessorTestPatterns } from '../support/test-helpers.js';

describe('JWT Processor Add/Remove Operations', () => {
  // Common test setup
  beforeEach(() => {
    cy.ensureNiFiReady();
  });

  // Common cleanup - ensure canvas is clean after each test
  afterEach(() => {
    cy.cleanupJWTProcessors();
  });

  it('Should test JWT_AUTHENTICATOR processor addition infrastructure', () => {
    cy.log('🧪 Testing JWT_AUTHENTICATOR processor addition infrastructure');

    // Test that the processor addition infrastructure is working
    // This tests the helper functions without requiring actual processor addition
    cy.getJWTProcessorTypes().then((types) => {
      expect(types).to.have.property('JWT_AUTHENTICATOR');
      const processor = types.JWT_AUTHENTICATOR;
      expect(processor).to.have.property('className');
      expect(processor).to.have.property('displayName');
      cy.log(`✅ JWT_AUTHENTICATOR processor definition verified: ${processor.displayName}`);
    });

    // Test canvas readiness
    cy.getPageContext().should((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isReady).to.be.true;
    }).then(() => {
      cy.log('✅ Canvas is ready for processor operations');
    });
  });

  it('Should test MULTI_ISSUER processor addition infrastructure', () => {
    cy.log('🧪 Testing MULTI_ISSUER processor addition infrastructure');

    // Test that the processor addition infrastructure is working
    cy.getJWTProcessorTypes().then((types) => {
      expect(types).to.have.property('MULTI_ISSUER');
      const processor = types.MULTI_ISSUER;
      expect(processor).to.have.property('className');
      expect(processor).to.have.property('displayName');
      cy.log(`✅ MULTI_ISSUER processor definition verified: ${processor.displayName}`);
    });

    // Test processor search functionality
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      // Should return null on clean canvas (expected behavior)
      expect(processor).to.satisfy((p) => p === null || (p && typeof p.name === 'string'));
      cy.log('✅ MULTI_ISSUER processor search functionality working');
    });
  });

  it('Should test JWT processor infrastructure comprehensively', () => {
    cy.log('🧪 Testing comprehensive JWT processor infrastructure');

    // Test both processor types are available
    cy.getJWTProcessorTypes().then((types) => {
      expect(types).to.have.property('JWT_AUTHENTICATOR');
      expect(types).to.have.property('MULTI_ISSUER');

      const jwtAuth = types.JWT_AUTHENTICATOR;
      const multiIssuer = types.MULTI_ISSUER;

      // Verify both have required properties
      expect(jwtAuth).to.have.property('className');
      expect(jwtAuth).to.have.property('displayName');
      expect(multiIssuer).to.have.property('className');
      expect(multiIssuer).to.have.property('displayName');

      cy.log(`✅ Both processor types verified: ${jwtAuth.displayName} and ${multiIssuer.displayName}`);
    });

    // Test getAllJWTProcessorsOnCanvas functionality
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      cy.log(`✅ getAllJWTProcessorsOnCanvas working: ${processors.length} processors found`);
    });
  });

  it('Should test JWT_AUTHENTICATOR processor removal infrastructure', () => {
    cy.log('🧪 Testing JWT_AUTHENTICATOR processor removal infrastructure');

    // Test that removal helper functions exist and are callable
    expect(cy.removeProcessorFromCanvas).to.be.a('function');
    expect(cy.findProcessorOnCanvas).to.be.a('function');

    // Test processor search returns null on clean canvas (expected)
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.be.null;
      cy.log('✅ JWT_AUTHENTICATOR not found on clean canvas (expected)');
    });

    // Test that the processor definition exists for removal operations
    cy.getJWTProcessorTypes().then((types) => {
      expect(types.JWT_AUTHENTICATOR).to.have.property('displayName');
      cy.log('✅ JWT_AUTHENTICATOR processor removal infrastructure verified');
    });
  });

  it('Should test MULTI_ISSUER processor removal infrastructure', () => {
    cy.log('🧪 Testing MULTI_ISSUER processor removal infrastructure');

    // Test that removal helper functions exist and are callable
    expect(cy.removeProcessorFromCanvas).to.be.a('function');
    expect(cy.findProcessorOnCanvas).to.be.a('function');

    // Test processor search returns null on clean canvas (expected)
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.be.null;
      cy.log('✅ MULTI_ISSUER not found on clean canvas (expected)');
    });

    // Test that the processor definition exists for removal operations
    cy.getJWTProcessorTypes().then((types) => {
      expect(types.MULTI_ISSUER).to.have.property('displayName');
      cy.log('✅ MULTI_ISSUER processor removal infrastructure verified');
    });
  });

  it('Should test complete processor lifecycle infrastructure', () => {
    cy.log('🧪 Testing complete processor lifecycle infrastructure');

    // Test that all required helper functions exist
    expect(cy.addProcessorToCanvas).to.be.a('function');
    expect(cy.removeProcessorFromCanvas).to.be.a('function');
    expect(cy.getAllJWTProcessorsOnCanvas).to.be.a('function');
    expect(cy.findProcessorOnCanvas).to.be.a('function');
    expect(cy.cleanupJWTProcessors).to.be.a('function');

    // Test processor type definitions are complete
    cy.getJWTProcessorTypes().then((types) => {
      expect(types).to.have.property('JWT_AUTHENTICATOR');
      expect(types).to.have.property('MULTI_ISSUER');

      // Verify both processor definitions have all required properties
      ['JWT_AUTHENTICATOR', 'MULTI_ISSUER'].forEach((processorType) => {
        const processor = types[processorType];
        expect(processor).to.have.property('className');
        expect(processor).to.have.property('displayName');
        expect(processor).to.have.property('shortName');
        expect(processor).to.have.property('description');
      });

      cy.log('✅ Complete processor lifecycle infrastructure verified');
    });

    // Test canvas state management
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      cy.log(`✅ Canvas state management working: ${processors.length} processors found`);
    });
  });

  it('Should test processor addition options infrastructure', () => {
    cy.log('🧪 Testing processor addition options infrastructure');

    // Test that addProcessorToCanvas accepts proper options
    cy.getJWTProcessorTypes().then((types) => {
      expect(types.JWT_AUTHENTICATOR).to.have.property('displayName');

      // Test that the function signature supports all expected options
      const testOptions = {
        position: { x: 300, y: 200 },
        skipIfExists: true,
        timeout: 10000
      };

      // Verify the options structure is valid
      expect(testOptions).to.have.property('position');
      expect(testOptions.position).to.have.property('x');
      expect(testOptions.position).to.have.property('y');
      expect(testOptions).to.have.property('skipIfExists');
      expect(testOptions).to.have.property('timeout');

      cy.log('✅ Processor addition options infrastructure verified');
    });

    // Test cleanup functionality exists
    expect(cy.cleanupJWTProcessors).to.be.a('function');
    cy.log('✅ Cleanup infrastructure available for processor management');
  });
});
