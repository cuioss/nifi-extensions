// cypress/support/page-objects/processor-configuration.js
class ProcessorConfigurationPage {
  // Selectors
  getPropertyInput(name) {
    return cy.get(`[data-testid="property-input"][name="${name}"]`);
  }

  getDynamicPropertyAddButton() {
    return cy.get('[data-testid="dynamic-property-add-button"]');
  }

  getDynamicPropertyNameInput() {
    return cy.get('[data-testid="dynamic-property-name"]');
  }

  getDynamicPropertyValueInput() {
    return cy.get('[data-testid="dynamic-property-value"]');
  }

  getVerifyJwksButton() {
    return cy.get('[data-testid="verify-jwks-button"]');
  }

  getVerificationResult() {
    return cy.get('[data-testid="verification-result"]');
  }

  getOkButton() {
    // Assuming a common OK button for processor config dialogs
    return cy.get('[data-testid="processor-config-ok-button"], [data-testid="confirm-button"], button:contains("OK"), button:contains("Apply")').first();
  }

  getSaveButton() {
    // More specific if there's a save button distinct from OK/Apply
    return cy.get('button:contains("Save"), [data-testid="save-button"]');
  }

  // Actions
  setBasicProperties(tokenLocation = 'AUTHORIZATION_HEADER', headerName = 'Authorization') {
    this.getPropertyInput('jwt.validation.token.location').select(tokenLocation);
    this.getPropertyInput('jwt.validation.token.header').clear().type(headerName);
    return this;
  }

  addIssuer(name, url) {
    this.getDynamicPropertyAddButton().click();
    this.getDynamicPropertyNameInput().type(name);
    this.getDynamicPropertyValueInput().type(url);
    return this;
  }

  validateJwksEndpoint() {
    this.getVerifyJwksButton().click();
    // Adding a timeout as validation can take time
    this.getVerificationResult({ timeout: 10000 }).should('contain', 'Connection successful');
    return this;
  }

  saveConfiguration() {
    this.getOkButton().click();
    // Add a small wait for dialog to close, if necessary
    // cy.wait(500); 
  }

  applyConfiguration() {
    // Some dialogs use "Apply"
    this.getOkButton().click(); 
  }
}

export default new ProcessorConfigurationPage();
