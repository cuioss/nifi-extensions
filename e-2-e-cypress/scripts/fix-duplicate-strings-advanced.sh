#!/bin/bash

# Fix Common Duplicate String Issues
# CUI Standards Compliance Script

echo "🔧 Fixing duplicate string violations..."

# Fix common Cypress assertions
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('contain')/should(TEXT_CONSTANTS.CONTAIN)/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('exist')/should(TEXT_CONSTANTS.EXIST)/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('be.enabled')/should(TEXT_CONSTANTS.BE_ENABLED)/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/should('be.disabled')/should(TEXT_CONSTANTS.BE_DISABLED)/g" {} \;

# Fix common selector duplicates - escape the dots for sed
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\\.processor-property-name'/SELECTORS.PROCESSOR_PROPERTY_NAME/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'\\.processor-property-row'/SELECTORS.PROCESSOR_PROPERTY_ROW/g" {} \;

# Fix common property name duplicates
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'JWKS Type'/TEXT_CONSTANTS.JWKS_TYPE/g" {} \;
find cypress/e2e -name "*.cy.js" -type f -exec sed -i '' "s/'JWKS File Path'/TEXT_CONSTANTS.JWKS_FILE_PATH/g" {} \;

echo "✅ Duplicate string fixes applied!"
echo "📊 Checking remaining violations..."

npm run lint 2>&1 | grep -E "warning|error" | wc -l | xargs echo "Remaining warnings:"
