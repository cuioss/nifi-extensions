#!/bin/bash

# Quick verification script for e-2-e-cypress setup
echo "🔍 Verifying e-2-e-cypress setup..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run from e-2-e-cypress directory."
    exit 1
fi

echo "✅ Package.json found"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  Warning: node_modules not found. Running npm install..."
    npm install
else
    echo "✅ Node modules installed"
fi

# Check Cypress binary
echo "🔍 Checking Cypress binary..."
if npx cypress --version > /dev/null 2>&1; then
    echo "✅ Cypress binary working"
    npx cypress --version
else
    echo "❌ Error: Cypress binary not working"
    echo "Try: npx cypress install"
    exit 1
fi

# List test files
echo "🔍 Test files found:"
echo "📁 Self-tests:"
find cypress/selftests -name "*.cy.js" 2>/dev/null | sed 's/^/  /' || echo "  No self-test files found"

echo "📁 E2E tests:"
find cypress/e2e -name "*.cy.js" 2>/dev/null | sed 's/^/  /' || echo "  No E2E test files found"

echo "📁 Support files:"
find cypress/support -name "*.js" 2>/dev/null | sed 's/^/  /' || echo "  No support files found"

# Check configuration files
echo "🔍 Configuration files:"
[ -f "cypress.config.js" ] && echo "  ✅ cypress.config.js" || echo "  ❌ cypress.config.js missing"
[ -f "cypress.selftests.config.js" ] && echo "  ✅ cypress.selftests.config.js" || echo "  ❌ cypress.selftests.config.js missing"
[ -f ".eslintrc.js" ] && echo "  ✅ .eslintrc.js" || echo "  ❌ .eslintrc.js missing"
[ -f ".prettierrc" ] && echo "  ✅ .prettierrc" || echo "  ❌ .prettierrc missing"

echo ""
echo "🎉 Setup verification complete!"
echo ""
echo "📝 Next steps:"
echo "1. Start integration test environment: cd ../integration-testing && ./run-test-container.sh"
echo "2. Run self-tests: npm run cypress:selftests"
echo "3. Run E2E tests: npm run cypress:run"
echo "4. Interactive mode: npm run cypress:open"
