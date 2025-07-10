# Cypress Recording Guide

## Introduction to Cypress Recording

This guide explains how to record user interactions to create Cypress tests for NiFi. Recording your interactions can help you quickly create tests without writing code manually.

## Recording Tools for Cypress

### 1. Cypress Studio (Built-in)

Cypress Studio is a built-in feature that allows you to record interactions directly in the Cypress Test Runner.

#### Setup Cypress Studio

1. Enable Cypress Studio in your `cypress.config.js` file:

```javascript
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    // ... other configuration
    experimentalStudio: true
  },
});
```

#### Using Cypress Studio

1. Run Cypress in interactive mode:
   ```bash
   npx cypress open
   ```

2. Select a test file to open or create a new one.

3. Click the "Add Commands" button in the test runner to start recording.

4. Perform your actions in the application (clicks, typing, etc.).

5. Cypress will record your actions and generate test code.

6. Save the recorded commands to add them to your test.

### 2. Cypress Recorder Chrome Extension

The Cypress Recorder Chrome extension allows you to record interactions in your browser and export them as Cypress commands.

#### Installation and Setup

1. Install the Cypress Recorder extension from the Chrome Web Store:
   https://chrome.google.com/webstore/detail/cypress-recorder/glcapdcacdfkokcmicllhcjigeodacab

2. Open the extension in Chrome.

#### Recording with Cypress Recorder

1. Click the Cypress Recorder icon in your browser.

2. Click "Start Recording" and perform your actions in the NiFi UI.

3. Click "Stop Recording" when finished.

4. The extension will generate Cypress commands for your actions.

5. Copy the generated code and paste it into your Cypress test file.

### 3. Katalon Recorder

Katalon Recorder is another browser extension that can export recorded actions to Cypress format.

#### Installation and Setup

1. Install Katalon Recorder from the Chrome Web Store:
   https://chrome.google.com/webstore/detail/katalon-recorder-selenium/ljdobmomdgdljniojadhoplhkpialdid

2. Open the extension in Chrome.

#### Recording with Katalon

1. Click "Record" in the Katalon Recorder panel.

2. Perform your actions in the NiFi UI.

3. Click "Stop" when finished.

4. Select "Export" and choose "Cypress" as the format.

5. Copy the generated code and paste it into your Cypress test file.

## Best Practices for Recording

1. **Start with a clean state**: Ensure your application is in a known state before recording.

2. **Record one workflow at a time**: Focus on recording a single, specific workflow.

3. **Add assertions manually**: Recording tools typically don't add assertions, so add them manually after recording.

4. **Edit recorded tests**: Clean up the generated code to make it more maintainable.

5. **Use custom commands**: Replace repetitive recorded actions with custom commands.

## Example: Recording a NiFi Processor Addition

Here's an example of how to record adding a processor to the NiFi canvas:

1. Start the recording tool of your choice.

2. Navigate to the NiFi UI.

3. Click the "Add Processor" button in the toolbar.

4. Search for a processor type (e.g., "JWTTokenAuthenticator").

5. Select the processor from the list.

6. Click "Add" to add it to the canvas.

7. Stop recording.

8. The recording tool will generate Cypress commands similar to:

```javascript
cy.get('mat-toolbar button[aria-label*="Add"]').click();
cy.get('input[placeholder*="Search"]').type('JWTTokenAuthenticator');
cy.get('mat-list-item:contains("JWTTokenAuthenticator")').click();
cy.get('button:contains("Add")').click();
```

9. Add assertions to verify the processor was added successfully:

```javascript
cy.get('svg g[class*="processor"]').should('exist');
cy.get('svg g[class*="processor"]').should('contain', 'JWTTokenAuthenticator');
```

## Troubleshooting Recording Issues

- **Selectors not working**: Recording tools might generate selectors that don't work well with NiFi's UI. You may need to modify them manually.

- **Timing issues**: Add `cy.wait()` commands if the recorded test runs too quickly.

- **Complex interactions**: Some complex interactions (like drag-and-drop) might not record correctly and may need manual coding.

## Conclusion

Recording tools can significantly speed up test creation, especially for UI-heavy applications like NiFi. While they won't create perfect tests, they provide a great starting point that you can refine manually.

For more complex scenarios, consider using a combination of recording and manual coding to create robust, maintainable tests.