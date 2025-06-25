# Archived Cypress Tests

This directory contains Cypress E2E tests that have been archived as part of the authentication optimization effort.

## Archived Files

### Test Files
- `01-self-test.cy.js` - Basic self-test functionality
- `02-nifi-functional.cy.js` - NiFi functional tests
- `03-nifi-advanced-settings.cy.js` - Advanced NiFi settings tests
- `04-processor-deployment.py.js` - Processor deployment tests
- `05-deployment-verification.cy.js` - Deployment verification tests
- `07-processor-functional-single-issuer.cy.js` - Single issuer processor tests

### Support Components
- `support/` - Archived Cypress support components (custom commands, utilities, page objects)
- `integration/` - Unit tests for archived custom commands (command verification tests)

## Why Archived?

These components were archived as part of a simplification effort to focus only on essential authentication and processor availability testing:

- **Test files**: Contained complex authentication logic, redundant login procedures, and advanced features not essential for core validation
- **Support components**: Custom commands and utilities that were not being used by the current minimal test suite  
- **Integration tests**: Unit tests for the archived custom commands (no longer needed with direct Cypress commands approach)

## Restoration

If any of these tests are needed in the future, they can be moved back to the `cypress/e2e/` directory. However, they may need updates to work with the simplified authentication helper infrastructure.

## Current Active Tests

Only the following tests remain active:
- `cypress/e2e/01-basic-auth-and-session.cy.js` - Basic authentication, session handling, and logout
- `cypress/e2e/02-processor-availability.cy.js` - Processor availability verification

## Date Archived

${new Date().toISOString().split('T')[0]}
