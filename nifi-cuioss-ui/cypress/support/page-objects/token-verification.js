// cypress/support/page-objects/token-verification.js
class TokenVerificationPage {
  visit() {
    // This might be a sub-page or tab within a processor's advanced UI.
    // The actual navigation path will depend on how it's accessed.
    // For example, if it's part of an advanced UI:
    // NifiCanvasPage.navigateToAdvancedProcessorUi('myProcessor');
    // cy.get('[data-testid="verification-tab"]').click();
    this.waitForPageToLoad();
    return this;
  }

  waitForPageToLoad(timeout = 10000) {
    // Example: Wait for a known element on the token verification page
    cy.get('[data-testid="token-input"]', { timeout }).should('be.visible');
    cy.get('[data-testid="verify-token-button"]', { timeout }).should('be.visible');
    return this;
  }

  getTokenInput() {
    return cy.get('[data-testid="token-input"]');
  }

  getVerifyTokenButton() {
    return cy.get('[data-testid="verify-token-button"]');
  }

  getVerificationResultSection() {
    // This could be a more generic selector for the area displaying results
    return cy.get('[data-testid="token-verification-results"], [data-testid="claims-container"]');
  }

  getTokenSubjectDisplay() {
    return cy.get('[data-testid="token-subject"]');
  }

  getTokenIssuerDisplay() {
    return cy.get('[data-testid="token-issuer"]');
  }

  enterToken(token) {
    this.getTokenInput().clear().type(token, { parseSpecialCharSequences: false, delay: 0 });
    return this;
  }

  clickVerifyToken() {
    this.getVerifyTokenButton().click();
    return this;
  }

  verifyTokenDetails(subject, issuer) {
    if (subject) {
      this.getTokenSubjectDisplay().should('contain', subject);
    }
    if (issuer) {
      this.getTokenIssuerDisplay().should('contain', issuer);
    }
    // Add more assertions for claims, etc.
    this.getVerificationResultSection().should('be.visible');
    return this;
  }

  verifyErrorMessage(errorMessageSnippet) {
    this.getVerificationResultSection().should('contain', errorMessageSnippet);
    return this;
  }
}

export default new TokenVerificationPage();
