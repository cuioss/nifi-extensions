#!/bin/bash

# CUI Standards Compliance - Comprehensive Duplicate String Fix
# Addresses all remaining duplicate string violations systematically

echo "🔧 CUI Standards Compliance - Comprehensive Duplicate String Fix"

# Function to safely replace strings and add imports
fix_duplicates_in_file() {
    local file="$1"
    echo "Processing: $file"
    
    # Ensure constants are imported
    if ! grep -q "import.*SELECTORS\|import.*TEXT_CONSTANTS\|import.*TEST_DATA" "$file"; then
        echo "Adding constants import to $file"
        # Insert import after existing imports or at the top
        if grep -q "^import\|^const.*require" "$file"; then
            sed -i '' '/^import\|^const.*require/a\
import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from "../support/constants.js";
' "$file"
        else
            sed -i '' '1i\
import { SELECTORS, TEXT_CONSTANTS, TEST_DATA } from "../support/constants.js";\

' "$file"
        fi
    fi
    
    # Fix processor status selectors (highest frequency)
    sed -i '' "s/'.processor-status'/SELECTORS.PROCESSOR_STATUS/g" "$file"
    sed -i '' 's/".processor-status"/SELECTORS.PROCESSOR_STATUS/g' "$file"
    
    # Fix configuration dialog selectors
    sed -i '' "s/'.configuration-dialog'/SELECTORS.CONFIGURATION_DIALOG/g" "$file"
    sed -i '' 's/".configuration-dialog"/SELECTORS.CONFIGURATION_DIALOG/g' "$file"
    
    # Fix JWT property names
    sed -i '' "s/'JWKS Type'/TEXT_CONSTANTS.JWKS_TYPE/g" "$file"
    sed -i '' "s/'JWKS Source Type'/TEXT_CONSTANTS.JWKS_SOURCE_TYPE/g" "$file"
    sed -i '' "s/'JWKS Server URL'/TEXT_CONSTANTS.JWKS_SERVER_URL/g" "$file"
    sed -i '' "s/'JWKS URL'/TEXT_CONSTANTS.JWKS_URL/g" "$file"
    
    # Fix processor states
    sed -i '' "s/'RUNNING'/TEST_DATA.RUNNING/g" "$file"
    sed -i '' "s/'STOPPED'/TEST_DATA.STOPPED/g" "$file"
    sed -i '' "s/'SERVER'/TEST_DATA.SERVER/g" "$file"
    
    # Fix test data
    sed -i '' "s/'test-issuer'/TEXT_CONSTANTS.TEST_ISSUER/g" "$file"
    sed -i '' "s/'invalid-url'/TEST_DATA.INVALID_URL/g" "$file"
    
    # Fix common selectors
    sed -i '' "s/'body'/SELECTORS.BODY/g" "$file"
    sed -i '' "s/'button'/SELECTORS.BUTTON/g" "$file"
    
    # Fix assertion strings
    sed -i '' "s/'be\.visible'/TEXT_CONSTANTS.BE_VISIBLE/g" "$file"
    sed -i '' "s/'exist'/TEXT_CONSTANTS.EXIST/g" "$file"
    sed -i '' "s/'contain\.text'/TEXT_CONSTANTS.CONTAIN_TEXT/g" "$file"
    
    # Fix language codes
    sed -i '' "s/'de'/TEXT_CONSTANTS.GERMAN/g" "$file"
    sed -i '' "s/'en'/TEXT_CONSTANTS.ENGLISH/g" "$file"
    
    # Fix admin credentials
    sed -i '' "s/'admin'/TEXT_CONSTANTS.ADMIN/g" "$file"
    sed -i '' "s/'adminadminadmin'/TEXT_CONSTANTS.ADMIN_PASSWORD/g" "$file"
    
    # Fix processor names
    sed -i '' "s/'MultiIssuerJWTTokenAuthenticator'/TEXT_CONSTANTS.MULTI_ISSUER_JWT_TOKEN_AUTHENTICATOR/g" "$file"
    sed -i '' "s/'GenerateFlowFile'/TEXT_CONSTANTS.GENERATE_FLOW_FILE/g" "$file"
    
    # Fix attribute names
    sed -i '' "s/'id'/TEXT_CONSTANTS.ID_ATTR/g" "$file"
    
    # Fix common app names
    sed -i '' "s/'nifi'/TEXT_CONSTANTS.NIFI/g" "$file"
}

# Process all files with duplicate string warnings
echo "🔍 Processing files with duplicate strings..."

# Get list of files with duplicate string warnings
npm run lint -- --format=compact 2>&1 | grep "sonarjs/no-duplicate-string" | awk -F: '{print $1}' | sort -u | while read -r file; do
    if [[ -f "$file" ]]; then
        fix_duplicates_in_file "$file"
    fi
done

echo "✅ Comprehensive duplicate string fix complete"

# Check progress
echo "📊 Checking remaining duplicate string warnings..."
remaining=$(npm run lint 2>&1 | grep "sonarjs/no-duplicate-string" | wc -l | tr -d ' ')
echo "Remaining duplicate string warnings: $remaining"

if [ "$remaining" -eq 0 ]; then
    echo "🎉 All duplicate string warnings eliminated!"
else
    echo "📋 Top remaining duplicate string issues:"
    npm run lint -- --format=compact 2>&1 | grep "sonarjs/no-duplicate-string" | head -10
fi

echo "🎯 Duplicate string comprehensive fix complete!"
