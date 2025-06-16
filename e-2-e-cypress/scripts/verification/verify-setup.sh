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
echo "📝 Testing Strategy:"
echo "• Self-tests = REAL integration tests against live NiFi instance"
echo "• E2E tests = Full end-to-end testing with complete scenarios"
echo ""
echo "📋 Prerequisites for self-tests:"
echo "• NiFi running on http://localhost:9094/nifi"
echo "• Default credentials: admin/adminadminadmin"
echo "• MultiIssuerJWTTokenAuthenticator processor available"
echo ""
echo "🚀 Next steps:"
echo "1. Start integration test environment:"
echo "   cd ../integration-testing/src/main/docker && ./start-test-containers.sh"
echo "2. Wait for services to be ready (NiFi takes 3-5 minutes)"
echo "3. Run integration self-tests: npm run cypress:selftests"
echo "4. Run full E2E tests: npm run cypress:run"
echo "5. Interactive mode: npm run cypress:open"
echo ""
echo "⚠️  Note: Self-tests now require actual NiFi instance (not mocks)"
