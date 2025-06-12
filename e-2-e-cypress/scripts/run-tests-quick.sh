#!/bin/bash

# Quick Integration Test Runner
# This script runs just the Cypress tests assuming containers are already running

set -e

# Navigate to project root (two levels up from e-2-e-cypress/scripts/)
cd "$(dirname "$0")/../.."

echo "🧪 Quick Integration Test Runner"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if containers are running
print_status "Checking if test environment is running..."

if ! curl -k --fail --max-time 5 https://localhost:9095/nifi/ >/dev/null 2>&1; then
    print_warning "NiFi not accessible at https://localhost:9095/nifi/"
    echo "To start the full test environment, run: ./e-2-e-cypress/scripts/run-integration-tests.sh"
    echo "Or manually start containers: cd integration-testing/src/main/docker && docker compose up -d"
    exit 1
fi

print_success "Test environment is accessible"

# Determine test type
TEST_TYPE="selftests"
if [[ "$1" == "--full" ]]; then
    TEST_TYPE="all"
    shift
fi

if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [--full] [cypress-args...]"
    echo ""
    echo "Options:"
    echo "  --full        Run full E2E tests (default: only self-tests)"
    echo "  cypress-args  Additional arguments passed to Cypress"
    echo ""
    echo "Examples:"
    echo "  $0                              # Run self-tests only"
    echo "  $0 --full                       # Run all tests"
    echo "  $0 --spec '**/login*.cy.js'     # Run specific test files"
    echo "  $0 --headed                     # Run with browser visible"
    exit 0
fi

# Run the appropriate test suite
cd e-2-e-cypress

if [[ "$TEST_TYPE" == "all" ]]; then
    print_status "Running full integration test suite..."
    npm run cypress:run "$@"
else
    print_status "Running self-tests (command validation)..."
    npm run cypress:selftests "$@"
fi

print_success "Tests completed!"

echo ""
print_status "Quick access:"
print_status "  • NiFi UI: https://localhost:9095/nifi/"
print_status "  • Open Cypress UI: npm run cypress:open"
print_status "  • Run full tests: ./e-2-e-cypress/scripts/run-tests-quick.sh --full"
