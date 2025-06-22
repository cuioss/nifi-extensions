/**
 * Debug test to understand why NiFi isn't loading in Cypress
 */

describe('Debug NiFi Loading', () => {
  it('should debug what happens when loading NiFi', () => {
    cy.log('🚀 Starting debug test...');

    // Step 1: Try basic visit
    cy.visit('/', {
      failOnStatusCode: false,
      timeout: 60000,
    });

    // Step 2: Check if page loaded at all
    cy.document().then((doc) => {
      cy.log('📄 Document loaded, title:', doc.title);
    });

    // Step 3: Check if body exists
    cy.get('body')
      .should('exist')
      .then(($body) => {
        cy.log('📝 Body exists, innerHTML length:', $body.html().length);
        cy.log('📝 Body content preview:', $body.html().substring(0, 1000));
      });

    // Step 4: Look for nifi element
    cy.get('body').then(($body) => {
      const nifiElements = $body.find('nifi');
      cy.log('🔍 Found nifi elements:', nifiElements.length);

      if (nifiElements.length > 0) {
        cy.log('✅ NiFi element found!');
      } else {
        cy.log('❌ No nifi element found');
        // Log all elements in body
        const allElements = $body.find('*');
        cy.log('📋 All elements in body:', allElements.length);
        cy.log(
          '📋 Element types:',
          [...new Set(allElements.toArray().map((el) => el.tagName))].join(', ')
        );
      }
    });

    // Step 5: Wait a bit and check again
    cy.wait(5000);
    cy.get('body').then(($body) => {
      const nifiElements = $body.find('nifi');
      cy.log('🔍 After wait - Found nifi elements:', nifiElements.length);
    });
  });
});
