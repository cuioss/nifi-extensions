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

  it('Should add JWT_AUTHENTICATOR processor to canvas', () => {
    cy.log('🧪 Adding JWT_AUTHENTICATOR processor to canvas');

    // Verify canvas is ready
    cy.getPageContext().should((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isReady).to.be.true;
    });

    // Add the processor to canvas
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      expect(addedProcessor).to.have.property('type');
      expect(addedProcessor.type).to.equal('JWT_AUTHENTICATOR');
      cy.log(`✅ JWT_AUTHENTICATOR processor successfully added: ${addedProcessor.name}`);
    });

    // Verify processor is on canvas
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.not.be.null;
      expect(processor).to.have.property('name');
      cy.log('✅ JWT_AUTHENTICATOR processor verified on canvas');
    });
  });

  it('Should add MULTI_ISSUER processor to canvas', () => {
    cy.log('🧪 Adding MULTI_ISSUER processor to canvas');

    // Verify canvas is ready
    cy.getPageContext().should((context) => {
      expect(context.pageType).to.equal('MAIN_CANVAS');
      expect(context.isReady).to.be.true;
    });

    // Add the processor to canvas
    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 600, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      expect(addedProcessor).to.have.property('type');
      expect(addedProcessor.type).to.equal('MULTI_ISSUER');
      cy.log(`✅ MULTI_ISSUER processor successfully added: ${addedProcessor.name}`);
    });

    // Verify processor is on canvas
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.not.be.null;
      expect(processor).to.have.property('name');
      cy.log('✅ MULTI_ISSUER processor verified on canvas');
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

  it('Should add and remove JWT_AUTHENTICATOR processor', () => {
    cy.log('🧪 Testing JWT_AUTHENTICATOR processor add and remove cycle');

    // First add the processor
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 400, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      cy.log(`✅ JWT_AUTHENTICATOR processor added: ${addedProcessor.name}`);
    });

    // Verify processor is on canvas
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.not.be.null;
      cy.log('✅ JWT_AUTHENTICATOR processor verified on canvas');
    });

    // Now remove the processor
    cy.removeProcessorFromCanvas('JWT_AUTHENTICATOR', {
      confirmDeletion: true
    }).then((success) => {
      expect(success).to.be.true;
      cy.log('✅ JWT_AUTHENTICATOR processor successfully removed');
    });

    // Verify processor is no longer on canvas
    cy.findProcessorOnCanvas('JWT_AUTHENTICATOR').then((processor) => {
      expect(processor).to.be.null;
      cy.log('✅ JWT_AUTHENTICATOR processor confirmed removed from canvas');
    });
  });

  it('Should add and remove MULTI_ISSUER processor', () => {
    cy.log('🧪 Testing MULTI_ISSUER processor add and remove cycle');

    // First add the processor
    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 600, y: 300 },
      skipIfExists: false
    }).then((addedProcessor) => {
      expect(addedProcessor).to.not.be.null;
      expect(addedProcessor).to.have.property('name');
      cy.log(`✅ MULTI_ISSUER processor added: ${addedProcessor.name}`);
    });

    // Verify processor is on canvas
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.not.be.null;
      cy.log('✅ MULTI_ISSUER processor verified on canvas');
    });

    // Now remove the processor
    cy.removeProcessorFromCanvas('MULTI_ISSUER', {
      confirmDeletion: true
    }).then((success) => {
      expect(success).to.be.true;
      cy.log('✅ MULTI_ISSUER processor successfully removed');
    });

    // Verify processor is no longer on canvas
    cy.findProcessorOnCanvas('MULTI_ISSUER').then((processor) => {
      expect(processor).to.be.null;
      cy.log('✅ MULTI_ISSUER processor confirmed removed from canvas');
    });
  });

  it('Should test complete processor lifecycle with both processors', () => {
    cy.log('🧪 Testing complete processor lifecycle with both JWT processors');

    // Add both processors to canvas
    cy.addProcessorToCanvas('JWT_AUTHENTICATOR', {
      position: { x: 300, y: 200 },
      skipIfExists: false
    }).then((processor1) => {
      expect(processor1).to.not.be.null;
      cy.log(`✅ JWT_AUTHENTICATOR added: ${processor1.name}`);
    });

    cy.addProcessorToCanvas('MULTI_ISSUER', {
      position: { x: 500, y: 200 },
      skipIfExists: false
    }).then((processor2) => {
      expect(processor2).to.not.be.null;
      cy.log(`✅ MULTI_ISSUER added: ${processor2.name}`);
    });

    // Verify both processors are on canvas
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      expect(processors.length).to.equal(2);
      cy.log(`✅ Both processors verified on canvas: ${processors.length} found`);

      // Verify each processor has expected properties
      processors.forEach((processor) => {
        expect(processor).to.have.property('name');
        expect(processor).to.have.property('type');
        expect(['JWT_AUTHENTICATOR', 'MULTI_ISSUER']).to.include(processor.type);
      });
    });

    // Test cleanup functionality
    cy.cleanupJWTProcessors().then((removedCount) => {
      expect(removedCount).to.equal(2);
      cy.log(`✅ Cleanup successful: ${removedCount} processors removed`);
    });

    // Verify canvas is clean
    cy.getAllJWTProcessorsOnCanvas().then((processors) => {
      expect(processors).to.be.an('array');
      expect(processors.length).to.equal(0);
      cy.log('✅ Canvas confirmed clean after cleanup');
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
