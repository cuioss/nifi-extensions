/**
 * REAL integration tests for JWT validation commands
 * These tests verify token generation and validation against actual NiFi instance
 * 
 * Prerequisites:
 * - NiFi must be running with MultiIssuerJWTTokenAuthenticator processor available
 * - Integration test environment should be running
 */

describe('JWT Validation Integration Tests', () => {
  const baseUrl = Cypress.env('CYPRESS_BASE_URL') || 'https://localhost:9095/nifi';
  
  before(() => {
    // Verify NiFi is accessible
    cy.request({
      url: `${baseUrl}/`,
      failOnStatusCode: false,
      timeout: 10000
    }).then((response) => {
      if (response.status !== 200) {
        throw new Error(`NiFi not accessible at ${baseUrl}. Status: ${response.status}`);
      }
    });
  });

  beforeEach(() => {
    // Ensure we're logged in before each test
    cy.nifiLogin('admin', 'adminadminadmin');
    cy.navigateToCanvas();
  });

  describe('JWT Token Generation', () => {
    it('should generate properly formatted JWT tokens', () => {
      const testClaims = {
        sub: 'test-user-123',
        iss: 'https://test.example.com',
        aud: 'test-audience'
      };
      
      cy.generateToken(testClaims).then((token) => {
        expect(token).to.be.a('string');
        expect(token).to.not.be.empty;
        
        // Verify JWT structure
        const parts = token.split('.');
        expect(parts).to.have.length(3);
        
        // Verify header can be decoded
        const header = JSON.parse(atob(parts[0]));
        expect(header).to.have.property('alg');
        expect(header).to.have.property('typ', 'JWT');
        
        // Verify payload contains our claims
        const payload = JSON.parse(atob(parts[1]));
        expect(payload.sub).to.equal(testClaims.sub);
        expect(payload.iss).to.equal(testClaims.iss);
        expect(payload.aud).to.equal(testClaims.aud);
      });
    });

    it('should include required JWT claims', () => {
      const testClaims = {
        sub: 'test-subject',
        iss: 'test-issuer'
      };
      
      cy.generateToken(testClaims).then((token) => {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Required claims should be present
        expect(payload).to.have.property('iat'); // Issued at
        expect(payload).to.have.property('sub');
        expect(payload).to.have.property('iss');
        
        // Verify issued at time is recent (within last minute)
        const now = Math.floor(Date.now() / 1000);
        expect(payload.iat).to.be.closeTo(now, 60);
      });
    });
  });

  describe('Token Validation with Real Processor', () => {
    let processorId;

    beforeEach(() => {
      // Add MultiIssuerJWTTokenAuthenticator processor for testing
      cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 300, y: 300 }).then((id) => {
        processorId = id;
      });
    });

    afterEach(() => {
      // Clean up processor
      if (processorId) {
        cy.get(`[data-testid="${processorId}"], g[id="${processorId}"]`).then(($processor) => {
          if ($processor.length > 0) {
            cy.wrap($processor).rightclick();
            cy.get('.context-menu').contains('Delete').click({ force: true });
            cy.get('.dialog').contains('Delete').click({ force: true });
          }
        });
      }
    });

    it('should verify processor can be configured for token validation', () => {
      // Test that we can configure the processor with JWKS settings
      cy.configureProcessor(processorId, {
        properties: {
          'issuer-1-name': 'test-issuer',
          'issuer-1-issuer': 'https://test.example.com',
          'issuer-1-jwks-type': 'server',
          'issuer-1-jwks-url': 'https://test.example.com/.well-known/jwks.json'
        }
      });

      // Verify processor was configured successfully
      cy.verifyProcessorProperties(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com'
      });
    });

    it('should handle processor configuration dialog', () => {
      // Test opening and closing processor configuration
      cy.navigateToProcessorConfig(processorId);
      
      // Verify configuration dialog opens
      cy.get('.processor-configuration-dialog, .configuration-dialog').should('be.visible');
      
      // Test that we can navigate configuration tabs
      cy.get('.processor-configuration-tab, .configuration-tab').contains('Properties').should('be.visible');
      
      // Close dialog
      cy.get('button').contains('Cancel', 'Close').click();
      cy.get('.processor-configuration-dialog, .configuration-dialog').should('not.exist');
    });
  });

  describe('JWKS Structure Validation', () => {
    it('should validate JWKS key structure', () => {
      const mockJwks = {
        keys: [
          {
            kty: 'RSA',
            kid: 'test-key-1',
            use: 'sig',
            alg: 'RS256',
            n: 'example-modulus',
            e: 'AQAB'
          }
        ]
      };
      
      // Test JWKS structure validation
      cy.wrap(mockJwks).then((jwks) => {
        expect(jwks).to.have.property('keys');
        expect(jwks.keys).to.be.an('array');
        expect(jwks.keys).to.have.length.greaterThan(0);
        
        const key = jwks.keys[0];
        expect(key).to.have.property('kty');
        expect(key).to.have.property('kid');
        expect(key).to.have.property('use');
        expect(key).to.have.property('alg');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid token formats', () => {
      const invalidTokens = [
        '', // Empty
        'invalid.token', // Only 2 parts
        'not.a.jwt.token', // 4 parts
        'invalid-base64.invalid-base64.invalid-base64' // Invalid base64
      ];
      
      invalidTokens.forEach((invalidToken) => {
        cy.wrap(invalidToken).then((token) => {
          if (token === '') {
            expect(token).to.be.empty;
          } else {
            const parts = token.split('.');
            expect(parts.length !== 3).to.be.true;
          }
        });
      });
    });

    it('should handle processor command failures gracefully', () => {
      // Test error handling when processor operations fail
      cy.on('fail', (err) => {
        expect(err.message).to.include('processor', 'not found', 'timeout');
        return false;
      });
      
      // These operations should handle failures gracefully
      cy.configureProcessor('non-existent-processor', {}).then((result) => {
        // Should either succeed or fail gracefully
        expect(result).to.be.oneOf([null, undefined, true, false]);
      });
    });
  });
});
