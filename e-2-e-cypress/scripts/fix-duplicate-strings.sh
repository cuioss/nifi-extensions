#!/bin/bash

# Fix duplicate strings by replacing with constants
# Targets the most common duplicate strings identified by ESLint

echo "🔄 Fixing duplicate string violations..."

# Get all .cy.js files
TEST_FILES=$(find cypress/e2e -name "*.cy.js" -type f)

for file in $TEST_FILES; do
    echo "Processing: $file"
    
    # Replace common should assertions
    sed -i '' "s/should('be.visible')/should(TEXT_CONSTANTS.BE_VISIBLE)/g" "$file"
    sed -i '' "s/should('exist')/should(TEXT_CONSTANTS.EXIST)/g" "$file"
    sed -i '' "s/should('not.exist')/should(TEXT_CONSTANTS.NOT_EXIST)/g" "$file"
    
    # Replace common selectors that should be constants
    sed -i '' "s/'.configuration-dialog'/SELECTORS.CONFIGURATION_DIALOG/g" "$file"
    sed -i '' "s/'.validation-error'/SELECTORS.VALIDATION_ERROR/g" "$file"
    sed -i '' "s/'.error-message'/SELECTORS.VALIDATION_ERROR/g" "$file"
    
    # Replace common text content
    sed -i '' "s/'Properties'/TEXT_CONSTANTS.PROPERTIES/g" "$file"
    sed -i '' "s/'Settings'/TEXT_CONSTANTS.SETTINGS/g" "$file"
    sed -i '' "s/'Scheduling'/TEXT_CONSTANTS.SCHEDULING/g" "$file"
    
    # Only add constants import if file doesn't already have it
    if ! grep -q "import.*constants" "$file"; then
        # Add import at the top after any existing comments
        sed -i '' '1s/^/import { SELECTORS, TEXT_CONSTANTS } from "..\/..\/support\/constants.js";\n/' "$file"
    fi
    
    echo "  ✅ Fixed duplicate strings in $file"
done

echo "📊 Checking remaining ESLint issues..."
npm run lint 2>&1 | grep -E "warning|error" | wc -l | xargs echo "Remaining issues:"

echo "✅ Duplicate string fixing completed!"
