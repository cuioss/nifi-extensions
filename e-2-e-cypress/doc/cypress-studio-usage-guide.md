# Using Cypress Studio

## Getting Started with Cypress Studio

Now that you've enabled Cypress Studio in your `cypress.config.js` file, you can use it to record tests interactively. This guide will walk you through the process of using Cypress Studio to create and modify tests.

## Opening Cypress Studio

1. Start Cypress in interactive mode:
   ```bash
   cd e-2-e-cypress
   npx cypress open
   ```

2. In the Cypress Test Runner, select "E2E Testing"

3. Choose a browser (Chrome is recommended for the best experience)

4. You'll see a list of your test files. You can either:
   - Select an existing test file to add commands to
   - Create a new test file by clicking "Create new spec"

## Recording a New Test

If you're creating a new test:

1. Click "Create new spec"
2. Enter a name for your spec file (e.g., `my-recorded-test.cy.js`)
3. Click "Create spec"
4. Click "Run spec" to open the test in the browser

Once your test is open in the browser:

1. Click the "Add commands" button in the right sidebar (it looks like a plus sign)
2. This will start the recording mode
3. Interact with your application (NiFi) as you normally would
4. Cypress will record your actions and generate test commands
5. When you're done, click "Save commands" to add them to your test

## Adding Commands to an Existing Test

If you're adding commands to an existing test:

1. Select the test file from the list
2. Click "Run spec" to open the test in the browser
3. The test will run automatically
4. After the test completes, click on a test in the left sidebar
5. Click the "Add commands" button in the right sidebar
6. Interact with your application
7. Click "Save commands" when done

## Example: Recording a Processor Addition Test

Here's how to record a test that adds a processor to the NiFi canvas:

1. Open Cypress Studio and select or create a test
2. Make sure you're logged in to NiFi (run the authentication test first if needed)
3. Click "Add commands"
4. In the NiFi UI:
   - Click the "Add Processor" button in the toolbar
   - Type a processor name in the search field (e.g., "GenerateFlowFile")
   - Select the processor from the list
   - Click "Add" to add it to the canvas
   - Verify the processor appears on the canvas
5. Click "Save commands" to add these actions to your test

## Editing Recorded Commands

After recording, you might want to edit the generated commands:

1. The recorded commands will appear in your test file
2. You can modify them directly in the Cypress Test Runner or in your code editor
3. Add assertions to verify expected behavior:
   ```javascript
   // Example assertion to add after recording
   cy.get('svg g.component').should('exist');
   cy.get('svg g.component').should('contain', 'GenerateFlowFile');
   ```

## Tips for Effective Recording

1. **Start with a clean state**: Make sure your application is in a known state before recording
2. **Record one workflow at a time**: Focus on recording a single, specific workflow
3. **Use descriptive test names**: Name your tests based on what they're testing
4. **Add assertions manually**: Recording tools typically don't add assertions, so add them manually after recording
5. **Edit recorded selectors**: Sometimes the generated selectors might not be optimal; edit them for better reliability
6. **Use custom commands**: Replace repetitive recorded actions with custom commands from your support files

## Troubleshooting

- **Recording not working**: Make sure `experimentalStudio: true` is correctly set in your `cypress.config.js`
- **Actions not being recorded**: Try clicking more deliberately and waiting for elements to fully load
- **Selectors not working**: Edit the generated selectors to make them more robust
- **Test fails when replayed**: Add wait commands or use more reliable selectors

## Next Steps

After recording your tests:

1. Run them to make sure they work as expected
2. Add assertions to verify the correct behavior
3. Refactor them to make them more maintainable
4. Add them to your test suite

For more information, refer to the [official Cypress Studio documentation](https://docs.cypress.io/guides/references/cypress-studio).