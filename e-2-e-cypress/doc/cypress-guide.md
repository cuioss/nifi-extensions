# Using Cypress with NiFi

This guide demonstrates how to use Cypress for testing NiFi extensions. It covers running tests, key concepts, and common patterns used in the NiFi Cypress tests.

## Running Cypress Tests

### Prerequisites

Before running the tests, ensure you have:

1. Node.js and npm installed
2. NiFi running on the configured URL (default: https://localhost:9095/nifi)
3. All dependencies installed by running `npm install` in the e-2-e-cypress directory

### Running Tests in Headless Mode

To run all tests in headless mode (without a browser UI):

```bash
cd e-2-e-cypress
npm run cypress:run
```

To run a specific test file:

```bash
cd e-2-e-cypress
npx cypress run --spec "cypress/e2e/01-nifi-authentication.cy.js"
```

For faster feedback with minimal reporting:

```bash
cd e-2-e-cypress
npm run cypress:run:failfast
```

To record videos of the test runs:

```bash
cd e-2-e-cypress
npm run cypress:run:video
```

### Running Tests in Interactive Mode

To open Cypress in interactive mode with the browser UI:

```bash
cd e-2-e-cypress
npm run cypress:open
```

This opens the Cypress Test Runner, where you can:
- Select which browser to use
- Click on a test file to run it
- Watch the test execution in real-time
- See detailed logs and errors
- Inspect the DOM and network requests

## Key Cypress Concepts

### Custom Commands

The NiFi Cypress tests use several custom commands defined in the support files:

- `cy.ensureNiFiReady()` - Ensures NiFi is ready for testing (handles authentication)
- `cy.loginNiFi()` - Logs in to NiFi with default credentials
- `cy.navigateToPage()` - Navigates to a specific page type
- `cy.verifyPageType()` - Verifies the current page type
- `cy.getSessionContext()` - Gets the current session context
- `cy.clearSession()` - Clears the current session
- `cy.cleanupCanvasProcessors()` - Cleans up any existing processors from previous tests
- `cy.findProcessorOnCanvas()` - Finds a processor on the canvas
- `cy.addProcessorToCanvas()` - Adds a processor to the canvas
- `cy.removeProcessorFromCanvas()` - Removes a processor from the canvas
- `cy.openAddProcessorDialog()` - Opens the Add Processor dialog

### Selectors

The tests use selectors defined in `constants.js` to target elements in the NiFi UI:

```javascript
export const SELECTORS = {
  // Canvas selectors
  CANVAS: '#canvas-container',
  CANVAS_CONTAINER: 'mat-sidenav-content',
  
  // Processor selectors
  PROCESSOR_GROUP: 'svg g[class*="processor"], svg g[data-type*="processor"], svg .component',
  
  // Dialog selectors
  ADD_PROCESSOR_DIALOG: 'mat-dialog-container, .mat-dialog-container, [role="dialog"]',
  
  // Login selectors
  USERNAME_INPUT: '[data-testid="username"], input[type="text"], input[id*="username"], input[name="username"]',
  PASSWORD_INPUT: '[data-testid="password"], input[type="password"], input[id*="password"], input[name="password"]',
  LOGIN_BUTTON: '[data-testid="login-button"], input[value="Login"], button[type="submit"], button:contains("Login")'
};
```

### Assertions

The tests use Cypress assertions to verify expected behavior:

```javascript
// Simple assertions
cy.get('mat-sidenav-content, .mat-drawer-content').should('be.visible');
cy.get('button, a, [role="button"]').should('exist');

// Assertions with expect
cy.getSessionContext().then((session) => {
  expect(session.isLoggedIn).to.be.true;
  expect(session.pageType).to.equal('MAIN_CANVAS');
});

// Assertions with multiple conditions
cy.get('mat-sidenav-content svg, .mat-drawer-content svg')
  .should('exist')
  .should('have.length.greaterThan', 0);
```

### Screenshots and Debugging

The tests use screenshots and logging for debugging:

```javascript
// Take a screenshot
cy.screenshot('before-processor-selection', { capture: 'viewport' });

// Log messages
cy.log('[DEBUG_LOG] Starting processor type selection for: ' + processorType);

// Capture detailed DOM state
function captureCanvasState(stage, screenshotName) {
  cy.log(`[DEBUG_LOG] Capturing canvas state at stage: ${stage}`);
  
  return cy.get('body').then(($body) => {
    // Log basic structure
    const svgElements = $body.find('svg');
    cy.log(`[DEBUG_LOG] SVG elements: ${svgElements.length}`);
    
    // Take a screenshot
    cy.screenshot(screenshotName, { capture: 'viewport' });
  });
}
```

## Common Cypress Patterns

### Authentication Pattern

```javascript
// Navigate to login page
cy.navigateToPage(PAGE_TYPES.LOGIN);

// Login with default credentials
cy.loginNiFi();

// Verify authentication
cy.getSessionContext().then((session) => {
  expect(session.isLoggedIn).to.be.true;
  expect(session.pageType).to.equal('MAIN_CANVAS');
});
```

### Navigation Pattern

```javascript
// Ensure NiFi is ready (handles authentication)
cy.ensureNiFiReady();

// Verify page type
cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

// Verify canvas elements
cy.get('mat-sidenav-content, .mat-drawer-content').should('be.visible');
cy.get('mat-sidenav-content svg, .mat-drawer-content svg').should('exist');
```

### Processor Operations Pattern

```javascript
// Ensure NiFi is ready
cy.ensureNiFiReady();

// Clean up existing processors
cy.cleanupCanvasProcessors();

// Verify canvas is ready
cy.verifyPageType(PAGE_TYPES.MAIN_CANVAS, { waitForReady: true });

// Open Add Processor dialog
cy.openAddProcessorDialog({ timeout: 15000 }).then((dialogResult) => {
  // Verify dialog opened successfully
  cy.get('body').then(($body) => {
    const dialogSelectors = [
      'mat-dialog-container',
      '.mat-dialog-container',
      '[role="dialog"]'
    ];
    
    let dialogFound = false;
    for (const selector of dialogSelectors) {
      if ($body.find(selector).length > 0) {
        dialogFound = true;
        break;
      }
    }
    
    expect(dialogFound).to.be.true;
    
    // Search for processor
    const searchSelector = 'input[placeholder*="Search"]';
    cy.get(searchSelector).clear().type('JWTTokenAuthenticator');
    
    // Close dialog
    const cancelSelector = 'button:contains("Cancel")';
    cy.get(cancelSelector).click();
  });
});
```

## Best Practices

1. **Use Custom Commands**: Create custom commands for common operations to make tests more readable and maintainable.

2. **Resilient Selectors**: Use multiple selectors with fallbacks to handle UI changes.

3. **Proper Test Setup and Cleanup**: Use `beforeEach` and `afterEach` hooks to set up and clean up the test environment.

4. **Detailed Logging**: Use `cy.log()` to provide detailed information about test execution.

5. **Screenshots for Debugging**: Take screenshots at key points for visual verification.

6. **Explicit Assertions**: Use explicit assertions that will fail the test if conditions aren't met.

7. **Error Handling**: Handle errors gracefully with try/catch blocks and conditional logic.

8. **Test Isolation**: Ensure tests are isolated and don't depend on each other.

## Troubleshooting

### Common Issues

1. **Authentication Failures**: Ensure NiFi is running and accessible at the configured URL.

2. **Selector Not Found**: Check if the UI structure has changed and update selectors accordingly.

3. **Timeouts**: Increase timeouts for slow operations or network requests.

4. **Certificate Errors**: Use the `--ignore-certificate-errors` flag when running Cypress.

### Debugging Tips

1. **Enable Verbose Logging**: Set the `DEBUG` environment variable to enable verbose logging:
   ```bash
   DEBUG=cypress:* npm run cypress:open
   ```

2. **Analyze Console Logs**: Use the log analyzer script to analyze console logs:
   ```bash
   npm run analyze:logs
   ```

3. **Check Browser Logs**: Browser logs are saved to `target/browser-logs/` for analysis.

4. **Review Test Reports**: Test reports are saved to `target/tests-report/` for review.