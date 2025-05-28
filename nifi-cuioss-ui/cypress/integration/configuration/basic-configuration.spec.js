// nifi-cuioss-ui/cypress/integration/configuration/basic-configuration.spec.js

import NifiCanvasPage from '../../support/page-objects/nifi-canvas';
import ProcessorConfigurationPage from '../../support/page-objects/processor-configuration';

describe('MultiIssuerJWTTokenAuthenticator Basic Configuration', () => {
  const processorType = 'MultiIssuerJWTTokenAuthenticator';
  // Using the processorType as the title for simplicity in this test.
  // In a real scenario, you might want a more unique identifier if multiple instances are used.
  const processorTitle = processorType;

  beforeEach(() => {
    // Login as admin as processor addition/configuration is typically an admin task
    cy.login('admin', 'adminadminadmin'); 
    
    // Visit the NiFi canvas after login. cy.login sets the token and visits nifiUrl.
    // NifiCanvasPage.visit(); // Not strictly needed if cy.login already lands on canvas and nifiUrl is baseUrl
    // Ensure canvas is loaded. cy.login calls waitForCanvasToLoad internally.
    NifiCanvasPage.waitForCanvasToLoad(); 
  });

  afterEach(() => {
    // Clean up the processor if it exists
    // Ensure canvas is loaded before trying to interact with it for cleanup
    NifiCanvasPage.waitForCanvasToLoad(); 
    NifiCanvasPage.checkProcessorExists(processorTitle, 0).then(exists => {
      if (exists) {
        cy.log(`Cleaning up processor: ${processorTitle}`);
        // It's possible the processor is still selected or has a context menu open
        // Clicking on the body can help reset UI state before attempting deletion
        cy.get('body').click(0,0, { force: true }); // Click top-left corner of body
        NifiCanvasPage.deleteProcessor(processorTitle);
        NifiCanvasPage.waitForProcessorToBeRemoved(processorTitle);
      } else {
        cy.log(`Processor ${processorTitle} not found during cleanup, skipping deletion.`);
      }
    });
  });

  it('should allow basic and advanced properties to be configured and saved', () => {
    const tokenLocationValue = 'AUTHORIZATION_HEADER';
    const headerNameValue = 'Authorization-Test-E2E'; // Made more unique
    const maxTokenSizeValue = '8 KB';
    const refreshIntervalValue = '30 min';

    // Add the processor, ensuring it's unique for this test run
    NifiCanvasPage.addProcessor(processorType, processorTitle, true); // ensureUnique = true

    // Open its configuration
    NifiCanvasPage.openProcessorConfiguration(processorTitle);
    ProcessorConfigurationPage.getDialogTitle().should('contain.text', processorTitle);

    // Configure properties
    ProcessorConfigurationPage.setTokenLocation(tokenLocationValue);
    ProcessorConfigurationPage.setHeaderName(headerNameValue);
    ProcessorConfigurationPage.setMaxTokenSize(maxTokenSizeValue);
    ProcessorConfigurationPage.setRefreshInterval(refreshIntervalValue);

    // Save configuration
    ProcessorConfigurationPage.saveConfiguration();
    // The saveConfiguration method in PO now waits for dialog to not exist.

    // Re-open configuration to verify
    NifiCanvasPage.openProcessorConfiguration(processorTitle);
    ProcessorConfigurationPage.getDialogTitle().should('contain.text', processorTitle);

    // Verify properties
    ProcessorConfigurationPage.getTokenLocation().should('eq', tokenLocationValue);
    ProcessorConfigurationPage.getHeaderName().should('eq', headerNameValue);
    ProcessorConfigurationPage.getMaxTokenSize().should('eq', maxTokenSizeValue);
    ProcessorConfigurationPage.getRefreshInterval().should('eq', refreshIntervalValue);

    // Close the dialog
    ProcessorConfigurationPage.clickCancelButton();
  });
});
