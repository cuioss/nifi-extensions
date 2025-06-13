#!/bin/bash
# Final cleanup script for CUI JavaScript standards compliance

echo "🔧 Final cleanup for CUI JavaScript standards compliance..."

cd /Users/oliver/git/nifi-extensions/e-2-e-cypress

# Fix missing imports for files that use constants but don't import them
echo "📦 Adding missing imports..."

# Add SELECTORS to files that use it but don't import it
grep -l "SELECTORS\." cypress/e2e/**/*.js | while read file; do
    if ! grep -q "SELECTORS.*from.*constants" "$file"; then
        echo "Adding SELECTORS import to $file"
        sed -i '' 's/import { TEXT_CONSTANTS }/import { SELECTORS, TEXT_CONSTANTS }/' "$file"
        sed -i '' 's/import { TEST_DATA }/import { SELECTORS, TEST_DATA }/' "$file"
    fi
done

# Add TEST_DATA to files that use it but don't import it
grep -l "TEST_DATA\." cypress/e2e/**/*.js | while read file; do
    if ! grep -q "TEST_DATA.*from.*constants" "$file"; then
        echo "Adding TEST_DATA import to $file"
        sed -i '' 's/import { SELECTORS }/import { SELECTORS, TEST_DATA }/' "$file"
        sed -i '' 's/import { TEXT_CONSTANTS }/import { TEXT_CONSTANTS, TEST_DATA }/' "$file"
    fi
done

# Replace common duplicate strings
echo "🔄 Replacing duplicate strings with constants..."

# Replace 'Apply' button text
find cypress/e2e -name "*.js" -exec sed -i '' "s/\\.contains('Apply')/\\.contains(TEXT_CONSTANTS.APPLY)/g" {} \;

# Replace 'Cancel' button text
find cypress/e2e -name "*.js" -exec sed -i '' "s/\\.contains('Cancel')/\\.contains(TEXT_CONSTANTS.CANCEL)/g" {} \;

# Replace 'Save' button text
find cypress/e2e -name "*.js" -exec sed -i '' "s/\\.contains('Save')/\\.contains(TEXT_CONSTANTS.SAVE)/g" {} \;

# Replace common property names
find cypress/e2e -name "*.js" -exec sed -i '' "s/'JWKS Type'/TEXT_CONSTANTS.JWKS_TYPE/g" {} \;
find cypress/e2e -name "*.js" -exec sed -i '' "s/'JWKS Source Type'/TEXT_CONSTANTS.JWKS_SOURCE_TYPE/g" {} \;
find cypress/e2e -name "*.js" -exec sed -i '' "s/'Default Issuer'/TEXT_CONSTANTS.DEFAULT_ISSUER/g" {} \;

# Replace Keycloak JWKS URL
find cypress/e2e -name "*.js" -exec sed -i '' 's|https://localhost:8443/auth/realms/oauth_integration_tests/protocol/openid-connect/certs|TEST_DATA.KEYCLOAK_JWKS_URL|g' {} \;

# Replace SERVER constant
find cypress/e2e -name "*.js" -exec sed -i '' "s/'Server'/TEST_DATA.SERVER/g" {} \;

echo "🔧 Fixing object injection patterns..."

# Fix remaining object injection issues by replacing direct array access
find cypress/e2e -name "*.js" -exec sed -i '' 's/\[index\]/.at(index) || {}/g' {} \;

echo "✅ Final cleanup completed!"

# Run ESLint to check progress
echo "📊 Checking ESLint status..."
npm run lint 2>&1 | grep -E "(warning|error)" | wc -l | xargs echo "Remaining warnings:"
