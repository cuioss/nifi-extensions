import { TEXT_CONSTANTS } from '../../support/constants.js';
// Basic connectivity test with robust login pattern
describe('Basic Test', () => {
  it('should connect to NiFi using robust login pattern', () => {
    // Use the working login approach
    cy.nifiLogin();

    // Basic verification that we're ready for testing
    cy.get('body').should(TEXT_CONSTANTS.EXIST);
    cy.get('nifi').should(TEXT_CONSTANTS.EXIST);

    cy.log('✅ Basic connectivity test passed!');
  });
});
