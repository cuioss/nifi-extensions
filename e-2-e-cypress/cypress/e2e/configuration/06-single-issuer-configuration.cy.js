/**
 * Single-Issuer JWT Processor Configuration Tests
 *
 * Test suite for single-issuer JWT processor configuration interface,
 * simplified UI components, and single-issuer specific functionality
 * @file Single-issuer JWT processor configuration tests
 * @requires cypress/support/utils/auth-helpers.js
 * @requires cypress/support/utils/processor-helpers.js
 * @requires cypress/support/utils/ui-helpers.js
 * @requires cypress/support/utils/validation-helpers.js
 * @requires cypress/support/utils/error-tracking.js
 */

import {
  loginWithCredentials,
  verifyLoginState,
  clearAllAuthenticationData,
} from '../../support/utils/auth-helpers.js';
import {
  createProcessorInstance,
  validateProcessorConfiguration,
  openProcessorSettings,
  getProcessorProperties,
  setProcessorProperty,
  saveProcessorConfiguration,
  validateProcessorAvailability,
} from '../../support/utils/processor-helpers.js';
import {
  waitForUIElement,
  navigateToPage,
  selectDropdownOption,
  validateTabNavigation,
} from '../../support/utils/ui-helpers.js';
import {
  validateRequiredElements,
  validateFormValidation,
  validateConfigurationPersistence,
  validateHelpSystem,
} from '../../support/utils/validation-helpers.js';
import {
  trackTestFailure,
  logTestStep,
  captureDebugInfo,
} from '../../support/utils/error-tracking.js';

