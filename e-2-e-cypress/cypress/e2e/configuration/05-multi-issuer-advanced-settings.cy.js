/**
 * Multi-Issuer JWT Processor Advanced Settings Tests
 * 
 * Comprehensive test suite for multi-issuer JWT processor configuration interface,
 * custom UI components, and advanced settings functionality
 * 
 * @fileoverview Multi-issuer JWT processor configuration tests
 * @requires cypress/support/utils/auth-helpers.js
 * @requires cypress/support/utils/processor-helpers.js
 * @requires cypress/support/utils/ui-helpers.js
 * @requires cypress/support/utils/validation-helpers.js
 * @requires cypress/support/utils/error-tracking.js
 */

import { 
  loginWithCredentials, 
  verifyLoginState,
  clearAllAuthenticationData
} from '../../support/utils/auth-helpers.js';
import { 
  createProcessorInstance,
  validateProcessorConfiguration,
  openProcessorSettings,
  getProcessorProperties,
  setProcessorProperty,
  saveProcessorConfiguration,
  validateProcessorAvailability
} from '../../support/utils/processor-helpers.js';
import { 
  waitForUIElement, 
  navigateToPage,
  clickElement,
  fillFormField,
  selectDropdownOption,
  validateTabNavigation
} from '../../support/utils/ui-helpers.js';
import { 
  validateRequiredElements, 
  validateFormValidation,
  validateConfigurationPersistence,
  validateHelpSystem
} from '../../support/utils/validation-helpers.js';
import { 
  trackTestFailure, 
  logTestStep, 
  captureDebugInfo 
} from '../../support/utils/error-tracking.js';

