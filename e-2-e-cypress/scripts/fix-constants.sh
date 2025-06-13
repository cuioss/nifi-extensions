#!/bin/bash
# CUI Standards Compliance - String Constants Replacement Script

echo "Replacing duplicate strings with constants..."

# Function to add imports and replace strings in a file
fix_file_constants() {
    local file="$1"
    echo "Processing: $file"
    
    # Check if imports already exist
    if ! grep -q "import.*constants" "$file"; then
        # Add import at the top after any existing imports or comments
        if grep -q "^import" "$file"; then
            # Add after existing imports
            sed -i.bak '/^import.*$/a\
import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from '"'"'../constants.js'"'"';
' "$file"
        else
            # Add after initial comments
            sed -i.bak '/^describe\|^it\|^Cypress/i\
import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from '"'"'../constants.js'"'"';\

' "$file"
        fi
    fi
    
    # Replace common button text
    sed -i.bak "s/'Apply'/TEXT_CONSTANTS.APPLY/g" "$file"
    sed -i.bak 's/"Apply"/TEXT_CONSTANTS.APPLY/g' "$file"
    sed -i.bak "s/'OK'/TEXT_CONSTANTS.OK/g" "$file"
    sed -i.bak 's/"OK"/TEXT_CONSTANTS.OK/g' "$file"
    
    # Replace common selectors
    sed -i.bak "s/'\\.processor-property-name'/SELECTORS.PROCESSOR_PROPERTY_NAME/g" "$file"
    sed -i.bak 's/"\\.processor-property-name"/SELECTORS.PROCESSOR_PROPERTY_NAME/g' "$file"
    sed -i.bak "s/'\\.processor-property-row'/SELECTORS.PROCESSOR_PROPERTY_ROW/g" "$file"
    sed -i.bak 's/"\\.processor-property-row"/SELECTORS.PROCESSOR_PROPERTY_ROW/g' "$file"
    
    # Replace test data constants
    sed -i.bak "s/'test-issuer'/TEST_DATA.TEST_ISSUER_NAME/g" "$file"
    sed -i.bak 's/"test-issuer"/TEST_DATA.TEST_ISSUER_NAME/g' "$file"
    sed -i.bak "s/'https:\\/\\/test\\.example\\.com'/TEST_DATA.TEST_ISSUER_URL/g" "$file"
    sed -i.bak 's/"https:\\/\\/test\\.example\\.com"/TEST_DATA.TEST_ISSUER_URL/g' "$file"
    
    # Clean up backup files
    rm -f "$file.bak"
}

# Process key files with duplicate strings
fix_file_constants "cypress/e2e/accessibility.cy.js"
fix_file_constants "cypress/e2e/processor-config/multi-issuer-jwt-config.cy.js"
fix_file_constants "cypress/e2e/token-validation/jwks-validation.cy.js"
fix_file_constants "cypress/e2e/token-validation/jwt-validation.cy.js"
fix_file_constants "cypress/integration/login-commands.cy.js"
fix_file_constants "cypress/integration/navigation-commands.cy.js"
fix_file_constants "cypress/integration/processor-commands.cy.js"

echo "String constants replacement completed!"