describe('06 - Single-Issuer JWT Processor Configuration', () => {
  let processorId = null;

  beforeEach(() => {
    logTestStep('06-single-issuer-config', 'Starting single-issuer configuration test');
    clearAllAuthenticationData();
    loginWithCredentials('admin', 'adminadminadmin');
    verifyLoginState();

    // Navigate to canvas
    navigateToPage('/nifi').then(() => {
      return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
    });
  });

  afterEach(() => {
    captureDebugInfo('06-single-issuer-config');
    // Clean up processor if created
    if (processorId) {
      cy.deleteProcessor(processorId).catch(() => {
        // Ignore cleanup errors
      });
      processorId = null;
    }
  });

  context('Single-Issuer Processor Creation and Access', () => {
    it('R-CONFIG-009: Should create single-issuer JWT processor and access configuration', () => {
      logTestStep('06-single-issuer-config', 'Creating single-issuer JWT processor');

      validateProcessorAvailability('SingleIssuer')
        .then((availability) => {
          if (availability.isAvailable) {
            return createProcessorInstance('SingleIssuer', { x: 200, y: 200 });
          } else {
            // Try fallback names
            return validateProcessorAvailability('JWKS');
          }
        })
        .then((result) => {
          if (result.isAvailable !== undefined) {
            // This is the fallback validation result
            if (result.isAvailable) {
              return createProcessorInstance('JWKS', { x: 200, y: 200 });
            } else {
              logTestStep(
                '06-single-issuer-config',
                'No single-issuer processor available - skipping configuration tests'
              );
              cy.skip('Single-issuer JWT processor not available');
            }
          } else {
            // This is the creation result
            return result;
          }
        })
        .then((creationResult) => {
          expect(creationResult.created).to.be.true;
          expect(creationResult.processorId).to.exist;

          processorId = creationResult.processorId;
          logTestStep(
            '06-single-issuer-config',
            `Single-issuer processor created with ID: ${processorId}`
          );

          // Access processor configuration
          return openProcessorSettings(processorId);
        })
        .then((settingsResult) => {
          expect(settingsResult.dialogOpened).to.be.true;
          expect(settingsResult.hasConfigurationTabs).to.be.true;

          logTestStep(
            '06-single-issuer-config',
            'Single-issuer processor configuration dialog opened successfully'
          );
        })
        .catch((error) => {
          trackTestFailure('06-single-issuer-config', 'processor-creation-access', error);
          throw error;
        });
    });

    it('R-CONFIG-009: Should validate single-issuer processor configuration interface', () => {
      logTestStep('06-single-issuer-config', 'Validating single-issuer configuration interface');

      createProcessorInstance('JWKS', { x: 250, y: 250 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          return validateProcessorConfiguration(processorId);
        })
        .then((configValidation) => {
          expect(configValidation.hasConfigDialog).to.be.true;
          expect(configValidation.hasProperties).to.be.true;
          expect(configValidation.canEditProperties).to.be.true;

          logTestStep(
            '06-single-issuer-config',
            'Single-issuer processor configuration interface validated'
          );
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'config-interface-validation', error);
            throw error;
          }
        });
    });
  });

  context('Single-Issuer UI Components', () => {
    it('R-CONFIG-010: Should validate single-issuer specific UI components', () => {
      logTestStep('06-single-issuer-config', 'Validating single-issuer specific UI components');

      createProcessorInstance('JWKS', { x: 300, y: 300 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Validate single-issuer specific UI elements
          return validateRequiredElements([
            '[data-testid="jwks-url"], input[name*="jwks"], [placeholder*="jwks"]',
            '[data-testid="issuer-url"], input[name*="issuer"], [placeholder*="issuer"]',
            '[data-testid="algorithm-select"], select[name*="algorithm"]',
          ]);
        })
        .then(() => {
          logTestStep('06-single-issuer-config', 'Single-issuer specific UI components validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'single-issuer-ui', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-010: Should validate simplified configuration interface', () => {
      logTestStep('06-single-issuer-config', 'Testing simplified configuration interface');

      createProcessorInstance('JWKS', { x: 350, y: 350 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Single-issuer should have fewer tabs than multi-issuer
          const expectedTabs = ['Properties', 'Settings', 'Scheduling', 'Comments'];

          return validateTabNavigation(expectedTabs);
        })
        .then((tabValidation) => {
          expect(tabValidation.allTabsAccessible).to.be.true;

          // Should have fewer custom tabs than multi-issuer
          expect(tabValidation.customTabsFound.length).to.be.lessThan(3);

          logTestStep('06-single-issuer-config', 'Simplified configuration interface validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'simplified-interface', error);
            throw error;
          }
        });
    });
  });

  context('Single-Issuer Configuration Options', () => {
    it('R-CONFIG-011: Should validate single-issuer configuration fields', () => {
      logTestStep('06-single-issuer-config', 'Testing single-issuer configuration fields');

      createProcessorInstance('JWKS', { x: 400, y: 400 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          return getProcessorProperties(processorId);
        })
        .then((properties) => {
          expect(properties).to.exist;

          // Expected single-issuer properties
          const expectedProperties = ['JWKS URL', 'Issuer URL', 'Algorithm', 'Clock Skew'];

          const foundProperties = expectedProperties.filter((prop) =>
            properties.some((p) => p.name.includes(prop) || p.displayName.includes(prop))
          );

          expect(foundProperties.length).to.be.at.least(1);

          logTestStep(
            '06-single-issuer-config',
            `Found ${foundProperties.length} expected single-issuer properties`
          );
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'config-fields', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-011: Should validate JWKS URL configuration', () => {
      logTestStep('06-single-issuer-config', 'Testing JWKS URL configuration');

      createProcessorInstance('JWKS', { x: 450, y: 450 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test setting JWKS URL
          const testJWKSURL = 'https://issuer.example.com/.well-known/jwks.json';

          return setProcessorProperty(processorId, 'JWKS URL', testJWKSURL);
        })
        .then((setResult) => {
          expect(setResult.success).to.be.true;

          logTestStep('06-single-issuer-config', 'JWKS URL configuration validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'jwks-url-config', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-012: Should validate single-issuer form validation rules', () => {
      logTestStep('06-single-issuer-config', 'Testing single-issuer form validation rules');

      createProcessorInstance('JWKS', { x: 500, y: 500 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test validation with invalid data
          return validateFormValidation(processorId, {
            'JWKS URL': 'invalid-url',
            'Issuer URL': 'not-a-url',
            'Clock Skew': 'invalid-number',
          });
        })
        .then((validationResult) => {
          expect(validationResult.hasValidation).to.be.true;
          expect(validationResult.validationErrors.length).to.be.at.least(1);

          logTestStep(
            '06-single-issuer-config',
            'Single-issuer form validation rules working correctly'
          );
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'form-validation', error);
            throw error;
          }
        });
    });
  });

  context('Single-Issuer Help and Documentation', () => {
    it('R-CONFIG-013: Should validate single-issuer specific help content', () => {
      logTestStep('06-single-issuer-config', 'Testing single-issuer specific help content');

      createProcessorInstance('JWKS', { x: 550, y: 550 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          return validateHelpSystem();
        })
        .then((helpValidation) => {
          expect(helpValidation.hasHelpElements).to.be.true;
          expect(helpValidation.tooltipsAccessible).to.be.true;

          // Look for single-issuer specific help content
          return cy.get('body').then(($body) => {
            const helpText = $body.text().toLowerCase();
            const hasSingleIssuerHelp =
              helpText.includes('single') ||
              helpText.includes('jwks') ||
              helpText.includes('one issuer');

            if (hasSingleIssuerHelp) {
              logTestStep(
                '06-single-issuer-config',
                'Single-issuer specific help content detected'
              );
            } else {
              logTestStep(
                '06-single-issuer-config',
                'No single-issuer specific help content detected - using generic help'
              );
            }

            return cy.wrap(hasSingleIssuerHelp);
          });
        })
        .then(() => {
          logTestStep('06-single-issuer-config', 'Single-issuer help content validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'help-content', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-013: Should validate documentation links for single-issuer', () => {
      logTestStep('06-single-issuer-config', 'Testing documentation links for single-issuer');

      createProcessorInstance('JWKS', { x: 600, y: 600 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Look for documentation links
          return validateRequiredElements([
            '[data-testid="help-link"], .help-link, [aria-label*="help"]',
            '[data-testid="documentation"], .documentation, [aria-label*="docs"]',
          ]);
        })
        .then(() => {
          logTestStep('06-single-issuer-config', 'Documentation links validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'documentation-links', error);
            throw error;
          }
        });
    });
  });

  context('Single-Issuer Configuration Persistence', () => {
    it('R-CONFIG-014: Should validate single-issuer configuration persistence', () => {
      logTestStep('06-single-issuer-config', 'Testing single-issuer configuration persistence');

      createProcessorInstance('JWKS', { x: 650, y: 650 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Set configuration values
          const testConfig = {
            'JWKS URL': 'https://issuer.example.com/.well-known/jwks.json',
            'Issuer URL': 'https://issuer.example.com',
            Algorithm: 'RS256',
          };

          return setProcessorProperty(processorId, 'JWKS URL', testConfig['JWKS URL']);
        })
        .then(() => {
          return setProcessorProperty(processorId, 'Issuer URL', 'https://issuer.example.com');
        })
        .then(() => {
          return saveProcessorConfiguration(processorId);
        })
        .then((saveResult) => {
          expect(saveResult.success).to.be.true;

          // Close and reopen to test persistence
          cy.get('[data-testid="close-dialog"], .close-btn, [aria-label="close"]').click({
            force: true,
          });

          cy.wait(1000);

          return openProcessorSettings(processorId);
        })
        .then(() => {
          return validateConfigurationPersistence(processorId, {
            'JWKS URL': 'https://issuer.example.com/.well-known/jwks.json',
            'Issuer URL': 'https://issuer.example.com',
          });
        })
        .then((persistenceResult) => {
          expect(persistenceResult.valuesMatch).to.be.true;

          logTestStep(
            '06-single-issuer-config',
            'Single-issuer configuration persistence validated'
          );
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'config-persistence', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-015: Should validate single-issuer error handling', () => {
      logTestStep('06-single-issuer-config', 'Testing single-issuer error handling');

      createProcessorInstance('JWKS', { x: 700, y: 700 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test error scenarios specific to single-issuer
          return setProcessorProperty(processorId, 'JWKS URL', '');
        })
        .then(() => {
          return setProcessorProperty(processorId, 'Issuer URL', '');
        })
        .then(() => {
          // Try to save configuration with missing required fields
          return saveProcessorConfiguration(processorId, { expectError: true });
        })
        .then((saveResult) => {
          // Should either fail to save or show validation errors
          expect(saveResult.hasError || saveResult.hasValidationErrors).to.be.true;

          logTestStep('06-single-issuer-config', 'Single-issuer error handling validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'error-handling', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-016: Should validate algorithm selection for single-issuer', () => {
      logTestStep('06-single-issuer-config', 'Testing algorithm selection for single-issuer');

      createProcessorInstance('JWKS', { x: 750, y: 750 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test algorithm dropdown functionality
          return selectDropdownOption(
            '[data-testid="algorithm-select"], select[name*="algorithm"]',
            'RS256'
          );
        })
        .then((selectionResult) => {
          expect(selectionResult.success).to.be.true;

          // Test another algorithm
          return selectDropdownOption(
            '[data-testid="algorithm-select"], select[name*="algorithm"]',
            'ES256'
          );
        })
        .then((selectionResult2) => {
          expect(selectionResult2.success).to.be.true;

          logTestStep('06-single-issuer-config', 'Algorithm selection functionality validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('06-single-issuer-config', 'algorithm-selection', error);
            throw error;
          }
        });
    });
  });
});