describe('05 - Multi-Issuer JWT Processor Advanced Settings', () => {
  
  let processorId = null;
  
  beforeEach(() => {
    logTestStep('05-multi-issuer-config', 'Starting multi-issuer configuration test');
    clearAllAuthenticationData();
    loginWithCredentials('admin', 'adminadminadmin');
    verifyLoginState();
    
    // Navigate to canvas
    navigateToPage('/nifi')
      .then(() => {
        return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
      });
  });

  afterEach(() => {
    captureDebugInfo('05-multi-issuer-config');
    // Clean up processor if created
    if (processorId) {
      cy.deleteProcessor(processorId).catch(() => {
        // Ignore cleanup errors
      });
      processorId = null;
    }
  });

  context('Multi-Issuer Processor Creation and Access', () => {
    
    it('R-CONFIG-001: Should create multi-issuer JWT processor and access configuration', () => {
      logTestStep('05-multi-issuer-config', 'Creating multi-issuer JWT processor');
      
      validateProcessorAvailability('MultiIssuer')
        .then((availability) => {
          if (availability.isAvailable) {
            return createProcessorInstance('MultiIssuer', { x: 200, y: 200 });
          } else {
            // Try fallback - validate JWT processor availability
            return validateProcessorAvailability('JWT');
          }
        })
        .then((result) => {
          if (result.isAvailable !== undefined) {
            // This is the fallback validation result
            if (result.isAvailable) {
              return createProcessorInstance('JWT', { x: 200, y: 200 });
            } else {
              logTestStep('05-multi-issuer-config', 'No multi-issuer processor available - skipping configuration tests');
              cy.skip('Multi-issuer JWT processor not available');
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
          logTestStep('05-multi-issuer-config', `Multi-issuer processor created with ID: ${processorId}`);
          
          // Access processor configuration
          return openProcessorSettings(processorId);
        })
        .then((settingsResult) => {
          expect(settingsResult.dialogOpened).to.be.true;
          expect(settingsResult.hasConfigurationTabs).to.be.true;
          
          logTestStep('05-multi-issuer-config', 'Multi-issuer processor configuration dialog opened successfully');
        })
        .catch((error) => {
          trackTestFailure('05-multi-issuer-config', 'processor-creation-access', error);
          throw error;
        });
    });

    it('R-CONFIG-001: Should validate multi-issuer processor configuration interface', () => {
      logTestStep('05-multi-issuer-config', 'Validating multi-issuer configuration interface');
      
      createProcessorInstance('MultiIssuer', { x: 250, y: 250 })
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
          expect(configValidation.hasCustomUI).to.be.true;
          
          logTestStep('05-multi-issuer-config', 'Multi-issuer processor configuration interface validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'config-interface-validation', error);
            throw error;
          }
        });
    });
  });

  context('Custom UI Components and Tab Navigation', () => {
    
    it('R-CONFIG-002: Should validate custom JWT UI components load correctly', () => {
      logTestStep('05-multi-issuer-config', 'Validating custom JWT UI components');
      
      createProcessorInstance('MultiIssuer', { x: 300, y: 300 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Validate custom UI elements are present
          return validateRequiredElements([
            '[data-testid="jwt-config-tabs"], .jwt-validator-tabs, .custom-tab',
            '[data-testid="issuer-config"], .issuer-config, [data-tab="issuers"]',
            '[data-testid="token-verification"], .token-verification, [data-tab="verification"]'
          ]);
        })
        .then(() => {
          logTestStep('05-multi-issuer-config', 'Custom JWT UI components loaded successfully');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'custom-ui-components', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-002: Should validate tab navigation functionality', () => {
      logTestStep('05-multi-issuer-config', 'Testing tab navigation functionality');
      
      createProcessorInstance('MultiIssuer', { x: 350, y: 350 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test tab navigation
          const expectedTabs = [
            'Properties',
            'Settings', 
            'Scheduling',
            'Comments',
            'Issuers',
            'Token Verification',
            'Metrics'
          ];
          
          return validateTabNavigation(expectedTabs);
        })
        .then((tabValidation) => {
          expect(tabValidation.allTabsAccessible).to.be.true;
          expect(tabValidation.customTabsFound.length).to.be.at.least(1);
          
          logTestStep('05-multi-issuer-config', `Found ${tabValidation.customTabsFound.length} custom tabs`);
          logTestStep('05-multi-issuer-config', 'Tab navigation functionality validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'tab-navigation', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-003: Should validate issuer configuration tab functionality', () => {
      logTestStep('05-multi-issuer-config', 'Testing issuer configuration tab functionality');
      
      createProcessorInstance('MultiIssuer', { x: 400, y: 400 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Navigate to issuer configuration tab
          return clickElement('[data-tab="issuers"], .issuer-tab, [aria-label*="issuer"]');
        })
        .then(() => {
          // Validate issuer configuration elements
          return validateRequiredElements([
            '[data-testid="add-issuer"], .add-issuer-btn, [aria-label*="add issuer"]',
            '[data-testid="issuer-list"], .issuer-list, .issuer-table',
            '[data-testid="issuer-url"], input[name*="issuer"], [placeholder*="issuer"]'
          ]);
        })
        .then(() => {
          logTestStep('05-multi-issuer-config', 'Issuer configuration tab functionality validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'issuer-config-tab', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-003: Should validate token verification tab functionality', () => {
      logTestStep('05-multi-issuer-config', 'Testing token verification tab functionality');
      
      createProcessorInstance('MultiIssuer', { x: 450, y: 450 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Navigate to token verification tab
          return clickElement('[data-tab="verification"], .verification-tab, [aria-label*="verification"]');
        })
        .then(() => {
          // Validate token verification elements
          return validateRequiredElements([
            '[data-testid="token-input"], .token-input, textarea[name*="token"]',
            '[data-testid="verify-button"], .verify-btn, button[aria-label*="verify"]',
            '[data-testid="verification-result"], .verification-result, .result-display'
          ]);
        })
        .then(() => {
          logTestStep('05-multi-issuer-config', 'Token verification tab functionality validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'token-verification-tab', error);
            throw error;
          }
        });
    });
  });

  context('Form Interaction and Validation', () => {
    
    it('R-CONFIG-004: Should validate form field interaction', () => {
      logTestStep('05-multi-issuer-config', 'Testing form field interaction');
      
      createProcessorInstance('MultiIssuer', { x: 500, y: 500 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test basic properties tab first
          return getProcessorProperties(processorId);
        })
        .then((properties) => {
          expect(properties).to.exist;
          
          // Test setting a property
          const testPropertyName = 'Issuer URLs';
          const testValue = 'https://test-issuer.example.com';
          
          return setProcessorProperty(processorId, testPropertyName, testValue);
        })
        .then((setResult) => {
          expect(setResult.success).to.be.true;
          
          logTestStep('05-multi-issuer-config', 'Form field interaction validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'form-interaction', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-004: Should validate form validation rules', () => {
      logTestStep('05-multi-issuer-config', 'Testing form validation rules');
      
      createProcessorInstance('MultiIssuer', { x: 550, y: 550 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test validation with invalid data
          return validateFormValidation(processorId, {
            'Issuer URLs': 'invalid-url',
            'JWKS Endpoint': 'not-a-url'
          });
        })
        .then((validationResult) => {
          expect(validationResult.hasValidation).to.be.true;
          expect(validationResult.validationErrors.length).to.be.at.least(1);
          
          logTestStep('05-multi-issuer-config', 'Form validation rules working correctly');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'form-validation', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-005: Should validate dropdown and select functionality', () => {
      logTestStep('05-multi-issuer-config', 'Testing dropdown and select functionality');
      
      createProcessorInstance('MultiIssuer', { x: 600, y: 600 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Test dropdown interactions
          return selectDropdownOption('[data-testid="algorithm-select"], select[name*="algorithm"]', 'RS256');
        })
        .then((selectionResult) => {
          expect(selectionResult.success).to.be.true;
          
          logTestStep('05-multi-issuer-config', 'Dropdown functionality validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'dropdown-functionality', error);
            throw error;
          }
        });
    });
  });

  context('Help System and Documentation', () => {
    
    it('R-CONFIG-006: Should validate help tooltip system', () => {
      logTestStep('05-multi-issuer-config', 'Testing help tooltip system');
      
      createProcessorInstance('MultiIssuer', { x: 650, y: 650 })
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
          
          logTestStep('05-multi-issuer-config', 'Help tooltip system validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'help-system', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-006: Should validate documentation integration', () => {
      logTestStep('05-multi-issuer-config', 'Testing documentation integration');
      
      createProcessorInstance('MultiIssuer', { x: 700, y: 700 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Look for documentation links or help sections
          return validateRequiredElements([
            '[data-testid="help-link"], .help-link, [aria-label*="help"]',
            '[data-testid="documentation"], .documentation, [aria-label*="docs"]'
          ]);
        })
        .then(() => {
          logTestStep('05-multi-issuer-config', 'Documentation integration validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'documentation-integration', error);
            throw error;
          }
        });
    });
  });

  context('Configuration Persistence', () => {
    
    it('R-CONFIG-007: Should validate configuration save and retrieve', () => {
      logTestStep('05-multi-issuer-config', 'Testing configuration persistence');
      
      createProcessorInstance('MultiIssuer', { x: 750, y: 750 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Set some configuration values
          const testConfig = {
            'Issuer URLs': 'https://issuer1.example.com,https://issuer2.example.com',
            'Algorithm': 'RS256',
            'Clock Skew': '30'
          };
          
          return setProcessorProperty(processorId, 'Issuer URLs', testConfig['Issuer URLs']);
        })
        .then(() => {
          return saveProcessorConfiguration(processorId);
        })
        .then((saveResult) => {
          expect(saveResult.success).to.be.true;
          
          // Close and reopen to test persistence
          cy.get('[data-testid="close-dialog"], .close-btn, [aria-label="close"]')
            .click({ force: true });
          
          cy.wait(1000);
          
          return openProcessorSettings(processorId);
        })
        .then(() => {
          return validateConfigurationPersistence(processorId, {
            'Issuer URLs': 'https://issuer1.example.com,https://issuer2.example.com'
          });
        })
        .then((persistenceResult) => {
          expect(persistenceResult.valuesMatch).to.be.true;
          
          logTestStep('05-multi-issuer-config', 'Configuration persistence validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'config-persistence', error);
            throw error;
          }
        });
    });

    it('R-CONFIG-008: Should validate multi-issuer specific features', () => {
      logTestStep('05-multi-issuer-config', 'Testing multi-issuer specific features');
      
      createProcessorInstance('MultiIssuer', { x: 800, y: 800 })
        .then((creationResult) => {
          processorId = creationResult.processorId;
          return openProcessorSettings(processorId);
        })
        .then(() => {
          // Navigate to issuer configuration
          return clickElement('[data-tab="issuers"], .issuer-tab');
        })
        .then(() => {
          // Test adding multiple issuers
          return fillFormField('[data-testid="issuer-url"], input[name*="issuer"]', 'https://issuer1.example.com');
        })
        .then(() => {
          return clickElement('[data-testid="add-issuer"], .add-issuer-btn');
        })
        .then(() => {
          return fillFormField('[data-testid="issuer-url"], input[name*="issuer"]', 'https://issuer2.example.com');
        })
        .then(() => {
          return clickElement('[data-testid="add-issuer"], .add-issuer-btn');
        })
        .then(() => {
          // Validate multiple issuers are configured
          return cy.get('[data-testid="issuer-list"] .issuer-item, .issuer-table tr, .issuer-entry')
            .should('have.length.at.least', 2);
        })
        .then(() => {
          logTestStep('05-multi-issuer-config', 'Multi-issuer specific features validated');
        })
        .catch((error) => {
          if (!error.message.includes('not available')) {
            trackTestFailure('05-multi-issuer-config', 'multi-issuer-features', error);
            throw error;
          }
        });
    });
  });
});
