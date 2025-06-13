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
    cy.cleanupAllProcessors();
  });

  it('should detect unconfigured processor', () => {
    // Add a processor without configuration
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        // Check if processor is configured (should not be)
        cy.isProcessorConfigured(processorId).then((isConfigured) => {
          expect(isConfigured).to.be.false;
        });
      }
    });
  });

  it('should detect configured processor', () => {
    // Add and configure a processor
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator').then((processorId) => {
      if (processorId) {
        const testConfig = {
          name: 'Test JWT Authenticator',
          properties: {
            'Issuer URL': 'https://test.example.com',
            'Audience': 'test-audience'
          }
        };

        // Configure the processor
        cy.configureProcessor(processorId, testConfig);

        // Check if processor is now configured
        cy.isProcessorConfigured(processorId, testConfig).then((isConfigured) => {
          expect(isConfigured).to.be.true;
        });
      }
    });
  });

  it('should extract processor information correctly', () => {
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        cy.getProcessorElement(processorId).then(($element) => {
          const processorInfo = cy.extractProcessorInfo($element);
          
          // Verify extracted information
          expect(processorInfo).to.have.property('id');
          expect(processorInfo).to.have.property('name');
          expect(processorInfo).to.have.property('type');
          expect(processorInfo).to.have.property('state');
        });
      }
    });
  });

  it('should inspect processor properties', () => {
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        // Configure processor with specific properties
        const testProperties = {
          'File Size': '1024B',
          'Batch Size': '5'
        };

        cy.configureProcessor(processorId, { properties: testProperties });

        // Inspect properties
        cy.inspectProcessorProperties(processorId).then((properties) => {
          expect(properties).to.be.an('object');
          // Properties should contain some configuration data
          expect(Object.keys(properties).length).to.be.greaterThan(0);
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
      cy.getProcessorByReference(processorRef).should('exist');
    });
  });

  it('should find processors using improved discovery', () => {
    cy.addProcessor('LogAttribute').then((processorId) => {
      if (processorId) {
        // Test improved discovery mechanism
        cy.findProcessorElement(processorId).should('exist');
        
        // Test that it can find processors even with partial IDs
        const partialId = processorId.substring(0, 8);
        cy.findProcessorElement(partialId).should('exist');
      }
    });
  });

  it('should detect processor setup status', () => {
    cy.addProcessor('UpdateAttribute').then((processorId) => {
      if (processorId) {
        cy.getProcessorElement(processorId).then(($element) => {
          const hasSetup = cy.detectProcessorSetup($element);
          
          // Initially should have basic setup (no errors)
          expect(hasSetup).to.be.true;
        });
      }
    });
  });

  it('should compare processor properties correctly', () => {
    const currentProperties = {
      'File Size': '1024B',
      'Batch Size': '10',
      'Custom Text': 'Hello World'
    };

    const expectedProperties = {
      'File Size': '1024B',
      'Batch Size': '10'
    };

    const result = cy.compareProcessorProperties(currentProperties, expectedProperties);
    expect(result).to.be.true;

    // Test mismatch
    const mismatchedProperties = {
      'File Size': '2048B'
    };

    const mismatchResult = cy.compareProcessorProperties(currentProperties, mismatchedProperties);
    expect(mismatchResult).to.be.false;
  });

  it('should handle multiple processor workflow', () => {
    const processors = [];
    
    // Create multiple processors with references
    cy.createProcessorReference('GenerateFlowFile', { x: 200, y: 200 }).then((ref1) => {
      processors.push(ref1);
      
      cy.createProcessorReference('UpdateAttribute', { x: 400, y: 200 }).then((ref2) => {
        processors.push(ref2);
        
        cy.createProcessorReference('LogAttribute', { x: 600, y: 200 }).then((ref3) => {
          processors.push(ref3);
          
          // Verify all processors exist and can be found
          processors.forEach((ref) => {
            cy.getProcessorByReference(ref).should('exist');
            cy.isProcessorConfigured(ref.id).then((isConfigured) => {
              // Should be able to detect configuration status
              expect(isConfigured).to.be.a('boolean');
            });
          });
        });
      });
    });
  });

  it('should handle processor state detection', () => {
    cy.addProcessor('GenerateFlowFile').then((processorId) => {
      if (processorId) {
        cy.getProcessorElement(processorId).then(($element) => {
          const state = cy.getProcessorState($element);
          
          // Should return a valid state
          expect(['RUNNING', 'STOPPED', 'INVALID', 'DISABLED', 'UNKNOWN']).to.include(state);
        });
      }
    });
  });
});
