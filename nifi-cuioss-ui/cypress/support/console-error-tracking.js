// nifi-cuioss-ui/cypress/support/console-error-tracking.js
import allowedWarnings from './console-warnings-allowlist';

const consoleErrors = [];
const consoleWarnings = [];

beforeEach(() => {
  // Clear previous errors/warnings
  consoleErrors.length = 0;
  consoleWarnings.length = 0;

  cy.window().then((win) => {
    // Intercept console.error
    // Using a function that preserves the original call if needed for debugging,
    // but for now, we just collect.
    cy.stub(win.console, 'error').callsFake((...args) => {
      // Format arguments into a single string message
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message + (arg.stack ? `\n${arg.stack}` : '');
        }
        return typeof arg === 'string' ? arg : JSON.stringify(arg);
      }).join(' ');
      consoleErrors.push(message);
      // To still see it in dev tools during test development:
      // win.console.error.wrappedMethod.apply(win.console, args);
    });

    // Intercept console.warn
    cy.stub(win.console, 'warn').callsFake((...args) => {
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message + (arg.stack ? `\n${arg.stack}` : '');
        }
        return typeof arg === 'string' ? arg : JSON.stringify(arg);
      }).join(' ');
      
      // Only track warnings that are not in the allowed list
      if (!allowedWarnings.some(allowed => message.includes(allowed))) {
        consoleWarnings.push(message);
      }
      // To still see it in dev tools during test development:
      // win.console.warn.wrappedMethod.apply(win.console, args);
    });
  });
});

afterEach(() => {
  if (consoleErrors.length > 0) {
    // Fail the test if there are console errors
    throw new Error(`Found ${consoleErrors.length} console error(s): \n\n${consoleErrors.join('\n\n')}`);
  }
  if (consoleWarnings.length > 0) {
    // Fail the test if there are unexpected console warnings
    throw new Error(`Found ${consoleWarnings.length} unexpected console warning(s): \n\n${consoleWarnings.join('\n\n')}`);
  }
});
