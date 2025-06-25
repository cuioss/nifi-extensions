# Archived Support Components

This directory contains Cypress support components that were not being used by the current minimal test suite and have been archived for future reference.

**Location**: `/cypress/e2e/archived/support/` (consolidated with other archived test components)

## Current Active Support Files

The minimal test suite uses only these support files in `/cypress/support/`:

- `commands.js` - Empty placeholder (all custom commands archived)
- `console-error-tracking.js` - Provides `saveBrowserLogs`, `verifyNoConsoleErrors`, `verifyNoUnexpectedWarnings`
- `console-warnings-allowlist.js` - Configuration for allowed console warnings
- `e2e.js` - Main support file that imports the above

## Archived Components

### `/archived/commands/` - Custom Command Libraries
All custom Cypress commands have been archived as the current tests use only built-in Cypress commands:

- **Authentication commands** (`auth/`) - Custom login helpers
- **Navigation commands** (`navigation/`) - Custom navigation helpers
- **Processor commands** (`processor/`) - Custom processor interaction commands
- **Validation commands** (`validation/`) - JWT validation and error handling commands
- **UI commands** (`ui/`) - Advanced UI interaction commands

### `/archived/utils/` - Utility Libraries
Utility functions that were not being used:

- `auth-helpers.js` - Authentication helper functions
- `auth-helpers-simple.js` - Simplified authentication helpers
- `error-tracking.js` - Error tracking utilities
- `validation-helpers.js` - Validation helper functions

### `/archived/` - Other Components
- `page-objects/` - Page object model implementations
- `wait-utils.js` - Custom wait utilities
- `constants.js` - Test constants and configuration

## Current Test Strategy

The active test suite (`01-basic-auth-and-session.cy.js` and `02-processor-availability.cy.js`) uses a **direct Cypress commands approach**:

- Uses only built-in Cypress commands (`cy.visit`, `cy.get`, `cy.log`, etc.)
- No custom command imports to avoid module resolution issues
- Simpler and more reliable than complex custom command chains
- Console error tracking for quality assurance

## Restoring Archived Components

If future tests need custom commands, they can be restored from this archive:

1. Copy needed command files back to `/cypress/support/commands/`
2. Add imports to `/cypress/support/commands.js`
3. Test that imports work correctly

## Benefits of Current Approach

- **Reliability**: No dependency on custom command implementations
- **Simplicity**: Easy to understand and maintain
- **Fast execution**: No overhead from unused command libraries
- **Production-ready**: Minimal surface area for potential issues
