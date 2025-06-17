#!/bin/bash

# Quick verification script for e-2-e-cypress setup

# Import shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../utils/shell-common.sh" ]; then
    source "$SCRIPT_DIR/../utils/shell-common.sh"
else
    # Fallback if utilities not available
    print_status() { echo "🔍 $1"; }
    print_success() { echo "✅ $1"; }
    print_warning() { echo "⚠️  $1"; }
    print_error() { echo "❌ $1"; }
fi

# Standardized exit codes
readonly EXIT_SUCCESS=0
readonly EXIT_CONFIGURATION_ERROR=130
readonly EXIT_DEPENDENCY_ERROR=133
readonly EXIT_SYSTEM_ERROR=141

print_status "Verifying e-2-e-cypress setup..."

# Check if we're in the right directory
if ! check_project_directory 2>/dev/null; then
    print_error "package.json not found. Run from e-2-e-cypress directory."
    exit $EXIT_CONFIGURATION_ERROR
fi

print_success "Package.json found"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Running npm install..."
    npm install
else
    print_success "Node modules installed"
fi

# Check Cypress binary
print_status "Checking Cypress binary..."
if npx cypress --version > /dev/null 2>&1; then
    print_success "Cypress binary working"
    npx cypress --version
else
    print_error "Cypress binary not working"
    echo "Try: npx cypress install"
    exit 1
fi

# List test files
print_status "Test files found:"
echo "📁 Self-tests:"
find cypress/selftests -name "*.cy.js" 2>/dev/null | sed 's/^/  /' || echo "  No self-test files found"

echo "📁 E2E tests:"
find cypress/e2e -name "*.cy.js" 2>/dev/null | sed 's/^/  /' || echo "  No E2E test files found"

echo "📁 Support files:"
find cypress/support -name "*.js" 2>/dev/null | sed 's/^/  /' || echo "  No support files found"

# Check configuration files
print_status "Configuration files:"
[ -f "cypress.config.js" ] && echo "  ✅ cypress.config.js" || echo "  ❌ cypress.config.js missing"
[ -f "cypress.selftests.config.js" ] && echo "  ✅ cypress.selftests.config.js" || echo "  ❌ cypress.selftests.config.js missing"
[ -f ".eslintrc.js" ] && echo "  ✅ .eslintrc.js" || echo "  ❌ .eslintrc.js missing"
[ -f ".prettierrc" ] && echo "  ✅ .prettierrc" || echo "  ❌ .prettierrc missing"

echo ""
print_success "Setup verification complete!"
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

exit $EXIT_SUCCESS
echo "4. Run full E2E tests: npm run cypress:run"
echo "5. Interactive mode: npm run cypress:open"
echo ""
echo "⚠️  Note: Self-tests now require actual NiFi instance (not mocks)"
