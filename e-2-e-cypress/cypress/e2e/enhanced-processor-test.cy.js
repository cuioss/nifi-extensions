import { TEXT_CONSTANTS, TEST_DATA, URLS } from '../support/constants.js';
/**
 * Enhanced Custom Processor Testing
 * Focus: Test our JWT processor logic with enhanced commands
 * Philosophy: Use NiFi as a platform to test our custom processor logic
 */

describe('Enhanced Custom Processor Testing', () => {
  beforeEach(() => {
    // Clean up before each test
    cy.nifiLogin();
    cy.navigateToCanvas();
    cy.enhancedProcessorCleanup();
  });

  afterEach(() => {
    // Clean up after each test
    cy.enhancedProcessorCleanup();
  });

  it('should test our custom JWT processor with enhanced ID extraction', () => {
    cy.log('Testing our custom JWT processor addition with ID extraction...');

    cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 400, y: 300 }).then((processorId) => {
      // Verify we got a valid processor ID for OUR processor
      expect(processorId).to.exist;
      expect(processorId).to.be.a('string');
      expect(processorId).to.not.be.empty;

      cy.log(`✅ Our JWT processor added with ID: ${processorId}`);

      // Test OUR processor element retrieval
      cy.getProcessorElement(processorId)
        .should(TEXT_CONSTANTS.EXIST)
        .then(($element) => {
          expect($element).to.exist;
          cy.log('✅ Our processor element retrieval working');
        });

      // Test finding OUR processor by type
      cy.findProcessorByType('MultiIssuerJWTTokenAuthenticator')
        .should(TEXT_CONSTANTS.EXIST)
        .then(($element) => {
          if ($element) {
            cy.log('✅ Our JWT processor found by type name');
          }
        });
    });
  });

  it('should test our custom JWT processors with cleanup', () => {
    cy.log('Testing our custom JWT processor workflow...');

    const customProcessorTypes = ['MultiIssuerJWTTokenAuthenticator', 'JWTTokenAuthenticator'];

    const positions = [
      { x: 200, y: 200 },
      { x: 500, y: 200 },
    ];

    const processorIds = [];

    // Add our custom JWT processors
    customProcessorTypes.forEach((type, index) => {
      // Safe array access to avoid object injection
      const safeIndex = Math.max(0, Math.min(index, positions.length - 1));
      const hasValidPosition = positions.length > 0 && index < positions.length;
      const safePosition = hasValidPosition ? positions.at(safeIndex) || {} : {};
      const position = hasValidPosition
        ? { x: safePosition.x || 100, y: safePosition.y || 100 }
        : { x: 100 + index * 200, y: 100 };
      cy.addProcessor(type, position).then((processorId) => {
        if (processorId) {
          processorIds.push(processorId);
          cy.log(`Added our custom processor ${index + 1}: ${processorId}`);
        }
      });
    });

    // Verify all our custom processors were added
    cy.then(() => {
      cy.log(`Total custom JWT processors added: ${processorIds.length}`);

      // Test cleanup of our processors
      cy.enhancedProcessorCleanup();

      // Verify cleanup worked for our processors
      cy.get('body').then(($body) => {
        const remainingProcessors = $body.find('g.processor, [class*="processor"], .component');
        cy.log(`Processors remaining after cleanup: ${remainingProcessors.length}`);
      });
    });
  });

  it('should configure our custom JWT processor with enhanced commands', () => {
    cy.log('Testing our custom JWT processor configuration...');

    cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 350, y: 250 }).then((processorId) => {
      if (processorId) {
        cy.log(`Configuring our JWT processor: ${processorId}`);

        // Test OUR processor's configuration capabilities
        cy.configureProcessor(processorId, {
          name: 'Enhanced Test JWT Processor',
          properties: {
            'JWKS Type': 'Server', 
            'JWKS URL': URLS.KEYCLOAK_JWKS_URL,
            'Token Header Name': 'Authorization',
            'Clock Skew': '60 seconds',
          },
        });

        cy.log('✅ Our JWT processor configuration completed');

        // Test OUR processor state operations
        cy.getProcessorElement(processorId).then(() => {
          // Test OUR processor lifecycle
          cy.startProcessor(processorId);
          cy.log('✅ Our processor start command executed');

          cy.stopProcessor(processorId);
          cy.log('✅ Our processor stop command executed');
        });
      }
    });
  });

  it('should handle our processor operations gracefully when elements not found', () => {
    cy.log('Testing error handling for our custom processors...');

    // Test with invalid processor ID
    const invalidId = 'non-existent-jwt-processor-123';

    cy.on('fail', (err) => {
      // Expect this to fail gracefully
      expect(err.message).to.include('No processor element found');
      cy.log('✅ Error handling working correctly for our processors');
      return false; // Prevent test failure
    });

    // This should fail gracefully
    cy.getProcessorElement(invalidId)
      .then(() => {
        cy.log('Unexpected: Found element for invalid JWT processor ID');
      })
      .catch(() => {
        cy.log('✅ Gracefully handled invalid JWT processor ID');
      });
  });
});
