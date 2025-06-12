#!/bin/bash

# Local Integration Test Runner
# This script runs the complete integration test suite locally including container management

set -e

echo "🚀 Starting Local Integration Test Suite"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed or not available"
    exit 1
fi

if ! command -v mvn &> /dev/null && ! [ -f "./mvnw" ]; then
    print_error "Maven is not installed and mvnw wrapper not found"
    exit 1
fi

print_success "All prerequisites satisfied"

# Determine Maven command
if [ -f "./mvnw" ]; then
    MVN_CMD="./mvnw"
else
    MVN_CMD="mvn"
fi

# Parse command line arguments
SKIP_BUILD=false
KEEP_CONTAINERS=false
ONLY_SELFTESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --keep-containers)
            KEEP_CONTAINERS=true
            shift
            ;;
        --only-selftests)
            ONLY_SELFTESTS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --skip-build      Skip the Maven build phase (use existing artifacts)"
            echo "  --keep-containers Keep containers running after tests"
            echo "  --only-selftests  Run only self-tests, skip full E2E tests"
            echo "  --help, -h        Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Cleanup function
cleanup() {
    if [ "$KEEP_CONTAINERS" = false ]; then
        print_status "Cleaning up containers..."
        cd integration-testing/src/main/docker && docker compose down -v 2>/dev/null || true
        cd - >/dev/null
    else
        print_warning "Containers left running as requested"
        print_status "To stop containers manually: cd integration-testing/src/main/docker && docker compose down -v"
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Build phase
if [ "$SKIP_BUILD" = false ]; then
    print_status "Building project and NAR files..."
    $MVN_CMD clean package -DskipTests
    print_success "Build completed"
else
    print_warning "Skipping build phase"
fi

# Run integration tests with container management
print_status "Starting integration test suite with container management..."

if [ "$ONLY_SELFTESTS" = true ]; then
    print_status "Running only self-tests (command validation)..."
    $MVN_CMD integration-test -Plocal-integration-tests -Dintegration.test.local=true -pl e-2-e-cypress
else
    print_status "Running full integration test suite..."
    $MVN_CMD integration-test -Plocal-integration-tests -Dintegration.test.local=true
fi

print_success "Integration tests completed successfully!"

# Show useful information
echo ""
echo "🎉 Integration Test Suite Completed"
echo "===================================="
print_status "While containers are running, you can:"
print_status "  • Access NiFi UI: https://localhost:9095/nifi/"
print_status "  • Access Keycloak: https://localhost:9085/auth/"
print_status "  • Run manual tests: cd e-2-e-cypress && npm run cypress:open"

if [ "$KEEP_CONTAINERS" = true ]; then
    echo ""
    print_warning "Containers are still running. To stop them:"
    print_status "  cd integration-testing/src/main/docker && docker compose down -v"
fi
