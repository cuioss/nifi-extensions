#!/bin/bash

# CUI Standards Compliance - Fix Remaining Duplicate Strings
# This script addresses the remaining 71 duplicate string violations

echo "🔧 CUI Standards Compliance - Fixing Remaining Duplicate Strings"

# Ensure constants are imported in files that need them
add_constants_import() {
    local file="$1"
    if ! grep -q "import.*constants" "$file" && ! grep -q "import.*SELECTORS\|TEXT_CONSTANTS" "$file"; then
        echo "Adding constants import to $file"
        # Add import after existing imports or at the top
        if grep -q "^import\|^const.*require" "$file"; then
            # Add after existing imports
            sed -i '' '/^import\|^const.*require/a\
import { SELECTORS, TEXT_CONSTANTS } from "../support/constants.js";
' "$file"
        else
            # Add at the top
            sed -i '' '1i\
import { SELECTORS, TEXT_CONSTANTS } from "../support/constants.js";\

' "$file"
        fi
    fi
}

# Function to replace duplicate strings
replace_duplicates() {
    local file="$1"
    echo "Processing: $file"
    
    # Add constants import if needed
    add_constants_import "$file"
    
    # Replace high-frequency duplicates
    sed -i '' "s/'body'/SELECTORS.BODY/g" "$file"
    sed -i '' "s/'button'/SELECTORS.BUTTON/g" "$file"
    sed -i '' "s/'MultiIssuerJWTTokenAuthenticator'/TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR/g" "$file"
    sed -i '' "s/'GenerateFlowFile'/TEXT_CONSTANTS.GENERATE_FLOW_FILE/g" "$file"
    sed -i '' "s/'nifi'/TEXT_CONSTANTS.NIFI/g" "$file"
    sed -i '' "s/'admin'/TEXT_CONSTANTS.ADMIN/g" "$file"
    sed -i '' "s/'adminadminadmin'/TEXT_CONSTANTS.ADMIN_PASSWORD/g" "$file"
    sed -i '' "s/'test-issuer'/TEXT_CONSTANTS.TEST_ISSUER/g" "$file"
    sed -i '' "s/'id'/TEXT_CONSTANTS.ID_ATTR/g" "$file"
    
    # Replace assertion strings that aren't already replaced
    sed -i '' "s/'be\.visible'/TEXT_CONSTANTS.BE_VISIBLE/g" "$file"
    sed -i '' "s/'exist'/TEXT_CONSTANTS.EXIST/g" "$file"
    sed -i '' "s/'contain\.text'/TEXT_CONSTANTS.CONTAIN_TEXT/g" "$file"
    
    # Replace language codes
    sed -i '' "s/'de'/TEXT_CONSTANTS.GERMAN/g" "$file"
    sed -i '' "s/'en'/TEXT_CONSTANTS.ENGLISH/g" "$file"
    
    # Replace JWT-specific strings
    sed -i '' "s/'JWKS Type'/TEXT_CONSTANTS.JWKS_TYPE/g" "$file"
    sed -i '' "s/'JWKS URL'/TEXT_CONSTANTS.JWKS_URL/g" "$file"
    sed -i '' "s/'JWKS Source Type'/TEXT_CONSTANTS.JWKS_SOURCE_TYPE/g" "$file"
    
    # Replace dialog selector
    sed -i '' "s/'\.configuration-dialog'/SELECTORS.CONFIGURATION_DIALOG/g" "$file"
    sed -i '' "s/\"\.configuration-dialog\"/SELECTORS.CONFIGURATION_DIALOG/g" "$file"
    
    # Replace processor selector
    sed -i '' "s/'g\.processor, \[class\*=\"processor\"\], \.component'/SELECTORS.PROCESSOR/g" "$file"
    sed -i '' "s/\"g\.processor, \[class\*=\\\"processor\\\"\], \.component\"/SELECTORS.PROCESSOR/g" "$file"
}

# Process all cypress test files
echo "🔍 Processing Cypress test files..."
find cypress/e2e -name "*.cy.js" -type f | while read -r file; do
    replace_duplicates "$file"
done

# Process support files
echo "🔍 Processing support files..."
find cypress/support -name "*.js" -type f ! -name "constants.js" | while read -r file; do
    replace_duplicates "$file"
done

echo "✅ Duplicate string replacement complete"

# Run eslint to check progress
echo "📊 Checking remaining duplicate string warnings..."
npm run lint 2>&1 | grep "sonarjs/no-duplicate-string" | wc -l | sed 's/^[[:space:]]*//' | while read count; do
    echo "Remaining duplicate string warnings: $count"
done

echo "🎯 Duplicate string fix complete!"
