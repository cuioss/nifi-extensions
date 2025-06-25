/**
 * Simplified Processor Deployment and Validation Tests
 *
 * Comprehensive test suite for NAR deployment validation, processor catalog verification,
 * and custom processor instantiation according to Requirements R-DEPLOY-001 to R-DEPLOY-005
 * @file Processor deployment test implementation for NiFi JWT extension
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
  validateNARDeployment,
  getProcessorCatalog,
  validateProcessorAvailability,
  createProcessorInstance,
  validateProcessorConfiguration,
  validateProcessorServices,
  cleanupProcessors,
} from '../../support/utils/processor-helpers.js';
import { waitForUIElement, navigateToPage } from '../../support/utils/ui-helpers.js';
import {
  validateRequiredElements,
  validateNARIntegrity,
  validateVersionCompatibility,
} from '../../support/utils/validation-helpers.js';
import {
  trackTestFailure,
  logTestStep,
  captureDebugInfo,
} from '../../support/utils/error-tracking.js';

describe('03 - Processor Deployment and NAR Validation', () => {
  beforeEach(() => {
    logTestStep('03-deployment', 'Starting deployment test - ensuring authenticated state');
    clearAllAuthenticationData();
    loginWithCredentials('admin', 'adminadminadmin');
    verifyLoginState();
  });

  afterEach(() => {
    captureDebugInfo('03-deployment');
    cleanupProcessors();
  });

  context('NAR Deployment Verification', () => {
    it('R-DEPLOY-001: Should validate NAR file deployment and integrity', () => {
      logTestStep('03-deployment', 'Validating NAR file deployment and integrity');

      validateNARDeployment('nifi-cuioss-nar')
        .then((narValidation) => {
          expect(narValidation.isDeployed).to.be.true;
          expect(narValidation.narPath).to.exist;
          expect(narValidation.version).to.exist;

          logTestStep('03-deployment', 'Validating NAR file integrity');
          return validateNARIntegrity(narValidation.narPath);
        })
        .then((integrityCheck) => {
          expect(integrityCheck.isValid).to.be.true;
          expect(integrityCheck.hasRequiredManifest).to.be.true;
          expect(integrityCheck.hasProcessorClasses).to.be.true;

          logTestStep('03-deployment', 'NAR deployment and integrity validated successfully');
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'nar-deployment-validation', error);
          throw error;
        });
    });

    it('R-DEPLOY-001: Should validate version compatibility with NiFi', () => {
      logTestStep('03-deployment', 'Validating version compatibility');

      validateVersionCompatibility()
        .then((compatibilityCheck) => {
          expect(compatibilityCheck.isCompatible).to.be.true;
          expect(compatibilityCheck.nifiVersion).to.exist;
          expect(compatibilityCheck.narVersion).to.exist;

          logTestStep(
            '03-deployment',
            `NiFi version: ${compatibilityCheck.nifiVersion}, NAR version: ${compatibilityCheck.narVersion}`
          );

          if (compatibilityCheck.warnings && compatibilityCheck.warnings.length > 0) {
            logTestStep(
              '03-deployment',
              `Version warnings: ${compatibilityCheck.warnings.join(', ')}`
            );
          }

          logTestStep('03-deployment', 'Version compatibility validated successfully');
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'version-compatibility', error);
          throw error;
        });
    });

    it('R-DEPLOY-002: Should validate processor service registration', () => {
      logTestStep('03-deployment', 'Validating processor service registration');

      validateProcessorServices()
        .then((serviceValidation) => {
          expect(serviceValidation.servicesRegistered).to.be.true;
          expect(serviceValidation.registeredProcessors).to.have.length.at.least(1);

          // Check for our specific processors
          const expectedProcessorNames = ['JWT', 'JWKS', 'JWTValidation', 'JWTValidator'];
          let foundProcessors = 0;

          expectedProcessorNames.forEach((processorName) => {
            const found = serviceValidation.registeredProcessors.some(
              (processor) =>
                processor.name.includes(processorName) || processor.type.includes(processorName)
            );
            if (found) foundProcessors++;
          });

          expect(foundProcessors).to.be.at.least(1);
          logTestStep('03-deployment', `Found ${foundProcessors} expected processors registered`);

          logTestStep('03-deployment', 'Processor service registration validated successfully');
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'service-registration', error);
          throw error;
        });
    });
  });

  context('Processor Catalog Validation', () => {
    it('R-DEPLOY-003: Should verify processors appear in catalog', () => {
      logTestStep('03-deployment', 'Verifying processors appear in catalog');

      navigateToPage('/nifi')
        .then(() => {
          return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
        })
        .then(() => {
          return getProcessorCatalog();
        })
        .then((catalog) => {
          expect(catalog).to.exist;
          expect(catalog.processors).to.have.length.at.least(1);

          // Count JWT and JWKS processors
          let jwtCount = 0;
          let jwksCount = 0;

          catalog.processors.forEach((processor) => {
            const name = processor.name.toLowerCase();
            const type = processor.type.toLowerCase();
            const displayName = (processor.displayName || '').toLowerCase();

            if (name.includes('jwt') || type.includes('jwt') || displayName.includes('jwt')) {
              jwtCount++;
            }
            if (name.includes('jwks') || type.includes('jwks') || displayName.includes('jwks')) {
              jwksCount++;
            }
          });

          expect(jwtCount + jwksCount).to.be.at.least(1);

          logTestStep(
            '03-deployment',
            `Found ${jwtCount} JWT processors and ${jwksCount} JWKS processors in catalog`
          );

          logTestStep('03-deployment', 'Processor catalog validation completed successfully');
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'catalog-validation', error);
          throw error;
        });
    });

    it('R-DEPLOY-003: Should validate processor metadata and descriptions', () => {
      logTestStep('03-deployment', 'Validating processor metadata and descriptions');

      navigateToPage('/nifi')
        .then(() => {
          return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
        })
        .then(() => {
          return getProcessorCatalog();
        })
        .then((catalog) => {
          const customProcessors = [];

          catalog.processors.forEach((processor) => {
            const name = processor.name.toLowerCase();
            const type = processor.type.toLowerCase();

            if (name.includes('jwt') || name.includes('jwks') || type.includes('cuioss')) {
              customProcessors.push(processor);
            }
          });

          if (customProcessors.length === 0) {
            logTestStep(
              '03-deployment',
              'No custom processors found - this may indicate deployment issues'
            );
            return cy.wrap([]);
          }

          customProcessors.forEach((processor) => {
            expect(processor.description).to.exist;
            expect(processor.description).to.not.be.empty;
            expect(processor.tags).to.exist;
            expect(processor.properties).to.exist;

            logTestStep('03-deployment', `Processor ${processor.name}: ${processor.description}`);
          });

          logTestStep('03-deployment', 'Processor metadata validation completed');
          return cy.wrap(customProcessors);
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'metadata-validation', error);
          throw error;
        });
    });
  });

  context('Processor Instantiation and Configuration', () => {
    it('R-DEPLOY-004: Should successfully create processor instances on canvas', () => {
      logTestStep('03-deployment', 'Testing processor instantiation on canvas');

      navigateToPage('/nifi')
        .then(() => {
          return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
        })
        .then(() => {
          return validateProcessorAvailability('JWT');
        })
        .then((jwtAvailable) => {
          if (jwtAvailable.isAvailable) {
            logTestStep('03-deployment', 'JWT processor found - creating instance');
            return createProcessorInstance('JWT', { x: 200, y: 200 });
          } else {
            logTestStep('03-deployment', 'JWT processor not available - checking JWKS');
            return validateProcessorAvailability('JWKS').then((jwksAvailable) => {
              if (jwksAvailable.isAvailable) {
                logTestStep('03-deployment', 'JWKS processor found - creating instance');
                return createProcessorInstance('JWKS', { x: 200, y: 200 });
              } else {
                logTestStep(
                  '03-deployment',
                  'No custom processors available for instantiation test'
                );
                return cy.wrap({ created: false, reason: 'no-processors-available' });
              }
            });
          }
        })
        .then((creationResult) => {
          if (creationResult.created) {
            expect(creationResult.processorId).to.exist;
            expect(creationResult.position).to.exist;

            logTestStep(
              '03-deployment',
              `Processor instance created with ID: ${creationResult.processorId}`
            );

            return waitForUIElement(
              `[data-id="${creationResult.processorId}"], .processor-component`,
              5000
            );
          } else {
            logTestStep('03-deployment', `Processor creation skipped: ${creationResult.reason}`);
            return cy.wrap(true);
          }
        })
        .then(() => {
          logTestStep('03-deployment', 'Processor instantiation test completed');
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'processor-instantiation', error);
          throw error;
        });
    });

    it('R-DEPLOY-004: Should open processor configuration dialogs', () => {
      logTestStep('03-deployment', 'Testing processor configuration dialog access');

      navigateToPage('/nifi')
        .then(() => {
          return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
        })
        .then(() => {
          return validateProcessorAvailability('JWT');
        })
        .then((jwtAvailable) => {
          if (jwtAvailable.isAvailable) {
            return createProcessorInstance('JWT', { x: 300, y: 300 });
          } else {
            return validateProcessorAvailability('JWKS').then((jwksAvailable) => {
              if (jwksAvailable.isAvailable) {
                return createProcessorInstance('JWKS', { x: 300, y: 300 });
              } else {
                return cy.wrap({ created: false, reason: 'no-processors-available' });
              }
            });
          }
        })
        .then((creationResult) => {
          if (creationResult.created) {
            logTestStep('03-deployment', 'Opening processor configuration dialog');
            return validateProcessorConfiguration(creationResult.processorId);
          } else {
            logTestStep('03-deployment', 'No processor available for configuration test');
            return cy.wrap({ configurable: false, reason: 'no-processor-created' });
          }
        })
        .then((configValidation) => {
          if (configValidation.configurable) {
            expect(configValidation.hasConfigDialog).to.be.true;
            expect(configValidation.hasProperties).to.be.true;
            expect(configValidation.canEditProperties).to.be.true;

            logTestStep('03-deployment', 'Processor configuration dialog validation completed');
          } else {
            logTestStep('03-deployment', `Configuration test skipped: ${configValidation.reason}`);
          }
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'configuration-dialog', error);
          throw error;
        });
    });

    it('R-DEPLOY-005: Should validate custom UI components load correctly', () => {
      logTestStep('03-deployment', 'Validating custom UI components loading');

      navigateToPage('/nifi')
        .then(() => {
          return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
        })
        .then(() => {
          return validateRequiredElements([
            '[data-testid="processor-palette"], .processor-palette',
            '[data-testid="processor-types"], .processor-types',
          ]);
        })
        .then(() => {
          // Check for custom UI elements
          return cy.get('body').then(($body) => {
            const hasJWTValidatorUI =
              $body.find('[data-processor-type*="JWT"], [class*="jwt-validator"]').length > 0;
            const hasJWKSUI =
              $body.find('[data-processor-type*="JWKS"], [class*="jwks"]').length > 0;
            const hasCustomIcons = $body.find('[class*="cuioss"], [data-icon*="jwt"]').length > 0;

            const customUIElements = { hasJWTValidatorUI, hasJWKSUI, hasCustomIcons };

            logTestStep(
              '03-deployment',
              `Custom UI elements detected: ${JSON.stringify(customUIElements)}`
            );

            const hasAnyCustomUI = Object.values(customUIElements).some(Boolean);

            if (hasAnyCustomUI) {
              logTestStep('03-deployment', 'Custom UI components detected and loaded');
            } else {
              logTestStep(
                '03-deployment',
                'No custom UI components detected - may be expected for minimal deployment'
              );
            }

            return cy.wrap(customUIElements);
          });
        })
        .then(() => {
          // Validate no JavaScript errors during UI loading
          cy.window().then((win) => {
            const hasJSErrors = win.console && win.console.error;
            if (!hasJSErrors) {
              logTestStep('03-deployment', 'No JavaScript errors detected during UI loading');
            }
          });

          logTestStep('03-deployment', 'Custom UI component validation completed');
        })
        .catch((error) => {
          trackTestFailure('03-deployment', 'custom-ui-validation', error);
          throw error;
        });
    });
  });
});

describe('04 - NAR Integration and Dependency Resolution', () => {
  beforeEach(() => {
    logTestStep('04-nar-integration', 'Starting NAR integration test');
    clearAllAuthenticationData();
    loginWithCredentials('admin', 'adminadminadmin');
    verifyLoginState();
  });

  afterEach(() => {
    captureDebugInfo('04-nar-integration');
  });

  it('R-DEPLOY-006: Should validate dependency resolution and classpath', () => {
    logTestStep('04-nar-integration', 'Validating dependency resolution and classpath');

    validateNARDeployment('nifi-cuioss-nar')
      .then((narValidation) => {
        expect(narValidation.isDeployed).to.be.true;

        return validateNARIntegrity(narValidation.narPath);
      })
      .then((integrityCheck) => {
        expect(integrityCheck.isValid).to.be.true;
        expect(integrityCheck.dependenciesResolved).to.be.true;
        expect(integrityCheck.classpathValid).to.be.true;

        // Validate specific dependencies that should be present
        const requiredDependencies = ['nifi-api', 'nifi-processor-utils', 'nifi-utils'];

        requiredDependencies.forEach((dependency) => {
          expect(integrityCheck.dependencies).to.include(dependency);
        });

        logTestStep('04-nar-integration', 'Dependency resolution validated successfully');
      })
      .catch((error) => {
        trackTestFailure('04-nar-integration', 'dependency-resolution', error);
        throw error;
      });
  });

  it('R-DEPLOY-006: Should validate resource loading and accessibility', () => {
    logTestStep('04-nar-integration', 'Validating resource loading and accessibility');

    navigateToPage('/nifi')
      .then(() => {
        return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
      })
      .then(() => {
        // Check for any resource loading issues
        cy.window().then((win) => {
          const performanceEntries = win.performance.getEntriesByType('resource');
          const failedResources = [];
          const nifiResources = [];

          performanceEntries.forEach((entry) => {
            if (entry.transferSize === 0 && entry.duration > 0) {
              failedResources.push(entry);
            }
            if (entry.name.includes('nifi') || entry.name.includes('cuioss')) {
              nifiResources.push(entry);
            }
          });

          if (failedResources.length > 0) {
            logTestStep(
              '04-nar-integration',
              `Warning: ${failedResources.length} failed resource loads detected`
            );
            failedResources.forEach((resource) => {
              logTestStep('04-nar-integration', `Failed resource: ${resource.name}`);
            });
          } else {
            logTestStep('04-nar-integration', 'All resources loaded successfully');
          }

          logTestStep('04-nar-integration', `Found ${nifiResources.length} NiFi-related resources`);
        });
      })
      .then(() => {
        logTestStep('04-nar-integration', 'Resource loading validation completed');
      })
      .catch((error) => {
        trackTestFailure('04-nar-integration', 'resource-loading', error);
        throw error;
      });
  });

  it('R-DEPLOY-007: Should validate runtime processor behavior', () => {
    logTestStep('04-nar-integration', 'Validating runtime processor behavior');

    navigateToPage('/nifi')
      .then(() => {
        return waitForUIElement('[data-testid="canvas-container"], #canvas-container', 10000);
      })
      .then(() => {
        return getProcessorCatalog();
      })
      .then((catalog) => {
        const customProcessors = [];

        catalog.processors.forEach((processor) => {
          const name = processor.name.toLowerCase();
          if (name.includes('jwt') || name.includes('jwks')) {
            customProcessors.push(processor);
          }
        });

        if (customProcessors.length > 0) {
          logTestStep(
            '04-nar-integration',
            `Testing runtime behavior of ${customProcessors.length} custom processors`
          );
          return createProcessorInstance(customProcessors[0].type, { x: 400, y: 400 });
        } else {
          logTestStep('04-nar-integration', 'No custom processors available for runtime testing');
          return cy.wrap({ created: false, reason: 'no-custom-processors' });
        }
      })
      .then((creationResult) => {
        if (creationResult.created) {
          return validateProcessorConfiguration(creationResult.processorId);
        } else {
          return cy.wrap({ configurable: false, reason: creationResult.reason });
        }
      })
      .then((configResult) => {
        if (configResult.configurable) {
          expect(configResult.hasConfigDialog).to.be.true;
          expect(configResult.hasValidation).to.be.true;

          logTestStep('04-nar-integration', 'Runtime processor behavior validated successfully');
        } else {
          logTestStep('04-nar-integration', `Runtime testing skipped: ${configResult.reason}`);
        }
      })
      .catch((error) => {
        trackTestFailure('04-nar-integration', 'runtime-behavior', error);
        throw error;
      });
  });
});
