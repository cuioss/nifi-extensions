# Archived Cypress Tests

This directory contains Cypress E2E tests that have been archived as part of the authentication optimization effort.

## Archived Files

- `01-self-test.cy.js` - Basic self-test functionality
- `02-nifi-functional.cy.js` - NiFi functional tests
- `03-nifi-advanced-settings.cy.js` - Advanced NiFi settings tests
- `04-processor-deployment.py.js` - Processor deployment tests
- `05-deployment-verification.cy.js` - Deployment verification tests
- `07-processor-functional-single-issuer.cy.js` - Single issuer processor tests

## Why Archived?

These tests were archived as part of a simplification effort to focus only on basic authentication testing. These tests contained complex authentication logic, redundant login procedures, and advanced features that were not essential for the core authentication validation.

## Restoration

If any of these tests are needed in the future, they can be moved back to the `cypress/e2e/` directory. However, they may need updates to work with the simplified authentication helper infrastructure.

## Current Active Tests

Only the following test remains active:
- `cypress/e2e/auth/01-basic-auth-and-session.cy.js` - Basic authentication, session handling, and logout

## Date Archived

${new Date().toISOString().split('T')[0]}
