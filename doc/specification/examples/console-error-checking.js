// cypress/support/console-warnings-allowlist.js
module.exports = [
  // Third-party library warnings that cannot be fixed
  'Warning: validateDOMNesting(...): <div> cannot appear as a descendant of <p>.',
  'DevTools failed to load source map',
  'Content Security Policy violation for inline script',
  
  // Deprecated API usage warnings from third-party libraries
  'Synchronous XMLHttpRequest on the main thread is deprecated',
  
  // Browser-specific warnings
  '[Firefox] Unable to preventdefault inside passive event listener',
  '[Chrome] Provider for: vscode-resource'
];

// cypress/support/commands.js
import allowedWarnings from './console-warnings-allowlist';

Cypress.Commands.add('monitorConsole', () => {
  // Track console errors and warnings
  const consoleErrors = [];
  const consoleWarnings = [];

  // Clear previous errors/warnings
  consoleErrors.length = 0;
  consoleWarnings.length = 0;
  
  // Intercept console.error
  cy.window().then((win) => {
    cy.stub(win.console, 'error').callsFake((msg) => {
      consoleErrors.push(msg);
    });
    
    // Intercept console.warn
    cy.stub(win.console, 'warn').callsFake((msg) => {
      // Only track warnings that are not in the allowed list
      if (!allowedWarnings.some(allowed => msg.includes(allowed))) {
        consoleWarnings.push(msg);
      }
    });
  });

  // Return the captured errors and warnings for later verification
  return cy.wrap({ consoleErrors, consoleWarnings });
});

Cypress.Commands.add('verifyNoConsoleIssues', ({ consoleErrors, consoleWarnings }) => {
  // Verify no unexpected console errors
  expect(consoleErrors.length).to.equal(0, 
    `Found ${consoleErrors.length} console errors: ${consoleErrors.join(', ')}`);
  
  // Verify no unexpected console warnings
  expect(consoleWarnings.length).to.equal(0, 
    `Found ${consoleWarnings.length} console warnings: ${consoleWarnings.join(', ')}`);
});

// Example test using console monitoring
describe('Basic Processor Configuration with Console Checking', () => {
  let consoleState;

  beforeEach(() => {
    // Login to NiFi and navigate to canvas
    cy.login('admin', 'adminadminadmin');
    cy.visit('https://localhost:9095/nifi/');
    
    // Start monitoring console
    cy.monitorConsole().then(state => {
      consoleState = state;
    });
  });

  afterEach(() => {
    // Verify no unexpected console errors or warnings
    cy.verifyNoConsoleIssues(consoleState);
  });

  it('should configure processor with Keycloak JWKS endpoint without console errors', () => {
    // Test implementation
    cy.get('[data-testid="add-processor-button"]').click();
    cy.get('[data-testid="processor-type-filter"]').type('MultiIssuerJWTTokenAuthenticator');
    cy.get('[data-testid="processor-type-item"]:contains("MultiIssuerJWTTokenAuthenticator")').click();
    
    // Continued test implementation...
  });
});
