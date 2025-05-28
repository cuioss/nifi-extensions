// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

import NifiCanvasPage from './page-objects/nifi-canvas';
// ProcessorConfigurationPage is not directly used by these commands, but good to keep for context
// import ProcessorConfigurationPage from './page-objects/processor-configuration';


/**
 * Fetches an access token from Keycloak.
 * @param {string} username - The username.
 * @param {string} password - The password.
 * @returns {Cypress.Chainable<string>} - The access token.
 */
Cypress.Commands.add('getAccessToken', (username, password) => {
  const keycloakUrl = Cypress.env('keycloakUrl');
  const realm = Cypress.env('keycloakRealm');
  const clientId = Cypress.env('keycloakClientId');
  const clientSecret = Cypress.env('keycloakClientSecret');

  if (!keycloakUrl || !realm || !clientId || !clientSecret) {
    throw new Error(
      'Missing Keycloak configuration in Cypress environment variables. ' +
      'Please ensure keycloakUrl, keycloakRealm, keycloakClientId, and keycloakClientSecret are set.'
    );
  }

  const tokenEndpoint = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;

  return cy.request({
    method: 'POST',
    url: tokenEndpoint,
    form: true, // Indicates an application/x-www-form-urlencoded request
    body: {
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password,
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).then((response) => {
    if (response.status !== 200 || !response.body.access_token) {
      Cypress.log({
        name: 'getAccessToken',
        message: `Failed to fetch access token. Status: ${response.status}`,
        consoleProps: () => ({
          response,
        }),
      });
      throw new Error(`Failed to fetch access token. Status: ${response.status}. Check console for details.`);
    }
    return response.body.access_token;
  });
});

/**
 * Logs into NiFi by obtaining a JWT and setting it in localStorage.
 * @param {string} username - The username.
 * @param {string} password - The password.
 */
Cypress.Commands.add('login', (username, password) => {
  cy.getAccessToken(username, password).then((token) => {
    // Store the token in localStorage as per subtask instructions
    // Note: This might not be how the actual NiFi UI expects the token for this specific extension.
    // The end-to-end-testing.adoc specification showed a UI-based login.
    // This implementation follows the subtask's specific directive.
    cy.window().then((win) => {
      win.localStorage.setItem('jwt', token); // Assuming 'jwt' is the key NiFi UI expects.
    });
  });

  const nifiUrl = Cypress.env('nifiUrl');
  if (!nifiUrl) {
    throw new Error('Missing nifiUrl in Cypress environment variables.');
  }
  cy.visit(nifiUrl);
  NifiCanvasPage.waitForCanvasToLoad(); // Verification step
});

/**
 * Navigates to the Controller Services page in NiFi.
 */
Cypress.Commands.add('navigateToControllerServices', () => {
  // These selectors are educated guesses based on common NiFi UI patterns.
  // Actual data-testid attributes should be confirmed from the UI.
  cy.get('[data-testid="nifi-toolbar-hamburger-menu"]').click();
  cy.get('[data-testid="navigation-menu-item-controller-services"]').click();
  // Verification: Check for a unique element on the Controller Services page
  cy.get('[data-testid="controller-services-page-title"]', { timeout: 10000 }).should('be.visible');
});

/**
 * Navigates into a Process Group on the NiFi canvas.
 * @param {string} pgName - The name of the Process Group.
 */
Cypress.Commands.add('navigateToProcessGroup', (pgName) => {
  // Selector for Process Group might need adjustment based on actual DOM structure.
  // This assumes process groups can be identified by a title or contained text.
  // The NifiCanvasPage.getProcessor uses title attribute, which might not apply to PGs.
  // Using a more generic approach here.
  cy.log(`Navigating to Process Group: ${pgName}`);
  // Attempting to find based on data-component-type and text content.
  // This is an educated guess for process group identification.
  cy.get(`[data-testid^="process-group-component"][title*="${pgName}"], [data-testid="process-group-name"]:contains("${pgName}")`)
    .first() // Take the first match if multiple
    .dblclick();

  // Verification: Check for a breadcrumb or other element indicating current scope.
  // This data-testid is an educated guess.
  cy.get('[data-testid="breadcrumb-current-process-group"]', { timeout: 10000 }).should('contain.text', pgName);
});

/**
 * Navigates to the configuration dialog of a specific processor.
 * @param {string} processorNameOrId - The name or ID of the processor.
 */
Cypress.Commands.add('navigateToProcessorConfiguration', (processorNameOrId) => {
  cy.log(`Navigating to configuration for processor: ${processorNameOrId}`);
  NifiCanvasPage.openProcessorConfiguration(processorNameOrId);
  // Verification is already part of NifiCanvasPage.openProcessorConfiguration()
  // (waits for '[data-testid="processor-configuration-dialog"]')
});
