// cypress/support/page-objects/processor-configuration.js
class ProcessorConfigurationPage {
  constructor() {
    // Mapping of property labels/display names to their input 'name' attributes or specific data-testids
    // This helps in creating more readable test steps
    this.propertyMappings = {
      'Token Location': 'jwt.validation.token.location',
      'Header Name': 'jwt.validation.token.header',
      'Max Token Size': 'jwt.validation.max.token.size', // Assumed name attribute
      'Refresh Interval': 'jwt.validation.refresh.interval', // Assumed name attribute
      // Add other mappings as needed
    };
  }

  getDialogTitle(timeout = 10000) {
    // Example: Assumes a common testid for dialog titles
    return cy.get('[data-testid="processor-configuration-dialog-title"]', { timeout });
  }

  // Generic selector for property input based on its 'name' attribute via data-testid
  _getPropertyInputByName(nameAttribute) {
    return cy.get(`[data-testid="property-input"][name="${nameAttribute}"]`);
  }

  // Generic selector for property input by trying to find a label and its associated control
  _getPropertyInputByLabel(labelText) {
    return cy.contains('label', new RegExp(`^\\s*${labelText}\\s*$`,'i')) // Case-insensitive, trims whitespace
      .invoke('attr', 'for')
      .then((id) => {
        if (id) {
          return cy.get(`#${id}`);
        }
        // If 'for' attribute is not present, try to find common sibling patterns
        return cy.contains('label', new RegExp(`^\\s*${labelText}\\s*$`,'i'))
          .next('input, select, textarea, [data-testid*="input"], [data-testid*="select"]');
      });
  }
  
  _resolvePropertySelector(propertyName) {
    const nameAttribute = this.propertyMappings[propertyName] || propertyName;
    // Try direct name attribute first (more reliable if data-testid="property-input" is used)
    // This requires checking if such an element exists with the specific data-testid pattern
    // For now, we assume getPropertyInputByName is the primary way if nameAttribute is a 'name'
    if (this.propertyMappings[propertyName]) {
        return this._getPropertyInputByName(nameAttribute);
    }
    // Fallback to label search if it's not a direct name attribute from mappings
    // or if propertyName is intended as a label.
    return this._getPropertyInputByLabel(propertyName);
  }

  setProperty(propertyName, value, propertyType = 'input') {
    cy.log(`Setting property "${propertyName}" to "${value}"`);
    const selector = this._resolvePropertySelector(propertyName);
    
    selector.then($el => {
      if ($el.is('input[type="text"], input:not([type]), textarea')) {
        cy.wrap($el).clear().type(value, { delay: 50 }).should('have.value', value);
      } else if ($el.is('select')) {
        cy.wrap($el).select(value).should('have.value', value);
      } else if ($el.is('input[type="checkbox"]')) {
        if (value) {
          cy.wrap($el).check().should('be.checked');
        } else {
          cy.wrap($el).uncheck().should('not.be.checked');
        }
      } else {
        // Fallback for custom components or other types - might need specific handling
        cy.wrap($el).clear().type(value).should('contain.value', value); // Or other appropriate assertion
      }
    });
    return this;
  }

  getPropertyValue(propertyName, propertyType = 'input') {
    cy.log(`Getting value for property "${propertyName}"`);
    const selector = this._resolvePropertySelector(propertyName);

    return selector.then($el => {
      if ($el.is('input[type="text"], input:not([type]), textarea, input[type="number"]')) {
        return cy.wrap($el).invoke('val');
      } else if ($el.is('select')) {
        // For select, get the value of the selected option
        return cy.wrap($el).find('option:selected').invoke('val');
      } else if ($el.is('input[type="checkbox"]')) {
        return cy.wrap($el).is(':checked');
      }
      // Fallback for other types
      return cy.wrap($el).invoke('val'); // Or .text() if it's not an input
    });
  }
  
  // Specific setters/getters using the generic methods
  setTokenLocation(value) {
    return this.setProperty('Token Location', value, 'select');
  }
  getTokenLocation() {
    return this.getPropertyValue('Token Location', 'select');
  }

  setHeaderName(value) {
    return this.setProperty('Header Name', value);
  }
  getHeaderName() {
    return this.getPropertyValue('Header Name');
  }

  setMaxTokenSize(value) {
    // Assuming 'Max Token Size' is a label and maps to a 'name' via propertyMappings
    // or is found by label by setProperty.
    return this.setProperty('Max Token Size', value);
  }
  getMaxTokenSize() {
    return this.getPropertyValue('Max Token Size');
  }

  setRefreshInterval(value) {
    return this.setProperty('Refresh Interval', value);
  }
  getRefreshInterval() {
    return this.getPropertyValue('Refresh Interval');
  }

  // Existing methods from previous state, slightly refactored for consistency
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
  
  // Original setBasicProperties, useful for directness if names are stable
  setBasicPropertiesViaName(tokenLocation = 'AUTHORIZATION_HEADER', headerName = 'Authorization') {
    this._getPropertyInputByName('jwt.validation.token.location').select(tokenLocation);
    this._getPropertyInputByName('jwt.validation.token.header').clear().type(headerName);
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
    this.getVerificationResult({ timeout: 10000 }).should('contain', 'Connection successful');
    return this;
  }

  getOkButton() {
    return cy.get('[data-testid="processor-config-ok-button"], [data-testid="confirm-button"], button:contains("OK"), button:contains("Apply")').first();
  }

  getCancelButton() {
    return cy.get('[data-testid="processor-config-cancel-button"], button:contains("Cancel")').first();
  }

  saveConfiguration() {
    this.getOkButton().click();
    // Check dialog is closed
    cy.get('[data-testid="processor-configuration-dialog"]', { timeout: 10000 }).should('not.exist');
    return this;
  }
  
  clickCancelButton() {
    this.getCancelButton().click();
    cy.get('[data-testid="processor-configuration-dialog"]', { timeout: 10000 }).should('not.exist');
    return this;
  }
}

export default new ProcessorConfigurationPage();
