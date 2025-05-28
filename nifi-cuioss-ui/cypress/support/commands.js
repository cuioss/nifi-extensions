// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// Example custom command (can be removed or modified)
// Cypress.Commands.add('customLogin', (username, password) => {
//   cy.log(`Logging in as ${username}`);
//   // Add actual login steps here
// });

// It's common practice to import commands.js in the e2e.js (or formerly index.js)
// However, Cypress automatically includes any file in the support folder,
// so an explicit import in e2e.js for commands.js is often not strictly necessary
// as long as the supportFile setting in cypress.config.js is correct.
// For clarity, one might still add `import './commands'` to e2e.js.

// The specification document shows example custom commands like:
// Cypress.Commands.add('login', (username, password) => { ... });
// Cypress.Commands.add('navigateToProcessorVerification', () => { ... });
// These would be added here as needed.
