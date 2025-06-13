/**
 * Metrics and Statistics Test Scenarios
 * CUI Standards Compliant
 */

import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from '../constants.js';

// Phase 5.1: Metrics and Statistics Tests
// End-to-End tests for processor metrics display and verification

describe('Processor Metrics and Statistics Tests', () => {
  let processorId;

  beforeEach(() => {
    // Navigate to NiFi canvas and login
    cy.nifiLogin();
    cy.navigateToCanvas();

    // Add a MultiIssuerJWTTokenAuthenticator processor for testing
    cy.addProcessor('MultiIssuerJWTTokenAuthenticator', { x: 100, y: 100 }).then((id) => {
      processorId = id;
    });
  });

  afterEach(() => {
    // Clean up processor after each test
    if (processorId) {
      cy.removeProcessor(processorId);
    }
  });

  describe('Metrics Display Verification', () => {
    it('should display metrics in processor status', () => {
      // Configure processor with basic issuer
      cy.configureProcessor(processorId, {
        'issuer-1-name': TEST_DATA.TEST_ISSUER_NAME,
        'issuer-1-issuer': TEST_DATA.TEST_ISSUER_URL,
        'issuer-1-jwks-type': TEST_DATA.TEST_JWKS_TYPE,
        'issuer-1-jwks-url': TEST_DATA.TEST_JWKS_URL,
      });

      // Start the processor
      cy.startProcessor(processorId);

      // Wait for processor to be running
      cy.verifyProcessorState(processorId, TEST_DATA.RUNNING);

      // Check that metrics are displayed in the processor status
      cy.getProcessorElement(processorId)
        .find('.processor-status')
        .should('contain.text', TEST_DATA.PROCESSED)
        .should('contain.text', TEST_DATA.VALID)
        .should('contain.text', TEST_DATA.INVALID);

      // Verify initial metrics show zero counts
      cy.getProcessorElement(processorId)
        .find('.processor-status')
        .should('contain.text', TEST_DATA.PROCESSED_ZERO)
        .should('contain.text', 'Valid: 0')
        .should('contain.text', 'Invalid: 0');
    });

    it('should show detailed metrics in processor details pane', () => {
      // Configure and start processor
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      // Click on processor to select it
      cy.getProcessorElement(processorId).click();

      // Verify processor details pane shows metrics
      cy.get('[data-testid="processor-details-pane"]', { timeout: 10000 }).should('be.visible');

      // Check detailed metrics display
      cy.get('[data-testid="processor-details-metrics"]')
        .should('contain.text', 'Tokens Processed')
        .should('contain.text', 'Valid Tokens')
        .should('contain.text', 'Invalid Tokens')
        .should('contain.text', 'Malformed')
        .should('contain.text', 'Expired')
        .should('contain.text', 'Invalid Signature');
    });

    it('should display metrics in configuration dialog metrics tab', () => {
      // Open processor configuration dialog
      cy.openProcessorConfigDialog(processorId);

      // Navigate to the Metrics tab
      cy.get('[data-testid="config-dialog-tabs"]').find('[data-tab="metrics"]').click();

      // Verify metrics tab content
      cy.get('[data-testid="metrics-tab-content"]')
        .should('be.visible')
        .should('contain.text', 'Security Event Metrics')
        .should('contain.text', 'Total Processed Tokens')
        .should('contain.text', 'Valid Tokens')
        .should('contain.text', 'Invalid Tokens');

      // Check for percentage calculations
      cy.get('[data-testid="metrics-percentages"]').should('contain.text', '%');

      // Verify Reset Metrics button is present
      cy.get('[data-testid="reset-metrics-button"]')
        .should('be.visible')
        .should('contain.text', 'Reset Metrics');
    });
  });

  describe('Metrics Functionality Tests', () => {
    it('should update metrics after token processing', () => {
      // Configure processor with test issuer
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Generate a test token and send it through the processor
      cy.generateValidToken('test-issuer').then((token) => {
        cy.sendTokenToProcessor(processorId, token);
      });

      // Wait for processing and check updated metrics
      // Loading wait removed - using proper element readiness checks;

      cy.getProcessorElement(processorId)
        .find('.processor-status')
        .should('contain.text', 'Processed: 1')
        .should('contain.text', 'Valid: 1');
    });

    it('should track invalid token metrics correctly', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Send various invalid tokens
      cy.sendTokenToProcessor(processorId, 'invalid.token.format');
      cy.sendTokenToProcessor(processorId, 'expired.jwt.token');
      cy.sendTokenToProcessor(processorId, 'malformed-token');

      // Loading wait removed - using proper element readiness checks;

      // Verify invalid token metrics are updated
      cy.getProcessorElement(processorId)
        .find('.processor-status')
        .should('contain.text', 'Processed: 3')
        .should('contain.text', 'Invalid: 3');

      // Check detailed breakdown in processor details
      cy.getProcessorElement(processorId).click();

      cy.get('[data-testid="processor-details-metrics"]')
        .should('contain.text', 'Malformed: 1')
        .should('contain.text', 'Expired: 1')
        .should('contain.text', 'Invalid Signature: 1');
    });

    it('should reset metrics when reset button is clicked', () => {
      // Configure and process some tokens first
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Process some tokens to generate metrics
      cy.generateValidToken('test-issuer').then((token) => {
        cy.sendTokenToProcessor(processorId, token);
        cy.sendTokenToProcessor(processorId, 'invalid.token');
      });

      // Loading wait removed - using proper element readiness checks;

      // Verify metrics are non-zero
      cy.getProcessorElement(processorId)
        .find('.processor-status')
        .should('contain.text', 'Processed: 2');

      // Open metrics tab and reset metrics
      cy.openProcessorConfigDialog(processorId);
      cy.get('[data-tab="metrics"]').click();

      cy.get('[data-testid="reset-metrics-button"]').click();

      // Confirm reset dialog
      cy.get('[data-testid="confirm-reset-dialog"]').should('be.visible');

      cy.get('[data-testid="confirm-reset-button"]').click();

      // Close config dialog
      cy.get('[data-testid="config-dialog-close"]').click();

      // Verify metrics are reset to zero
      cy.getProcessorElement(processorId)
        .find('.processor-status')
        .should('contain.text', 'Processed: 0')
        .should('contain.text', 'Valid: 0')
        .should('contain.text', 'Invalid: 0');
    });
  });

  describe('Metrics API Integration Tests', () => {
    it('should retrieve metrics via API endpoint', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      // Test API metrics endpoint
      cy.request({
        method: 'GET',
        url: `/nifi-api/processors/${processorId}/metrics`,
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('totalValidations');
        expect(response.body).to.have.property('successfulValidations');
        expect(response.body).to.have.property('failedValidations');
        expect(response.body).to.have.property('issuerMetrics');
        expect(response.body).to.have.property('recentErrors');
        expect(response.body).to.have.property('averageResponseTime');
      });
    });

    it('should provide Prometheus-compatible metrics', () => {
      // Test Prometheus metrics endpoint
      cy.request({
        method: 'GET',
        url: '/nifi-api/metrics/prometheus',
        headers: {
          Accept: 'text/plain',
        },
      }).then((response) => {
        expect(response.status).to.eq(200);

        // Verify Prometheus format metrics are present
        expect(response.body).to.include('jwt_processor_total_processed_tokens');
        expect(response.body).to.include('jwt_processor_valid_tokens');
        expect(response.body).to.include('jwt_processor_invalid_tokens');

        // Check component-specific labels
        expect(response.body).to.include(`component_id="${processorId}"`);
        expect(response.body).to.include('component_type="MultiIssuerJWTTokenAuthenticator"');
      });
    });
  });

  describe('Performance Metrics Tests', () => {
    it('should track average response time metrics', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Process multiple tokens to generate timing data
      for (let i = 0; i < 5; i++) {
        cy.generateValidToken('test-issuer').then((token) => {
          cy.sendTokenToProcessor(processorId, token);
        });
      }

      cy.wait(3000);

      // Check that response time metrics are tracked
      cy.openProcessorConfigDialog(processorId);
      cy.get('[data-tab="metrics"]').click();

      cy.get('[data-testid="performance-metrics"]')
        .should('contain.text', 'Average Response Time')
        .should('contain.text', 'ms');

      // Verify response time is a reasonable value (> 0 and < 1000ms for test)
      cy.get('[data-testid="avg-response-time"]')
        .invoke('text')
        .then((text) => {
          const responseTime = parseInt(text.replace(/[^\d]/g, ''));
          expect(responseTime).to.be.greaterThan(0);
          expect(responseTime).to.be.lessThan(1000);
        });
    });

    it('should display issuer-specific metrics', () => {
      // Configure processor with multiple issuers
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'issuer-a',
        'issuer-1-issuer': 'https://issuer-a.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://issuer-a.example.com/jwks.json',
        'issuer-2-name': 'issuer-b',
        'issuer-2-issuer': 'https://issuer-b.example.com',
        'issuer-2-jwks-type': 'server',
        'issuer-2-jwks-url': 'https://issuer-b.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Send tokens from different issuers
      cy.generateValidToken('issuer-a').then((token) => {
        cy.sendTokenToProcessor(processorId, token);
      });

      cy.generateValidToken('issuer-b').then((token) => {
        cy.sendTokenToProcessor(processorId, token);
        cy.sendTokenToProcessor(processorId, token); // Send twice for issuer-b
      });

      // Loading wait removed - using proper element readiness checks;

      // Check issuer-specific metrics in UI
      cy.openProcessorConfigDialog(processorId);
      cy.get('[data-tab="metrics"]').click();

      cy.get('[data-testid="issuer-metrics"]')
        .should('contain.text', 'issuer-a')
        .should('contain.text', 'issuer-b');

      // Verify per-issuer counts
      cy.get('[data-testid="issuer-a-count"]').should('contain.text', '1');

      cy.get('[data-testid="issuer-b-count"]').should('contain.text', '2');
    });
  });

  describe('Error Metrics Monitoring', () => {
    it('should track recent validation errors', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Send various types of invalid tokens
      cy.sendTokenToProcessor(processorId, 'malformed-token');
      cy.sendTokenToProcessor(processorId, 'expired.jwt.token');
      cy.sendTokenToProcessor(processorId, 'invalid.signature.token');

      // Loading wait removed - using proper element readiness checks;

      // Check recent errors in metrics tab
      cy.openProcessorConfigDialog(processorId);
      cy.get('[data-tab="metrics"]').click();

      cy.get('[data-testid="recent-errors"]')
        .should('be.visible')
        .should('contain.text', 'Recent Validation Errors');

      // Verify error details are shown
      cy.get('[data-testid="error-list"]').find('.error-item').should('have.length.at.least', 3);

      // Check error categories are displayed
      cy.get('[data-testid="error-list"]')
        .should('contain.text', 'Malformed Token')
        .should('contain.text', 'Expired Token')
        .should('contain.text', 'Invalid Signature');
    });

    it('should categorize errors correctly', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        'issuer-1-name': 'test-issuer',
        'issuer-1-issuer': 'https://test.example.com',
        'issuer-1-jwks-type': 'server',
        'issuer-1-jwks-url': 'https://test.example.com/jwks.json',
      });

      cy.startProcessor(processorId);

      // Send specific error types
      cy.sendTokenToProcessor(processorId, 'not.a.jwt.token'); // Malformed
      cy.sendExpiredToken(processorId); // Expired
      cy.sendTokenWithInvalidSignature(processorId); // Invalid signature
      cy.sendTokenWithMissingClaims(processorId); // Missing claims

      cy.wait(3000);

      // Verify error categorization in metrics
      cy.openProcessorConfigDialog(processorId);
      cy.get('[data-tab="metrics"]').click();

      cy.get('[data-testid="error-breakdown"]')
        .should('contain.text', 'Malformed: 1')
        .should('contain.text', 'Expired: 1')
        .should('contain.text', 'Invalid Signature: 1')
        .should('contain.text', 'Missing Claims: 1');
    });
  });
});
