#!/bin/bash

# Comprehensive Duplicate String Fixer
# CUI Standards Compliance - Final Push to 100%

echo "🎯 Starting comprehensive duplicate string fixes for 100% compliance..."

# Fix the most common duplicated assertions
echo "Fixing common Cypress assertions..."
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('contain\.text'/should(TEXT_CONSTANTS.CONTAIN_TEXT/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('have\.attr'/should(TEXT_CONSTANTS.HAVE_ATTR/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('have\.text'/should(TEXT_CONSTANTS.HAVE_TEXT/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('have\.value'/should(TEXT_CONSTANTS.HAVE_VALUE/g" {} \;

# Fix common selector patterns (escape dots for sed)
echo "Fixing common selectors..."
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\\.configuration-dialog'/SELECTORS.CONFIGURATION_DIALOG/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\\.validation-error'/SELECTORS.VALIDATION_ERROR/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\\.processor-configuration-tab'/SELECTORS.PROCESSOR_CONFIG_TAB/g" {} \;

# Fix common timeout values
echo "Fixing common timeout patterns..."
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/timeout: 10000/timeout: TIMEOUTS.VERY_LONG/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/timeout: 5000/timeout: TIMEOUTS.LONG/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/timeout: 2000/timeout: TIMEOUTS.MEDIUM/g" {} \;

# Fix common button text duplicates
echo "Fixing common button text..."
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'Apply'/TEXT_CONSTANTS.APPLY/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'Cancel'/TEXT_CONSTANTS.CANCEL/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'Save'/TEXT_CONSTANTS.SAVE/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'Delete'/TEXT_CONSTANTS.DELETE/g" {} \;

# Fix common data-testid selectors
echo "Fixing data-testid patterns..."
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\[data-testid=\"processor-details-pane\"\]'/TEXT_CONSTANTS.PROCESSOR_DETAILS_PANE/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\[data-testid=\"confirm-reset-dialog\"\]'/TEXT_CONSTANTS.CONFIRM_RESET_DIALOG/g" {} \;

# Fix common class selectors
echo "Fixing common class names..."
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\.processor-status'/'.processor-status'/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'#canvas-container'/TEXT_CONSTANTS.CANVAS_CONTAINER/g" {} \;

echo "✅ Comprehensive duplicate string fixes completed!"
echo "📊 Checking current violation count..."

npm run lint 2>&1 | grep -E "warning|error" | wc -l | xargs echo "Remaining violations:"
