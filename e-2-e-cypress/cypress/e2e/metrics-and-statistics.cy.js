/**
 * Metrics and Statistics Test Scenarios
 * CUI Standards Compliant
 */

import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from '../support/constants.js';

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
        [TEST_DATA.ISSUER_1_NAME]: TEST_DATA.TEST_ISSUER_NAME,
        [TEST_DATA.ISSUER_1_ISSUER]: TEST_DATA.TEST_ISSUER_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEST_DATA.TEST_JWKS_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEST_DATA.TEST_JWKS_URL,
      });

      // Start the processor
      cy.startProcessor(processorId);

      // Wait for processor to be running
      cy.verifyProcessorState(processorId, TEST_DATA.RUNNING);

      // Check that metrics are displayed in the processor status
      cy.getProcessorElement(processorId)
        .find(SELECTORS.PROCESSOR_STATUS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.PROCESSED)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.VALID)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.INVALID);

      // Verify initial metrics show zero counts
      cy.getProcessorElement(processorId)
        .find(SELECTORS.PROCESSOR_STATUS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.PROCESSED_ZERO)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.VALID_ZERO)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.INVALID_ZERO);
    });

    it('should show detailed metrics in processor details pane', () => {
      // Configure and start processor
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      // Click on processor to select it
      cy.getProcessorElement(processorId).click();

      // Verify processor details pane shows metrics
      cy.get(TEXT_CONSTANTS.PROCESSOR_DETAILS_PANE, { timeout: 10000 }).should(
        TEXT_CONSTANTS.BE_VISIBLE
      );

      // Check detailed metrics display
      cy.get(SELECTORS.PROCESSOR_DETAILS_METRICS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.TOKENS_PROCESSED)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.VALID_TOKENS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.INVALID_TOKENS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.MALFORMED)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.EXPIRED)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.INVALID_SIGNATURE);
    });

    it('should display metrics in configuration dialog metrics tab', () => {
      // Open processor configuration dialog
      cy.openProcessorConfigDialog(processorId);

      // Navigate to the Metrics tab
      cy.get(SELECTORS.CONFIG_DIALOG_TABS).find(SELECTORS.METRICS_TAB).click();

      // Verify metrics tab content
      cy.get(SELECTORS.METRICS_TAB_CONTENT)
        .should(TEXT_CONSTANTS.BE_VISIBLE)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.SECURITY_EVENT_METRICS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.TOTAL_PROCESSED_TOKENS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.VALID_TOKENS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.INVALID_TOKENS);

      // Check for percentage calculations
      cy.get(SELECTORS.METRICS_PERCENTAGES).should(
        TEXT_CONSTANTS.CONTAIN_TEXT,
        TEST_DATA.PERCENTAGE_SYMBOL
      );

      // Verify Reset Metrics button is present
      cy.get(SELECTORS.RESET_METRICS_BUTTON)
        .should('be.visible')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.RESET_METRICS);
    });
  });

  describe('Metrics Functionality Tests', () => {
    it('should update metrics after token processing', () => {
      // Configure processor with test issuer
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      cy.startProcessor(processorId);

      // Generate a test token and send it through the processor
      cy.generateValidToken(TEXT_CONSTANTS.TEST_ISSUER_VALUE).then((token) => {
        cy.sendTokenToProcessor(processorId, token);
      });

      // Wait for processing and check updated metrics
      // Loading wait removed - using proper element readiness checks;

      cy.getProcessorElement(processorId)
        .find(SELECTORS.PROCESSOR_STATUS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.PROCESSED_ONE)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, TEST_DATA.VALID_ONE);
    });

    it('should track invalid token metrics correctly', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      cy.startProcessor(processorId);

      // Send various invalid tokens
      cy.sendTokenToProcessor(processorId, 'invalid.token.format');
      cy.sendTokenToProcessor(processorId, 'expired.jwt.token');
      cy.sendTokenToProcessor(processorId, 'malformed-token');

      // Loading wait removed - using proper element readiness checks;

      // Verify invalid token metrics are updated
      cy.getProcessorElement(processorId)
        .find(SELECTORS.PROCESSOR_STATUS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Processed: 3')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Invalid: 3');

      // Check detailed breakdown in processor details
      cy.getProcessorElement(processorId).click();

      cy.get('[data-testid="processor-details-metrics"]')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Malformed: 1')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Expired: 1')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Invalid Signature: 1');
    });

    it('should reset metrics when reset button is clicked', () => {
      // Configure and process some tokens first
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      cy.startProcessor(processorId);

      // Process some tokens to generate metrics
      cy.generateValidToken(TEXT_CONSTANTS.TEST_ISSUER_VALUE).then((token) => {
        cy.sendTokenToProcessor(processorId, token);
        cy.sendTokenToProcessor(processorId, 'invalid.token');
      });

      // Loading wait removed - using proper element readiness checks;

      // Verify metrics are non-zero
      cy.getProcessorElement(processorId)
        .find(SELECTORS.PROCESSOR_STATUS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Processed: 2');

      // Open metrics tab and reset metrics
      cy.openProcessorConfigDialog(processorId);
      cy.get('SELECTORS.METRICS_TAB').click();

      cy.get('[data-testid="reset-metrics-button"]').click();

      // Confirm reset dialog
      cy.get('[data-testid="confirm-reset-dialog"]').should('be.visible');

      cy.get('[data-testid="confirm-reset-button"]').click();

      // Close config dialog
      cy.get('[data-testid="config-dialog-close"]').click();

      // Verify metrics are reset to zero
      cy.getProcessorElement(processorId)
        .find(SELECTORS.PROCESSOR_STATUS)
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Processed: 0')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Valid: 0')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Invalid: 0');
    });
  });

  describe('Metrics API Integration Tests', () => {
    it('should retrieve metrics via API endpoint', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
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
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      cy.startProcessor(processorId);

      // Process multiple tokens to generate timing data
      for (let i = 0; i < 5; i++) {
        cy.generateValidToken(TEXT_CONSTANTS.TEST_ISSUER_VALUE).then((token) => {
          cy.sendTokenToProcessor(processorId, token);
        });
      }

      // Wait for metrics to be processed
      cy.get('[data-testid="performance-metrics"]', { timeout: 10000 }).should('exist');

      // Check that response time metrics are tracked
      cy.openProcessorConfigDialog(processorId);
      cy.get('SELECTORS.METRICS_TAB').click();

      cy.get('[data-testid="performance-metrics"]')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Average Response Time')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'ms');

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
        [TEST_DATA.ISSUER_1_NAME]: 'issuer-a',
        [TEST_DATA.ISSUER_1_ISSUER]: 'https://issuer-a.example.com',
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: 'https://issuer-a.example.com/jwks.json',
        'issuer-2-name': 'issuer-b',
        'issuer-2-issuer': 'https://issuer-b.example.com',
        'issuer-2-jwks-type': TEXT_CONSTANTS.SERVER_TYPE,
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
      cy.get('SELECTORS.METRICS_TAB').click();

      cy.get('[data-testid="issuer-metrics"]')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'issuer-a')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'issuer-b');

      // Verify per-issuer counts
      cy.get('[data-testid="issuer-a-count"]').should(TEXT_CONSTANTS.CONTAIN_TEXT, '1');

      cy.get('[data-testid="issuer-b-count"]').should(TEXT_CONSTANTS.CONTAIN_TEXT, '2');
    });
  });

  describe('Error Metrics Monitoring', () => {
    it('should track recent validation errors', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      cy.startProcessor(processorId);

      // Send various types of invalid tokens
      cy.sendTokenToProcessor(processorId, 'malformed-token');
      cy.sendTokenToProcessor(processorId, 'expired.jwt.token');
      cy.sendTokenToProcessor(processorId, 'invalid.signature.token');

      // Loading wait removed - using proper element readiness checks;

      // Check recent errors in metrics tab
      cy.openProcessorConfigDialog(processorId);
      cy.get('SELECTORS.METRICS_TAB').click();

      cy.get('[data-testid="recent-errors"]')
        .should('be.visible')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Recent Validation Errors');

      // Verify error details are shown
      cy.get('[data-testid="error-list"]').find('.error-item').should('have.length.at.least', 3);

      // Check error categories are displayed
      cy.get('[data-testid="error-list"]')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Malformed Token')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Expired Token')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Invalid Signature');
    });

    it('should categorize errors correctly', () => {
      // Configure processor
      cy.configureProcessor(processorId, {
        [TEST_DATA.ISSUER_1_NAME]: TEXT_CONSTANTS.TEST_ISSUER_VALUE,
        [TEST_DATA.ISSUER_1_ISSUER]: TEXT_CONSTANTS.TEST_EXAMPLE_URL,
        [TEST_DATA.ISSUER_1_JWKS_TYPE]: TEXT_CONSTANTS.SERVER_TYPE,
        [TEST_DATA.ISSUER_1_JWKS_URL]: TEXT_CONSTANTS.TEST_JWKS_JSON_URL,
      });

      cy.startProcessor(processorId);

      // Send specific error types
      cy.sendTokenToProcessor(processorId, 'not.a.jwt.token'); // Malformed
      cy.sendExpiredToken(processorId); // Expired
      cy.sendTokenWithInvalidSignature(processorId); // Invalid signature
      cy.sendTokenWithMissingClaims(processorId); // Missing claims

      // Wait for error metrics to be processed
      cy.get('SELECTORS.METRICS_TAB', { timeout: 10000 }).should('exist');

      // Verify error categorization in metrics
      cy.openProcessorConfigDialog(processorId);
      cy.get('SELECTORS.METRICS_TAB').click();

      cy.get('[data-testid="error-breakdown"]')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Malformed: 1')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Expired: 1')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Invalid Signature: 1')
        .should(TEXT_CONSTANTS.CONTAIN_TEXT, 'Missing Claims: 1');
    });
  });
});
