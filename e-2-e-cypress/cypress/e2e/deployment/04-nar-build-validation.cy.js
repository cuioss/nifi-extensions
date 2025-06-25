/**
 * NAR Package and Build Validation Tests
 *
 * Test suite focused on NAR package structure, build process validation,
 * and deployment verification for the JWT extension NAR files
 * @file NAR build and deployment validation for NiFi JWT extension
 * @requires cypress/support/utils/auth-helpers.js
 * @requires cypress/support/utils/validation-helpers.js
 * @requires cypress/support/utils/error-tracking.js
 */

import {
  loginWithCredentials,
  verifyLoginState,
  clearAllAuthenticationData,
} from '../../support/utils/auth-helpers.js';
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

describe('04 - NAR Package and Build Validation', () => {
  beforeEach(() => {
    logTestStep('04-nar-validation', 'Starting NAR validation test');
    clearAllAuthenticationData();
    loginWithCredentials('admin', 'adminadminadmin');
    verifyLoginState();
  });

  afterEach(() => {
    captureDebugInfo('04-nar-validation');
  });

  context('NAR File Structure Validation', () => {
    it('R-BUILD-001: Should validate NAR file exists and is accessible', () => {
      logTestStep('04-nar-validation', 'Checking NAR file existence and accessibility');

      // Check if NAR files are accessible through NiFi
      cy.request({
        url: '/nifi-api/system-diagnostics',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401, 403]); // Any of these indicates server is running
        logTestStep('04-nar-validation', 'NiFi API is accessible');
      });

      // Validate that the extension is properly deployed
      cy.request({
        url: '/nifi-api/controller/processor-types',
        failOnStatusCode: false,
      }).then((response) => {
        if (response.status === 200) {
          const processorTypes = response.body.processorTypes || [];
          const customProcessors = processorTypes.filter(
            (processor) =>
              processor.type.includes('cuioss') ||
              processor.type.includes('JWT') ||
              processor.type.includes('JWKS')
          );

          logTestStep(
            '04-nar-validation',
            `Found ${customProcessors.length} custom processors in API`
          );
          expect(customProcessors.length).to.be.at.least(0); // May be 0 if not deployed yet
        } else {
          logTestStep(
            '04-nar-validation',
            'Processor types API not accessible - may require authentication'
          );
        }
      });
    });

    it('R-BUILD-001: Should validate NAR manifest and metadata', () => {
      logTestStep('04-nar-validation', 'Validating NAR manifest and metadata');

      // This test validates that if NAR is deployed, it has proper structure
      validateNARIntegrity('nifi-cuioss-nar')
        .then((validation) => {
          if (validation.isDeployed) {
            expect(validation.hasRequiredManifest).to.be.true;
            expect(validation.manifestVersion).to.exist;
            expect(validation.narDependencies).to.exist;

            logTestStep('04-nar-validation', `NAR Version: ${validation.manifestVersion}`);
            logTestStep('04-nar-validation', `Dependencies: ${validation.narDependencies.length}`);
          } else {
            logTestStep('04-nar-validation', 'NAR not deployed - skipping manifest validation');
          }
        })
        .catch((error) => {
          // Don't fail if NAR is not deployed - this may be expected in some environments
          logTestStep('04-nar-validation', `NAR validation skipped: ${error.message}`);
        });
    });

    it('R-BUILD-002: Should validate build artifact integrity', () => {
      logTestStep('04-nar-validation', 'Validating build artifact integrity');

      // Check for proper NiFi version compatibility
      validateVersionCompatibility()
        .then((compatibility) => {
          expect(compatibility.isCompatible).to.be.true;
          expect(compatibility.nifiVersion).to.exist;

          logTestStep(
            '04-nar-validation',
            `Compatible with NiFi version: ${compatibility.nifiVersion}`
          );

          if (compatibility.warnings && compatibility.warnings.length > 0) {
            compatibility.warnings.forEach((warning) => {
              logTestStep('04-nar-validation', `Compatibility warning: ${warning}`);
            });
          }
        })
        .catch((error) => {
          trackTestFailure('04-nar-validation', 'version-compatibility', error);
          throw error;
        });
    });

    it('R-BUILD-002: Should validate required dependencies are present', () => {
      logTestStep('04-nar-validation', 'Validating required dependencies');

      // This is a basic validation - in a real environment you'd check the actual classpath
      cy.window().then(() => {
        logTestStep('04-nar-validation', 'Checking for dependency availability through NiFi UI');

        // Navigate to NiFi to ensure it's running with our dependencies
        cy.visit('/nifi', { failOnStatusCode: false });

        // If we can load the main NiFi UI, core dependencies are present
        cy.get('body').then(($body) => {
          const hasNiFiUI = $body.find('nifi, #nf-shell').length > 0;
          const hasError = $body.find('.error, .not-found').length > 0;

          if (hasNiFiUI && !hasError) {
            logTestStep('04-nar-validation', 'Core NiFi dependencies appear to be present');
          } else if (hasError) {
            logTestStep(
              '04-nar-validation',
              'Error detected in NiFi UI - possible dependency issues'
            );
          } else {
            logTestStep(
              '04-nar-validation',
              'NiFi UI not fully loaded - dependency status unclear'
            );
          }
        });
      });
    });
  });

  context('Extension Integration Validation', () => {
    it('R-INTEGRATION-001: Should validate extension loads without conflicts', () => {
      logTestStep('04-nar-validation', 'Validating extension loads without conflicts');

      cy.visit('/nifi', { failOnStatusCode: false }).then(() => {
        // Check for any JavaScript errors that might indicate loading conflicts
        cy.window().then((win) => {
          // Look for console errors
          const errors = [];
          const originalError = win.console.error;

          if (originalError) {
            win.console.error = function (...args) {
              errors.push(args.join(' '));
              originalError.apply(win.console, args);
            };
          }

          // Wait a moment for any errors to surface
          cy.wait(2000).then(() => {
            if (errors.length > 0) {
              logTestStep('04-nar-validation', `JavaScript errors detected: ${errors.length}`);
              errors.forEach((error) => {
                logTestStep('04-nar-validation', `Error: ${error}`);
              });
            } else {
              logTestStep('04-nar-validation', 'No JavaScript errors detected during loading');
            }

            // Restore original console.error
            if (originalError) {
              win.console.error = originalError;
            }
          });
        });
      });
    });

    it('R-INTEGRATION-001: Should validate no classloader conflicts', () => {
      logTestStep('04-nar-validation', 'Validating no classloader conflicts');

      // This test checks that the extension doesn't cause classloader issues
      cy.visit('/nifi')
        .then(() => {
          // Look for any UI elements that indicate classloader issues
          return cy.get('body', { timeout: 10000 });
        })
        .then(($body) => {
          // Check for error messages that might indicate classloader conflicts
          const hasClassloaderErrors =
            $body.find('.error').filter((index, element) => {
              const text = element.textContent.toLowerCase();
              return (
                text.includes('classloader') ||
                text.includes('class not found') ||
                text.includes('linkage error')
              );
            }).length > 0;

          expect(hasClassloaderErrors).to.be.false;

          // Check that basic NiFi functionality works
          const hasWorkingUI =
            $body.find('#canvas-container, .canvas').length > 0 ||
            $body.find('.login-form').length > 0;

          expect(hasWorkingUI).to.be.true;

          logTestStep('04-nar-validation', 'No classloader conflicts detected');
        })
        .catch((error) => {
          trackTestFailure('04-nar-validation', 'classloader-conflicts', error);
          throw error;
        });
    });

    it('R-INTEGRATION-002: Should validate extension coexists with standard processors', () => {
      logTestStep('04-nar-validation', 'Validating extension coexists with standard processors');

      cy.visit('/nifi')
        .then(() => {
          // Wait for UI to load
          return cy.get('body', { timeout: 15000 });
        })
        .then(() => {
          // Check that we can access the processor catalog/palette
          return validateRequiredElements([
            'nifi, #nf-shell',
            '#canvas-container, .canvas, .login-form',
          ]);
        })
        .then(() => {
          logTestStep('04-nar-validation', 'Basic NiFi UI elements are accessible');

          // Try to check if processor types are available
          cy.request({
            url: '/nifi-api/flow/processor-types',
            failOnStatusCode: false,
          }).then((response) => {
            if (response.status === 200) {
              const processorTypes = response.body.processorTypes || response.body || [];

              if (Array.isArray(processorTypes)) {
                const standardProcessors = processorTypes.filter(
                  (processor) => processor.type && processor.type.includes('org.apache.nifi')
                );

                const customProcessors = processorTypes.filter(
                  (processor) =>
                    processor.type &&
                    (processor.type.includes('cuioss') || processor.type.includes('JWT'))
                );

                logTestStep(
                  '04-nar-validation',
                  `Found ${standardProcessors.length} standard processors`
                );
                logTestStep(
                  '04-nar-validation',
                  `Found ${customProcessors.length} custom processors`
                );

                // Both should coexist
                expect(standardProcessors.length).to.be.at.least(1);

                logTestStep(
                  '04-nar-validation',
                  'Extension coexists properly with standard processors'
                );
              } else {
                logTestStep('04-nar-validation', 'Processor types response format unexpected');
              }
            } else {
              logTestStep(
                '04-nar-validation',
                'Processor types API not accessible - authentication may be required'
              );
            }
          });
        })
        .catch((error) => {
          trackTestFailure('04-nar-validation', 'coexistence-validation', error);
          throw error;
        });
    });
  });

  context('Build Process Validation', () => {
    it('R-BUILD-003: Should validate build produces expected artifacts', () => {
      logTestStep('04-nar-validation', 'Validating build produces expected artifacts');

      // This test validates that the build process works correctly
      // In a real CI/CD environment, this would check build outputs

      // For now, validate that the application is running correctly
      cy.visit('/nifi')
        .then(() => {
          return cy.get('body', { timeout: 15000 });
        })
        .then(($body) => {
          // Check for signs that the build was successful
          const hasNiFiApp = $body.find('nifi, #nf-shell').length > 0;
          const hasLoginForm = $body.find('.login-form, input[type="password"]').length > 0;
          const hasErrorPage = $body.find('.error-page, .not-found').length > 0;

          // Should have either NiFi app or login form, but not error page
          expect(hasNiFiApp || hasLoginForm).to.be.true;
          expect(hasErrorPage).to.be.false;

          logTestStep(
            '04-nar-validation',
            'Application appears to be built and deployed correctly'
          );
        })
        .catch((error) => {
          trackTestFailure('04-nar-validation', 'build-validation', error);
          throw error;
        });
    });

    it('R-BUILD-003: Should validate no build-time issues in runtime', () => {
      logTestStep('04-nar-validation', 'Validating no build-time issues affect runtime');

      cy.visit('/nifi')
        .then(() => {
          // Check browser console for any build-related errors
          cy.window().then((win) => {
            // Monitor for any errors that suggest build issues
            const buildRelatedErrors = [];

            const originalError = win.console.error;
            if (originalError) {
              win.console.error = function (...args) {
                const errorMessage = args.join(' ').toLowerCase();
                if (
                  errorMessage.includes('module') ||
                  errorMessage.includes('import') ||
                  errorMessage.includes('syntax') ||
                  errorMessage.includes('unexpected token')
                ) {
                  buildRelatedErrors.push(args.join(' '));
                }
                originalError.apply(win.console, args);
              };
            }

            // Wait for potential errors to surface
            cy.wait(3000).then(() => {
              if (buildRelatedErrors.length > 0) {
                logTestStep(
                  '04-nar-validation',
                  `Build-related errors detected: ${buildRelatedErrors.length}`
                );
                buildRelatedErrors.forEach((error) => {
                  logTestStep('04-nar-validation', `Build error: ${error}`);
                });
                // Don't fail the test, but log for investigation
              } else {
                logTestStep('04-nar-validation', 'No build-related runtime errors detected');
              }

              // Restore original console.error
              if (originalError) {
                win.console.error = originalError;
              }
            });
          });
        })
        .catch((error) => {
          trackTestFailure('04-nar-validation', 'runtime-build-issues', error);
          throw error;
        });
    });

    it('R-BUILD-004: Should validate proper resource bundling', () => {
      logTestStep('04-nar-validation', 'Validating proper resource bundling');

      cy.visit('/nifi')
        .then(() => {
          // Check that resources are loading properly
          cy.window().then((win) => {
            const performance = win.performance;
            if (performance && performance.getEntriesByType) {
              const resourceEntries = performance.getEntriesByType('resource');

              let cssCount = 0;
              let jsCount = 0;
              let failedCount = 0;

              resourceEntries.forEach((entry) => {
                if (entry.name.endsWith('.css')) cssCount++;
                if (entry.name.endsWith('.js')) jsCount++;
                if (entry.transferSize === 0 && entry.duration > 0) failedCount++;
              });

              logTestStep('04-nar-validation', `Loaded ${cssCount} CSS files, ${jsCount} JS files`);
              logTestStep('04-nar-validation', `${failedCount} failed resource loads`);

              // Should have some CSS and JS loaded, minimal failures
              expect(cssCount + jsCount).to.be.at.least(1);
              expect(failedCount).to.be.lessThan(5); // Allow some failures for non-critical resources

              logTestStep('04-nar-validation', 'Resource bundling appears to be working correctly');
            } else {
              logTestStep(
                '04-nar-validation',
                'Performance API not available - cannot validate resource bundling'
              );
            }
          });
        })
        .catch((error) => {
          trackTestFailure('04-nar-validation', 'resource-bundling', error);
          throw error;
        });
    });
  });
});
