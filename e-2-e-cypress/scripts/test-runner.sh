#!/bin/bash
#
# Unified Test Runner for e-2-e-cypress
# Consolidates run-integration-tests.sh and run-tests-quick.sh functionality
#
# Modes:
#   --full        : Full integration test suite with container management and build
#   --quick       : Quick test run assuming containers are already running  
#   --build-only  : Build project without running tests
#   --status      : Show environment status
#
# Build Options:
#   --skip-build  : Skip Maven build phase (use existing artifacts)
#   --clean       : Run clean build (mvn clean package)
#
# Container Options:
#   --keep-containers : Keep containers running after tests
#   --restart-containers : Force restart containers before tests
#
# Test Options:
#   --selftests-only : Run only selftests (command validation)
#   --e2e-only      : Run only full E2E tests
#   --spec <pattern> : Run specific test files matching pattern
#   --headed        : Run tests with visible browser
#   --open          : Open Cypress GUI instead of running tests
#

set -e

# Navigate to project root (two levels up from e-2-e-cypress/scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Import shared utilities if available
if [ -f "e-2-e-cypress/scripts/utils/shell-common.sh" ]; then
    source "e-2-e-cypress/scripts/utils/shell-common.sh"
else
    # Fallback color definitions
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
    
    print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
    print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
    print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
    print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
    print_step() { echo -e "${CYAN}[STEP]${NC} $1"; }
    print_header() { echo -e "${BOLD}${CYAN}$1${NC}"; }
fi

# Default configuration
MODE="full"
SKIP_BUILD=false
CLEAN_BUILD=false
KEEP_CONTAINERS=false
RESTART_CONTAINERS=false
TEST_TYPE="all"
SPEC_PATTERN=""
HEADED=false
OPEN_CYPRESS=false
CYPRESS_ARGS=()

# Function to show usage
show_usage() {
    cat << EOF
Unified Test Runner for e-2-e-cypress

Usage: $0 [mode] [options] [-- cypress-args]

Modes:
  --full                Full integration test suite with container management (default)
  --quick               Quick test run assuming containers are running
  --build-only          Build project without running tests  
  --status              Show environment and container status

Build Options:
  --skip-build          Skip Maven build phase (use existing artifacts)
  --clean               Run clean build (mvn clean package)

Container Options:
  --keep-containers     Keep containers running after tests
  --restart-containers  Force restart containers before tests

Test Options:
  --selftests-only      Run only selftests (command validation)
  --e2e-only           Run only full E2E tests (skip selftests)
  --spec <pattern>      Run specific test files matching pattern
  --headed             Run tests with visible browser
  --open               Open Cypress GUI instead of running tests

Examples:
  $0                                    # Full integration test suite
  $0 --quick                           # Quick tests (containers assumed running)
  $0 --full --selftests-only           # Full suite but only selftests
  $0 --quick --headed                  # Quick tests with visible browser
  $0 --build-only                      # Just build, don't run tests
  $0 --status                          # Show environment status
  $0 --spec "**/login*.cy.js"          # Run specific test pattern
  $0 -- --reporter json                # Pass additional args to Cypress

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."

    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_tools+=("docker-compose")
    fi

    if ! command -v mvn &> /dev/null && ! [ -f "./mvnw" ]; then
        missing_tools+=("maven")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install missing tools and try again"
        return 1
    fi

    print_success "All prerequisites satisfied"
    return 0
}

# Function to determine Maven command
get_maven_command() {
    if [ -f "./mvnw" ]; then
        echo "./mvnw"
    else
        echo "mvn"
    fi
}

# Function to check container status
check_container_status() {
    print_step "Checking container status..."
    
    if [ -f "$SCRIPT_DIR/environment-manager.sh" ]; then
        # Use environment manager for status check
        "$SCRIPT_DIR/environment-manager.sh" status --quiet
        return $?
    else
        # Fallback to direct Docker commands
        if command -v docker &> /dev/null; then
            local running_containers
            running_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(nifi|keycloak)" | wc -l || echo "0")
            
            if [ "$running_containers" -gt 0 ]; then
                print_success "Found $running_containers running containers"
                docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(nifi|keycloak)" | sed 's/^/  /'
                return 0
            else
                print_warning "No NiFi/Keycloak containers are running"
                return 1
            fi
        else
            print_warning "Docker not available - cannot check container status"
            return 1
        fi
    fi
}

# Function to check NiFi availability
check_nifi_availability() {
    print_step "Checking NiFi availability..."
    
    # Try HTTPS first
    if curl -k --fail --max-time 5 https://localhost:9095/nifi/ >/dev/null 2>&1; then
        print_success "NiFi HTTPS is accessible at https://localhost:9095/nifi/"
        return 0
    fi
    
    # Try HTTP
    if curl --fail --max-time 5 http://localhost:9094/nifi/ >/dev/null 2>&1; then
        print_success "NiFi HTTP is accessible at http://localhost:9094/nifi/"
        return 0
    fi
    
    print_warning "NiFi is not accessible at either HTTPS or HTTP endpoints"
    return 1
}

# Function to show environment status
show_environment_status() {
    print_header "🔍 Environment Status"
    echo "===================="
    echo ""
    
    if [ -f "$SCRIPT_DIR/environment-manager.sh" ]; then
        # Use environment manager for comprehensive status
        "$SCRIPT_DIR/environment-manager.sh" status
    else
        # Fallback to basic status checks
        # Check Docker
        if command -v docker &> /dev/null; then
            print_success "Docker: Available ($(docker --version))"
        else
            print_error "Docker: Not available"
        fi
        
        # Check containers
        check_container_status
        
        # Check NiFi
        check_nifi_availability
    fi
}
    check_container_status || true
    echo ""
    
    # Check NiFi
    check_nifi_availability || true
    echo ""
    
    # Check Node.js and npm
    cd e-2-e-cypress
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        print_success "Node.js: $(node --version)"
        print_success "npm: $(npm --version)"
        
        if [ -f package.json ]; then
            print_success "package.json: Found"
            if [ -d node_modules ]; then
                print_success "node_modules: Installed"
            else
                print_warning "node_modules: Not found - run 'npm install'"
            fi
        fi
    else
        print_error "Node.js/npm: Not available"
    fi
    
    cd "$PROJECT_ROOT"
}

# Function to setup containers
setup_containers() {
    if [ -f "$SCRIPT_DIR/environment-manager.sh" ]; then
        # Use environment manager for container operations
        if [ "$RESTART_CONTAINERS" = true ]; then
            print_step "Force restarting containers using environment manager..."
            "$SCRIPT_DIR/environment-manager.sh" restart
        else
            # Check if containers are running, start if needed
            if ! "$SCRIPT_DIR/environment-manager.sh" health --quiet >/dev/null 2>&1; then
                print_step "Starting containers using environment manager..."
                "$SCRIPT_DIR/environment-manager.sh" start
            else
                print_success "Containers are already running and healthy"
            fi
        fi
    else
        # Fallback to direct Docker commands
        if [ "$RESTART_CONTAINERS" = true ]; then
            print_step "Force restarting containers..."
            cd integration-testing/src/main/docker
            docker compose down -v 2>/dev/null || true
            docker compose up -d
            cd "$PROJECT_ROOT"
        else
            check_container_status || {
                print_step "Starting containers..."
                cd integration-testing/src/main/docker
                docker compose up -d
                cd "$PROJECT_ROOT"
            }
        fi
        
        # Wait for NiFi to be ready
        print_step "Waiting for NiFi to become ready..."
        local max_attempts=60
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if check_nifi_availability >/dev/null 2>&1; then
                print_success "NiFi is ready after $attempt attempts"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                print_error "NiFi did not become ready after $max_attempts attempts"
                return 1
            fi
            
            print_status "Waiting for NiFi... (attempt $attempt/$max_attempts)"
            sleep 5
            ((attempt++))
        done
    fi
}
}

# Function to cleanup containers
cleanup_containers() {
    if [ "$KEEP_CONTAINERS" = false ]; then
        if [ -f "$SCRIPT_DIR/environment-manager.sh" ]; then
            print_step "Cleaning up containers using environment manager..."
            "$SCRIPT_DIR/environment-manager.sh" stop
        else
            print_step "Cleaning up containers..."
            cd integration-testing/src/main/docker
            docker compose down -v 2>/dev/null || true
            cd "$PROJECT_ROOT"
            print_success "Containers stopped and cleaned up"
        fi
    else
        print_warning "Containers left running as requested"
        if [ -f "$SCRIPT_DIR/environment-manager.sh" ]; then
            print_status "To stop containers manually: scripts/environment-manager.sh stop"
        else
            print_status "To stop containers manually:"
            print_status "  cd integration-testing/src/main/docker && docker compose down -v"
        fi
    fi
}

# Function to run build
run_build() {
    if [ "$SKIP_BUILD" = true ]; then
        print_warning "Skipping build phase"
        return 0
    fi
    
    local mvn_cmd
    mvn_cmd=$(get_maven_command)
    
    if [ "$CLEAN_BUILD" = true ]; then
        print_step "Running clean build..."
        $mvn_cmd clean package -DskipTests
    else
        print_step "Running build..."
        $mvn_cmd package -DskipTests
    fi
    
    print_success "Build completed"
}

# Function to run tests
run_tests() {
    cd e-2-e-cypress
    
    # Prepare Cypress arguments
    local cypress_cmd="cypress"
    local cypress_mode="run"
    
    if [ "$OPEN_CYPRESS" = true ]; then
        cypress_mode="open"
    fi
    
    # Add specific arguments
    if [ "$HEADED" = true ] && [ "$cypress_mode" = "run" ]; then
        CYPRESS_ARGS+=("--headed")
    fi
    
    if [ -n "$SPEC_PATTERN" ]; then
        CYPRESS_ARGS+=("--spec" "$SPEC_PATTERN")
    fi
    
    # Run appropriate test suite
    case "$TEST_TYPE" in
        "selftests")
            print_step "Running selftests (command validation)..."
            if [ "$OPEN_CYPRESS" = true ]; then
                npm run cypress:open -- --config-file cypress.selftests.config.js "${CYPRESS_ARGS[@]}"
            else
                npm run cypress:selftests -- "${CYPRESS_ARGS[@]}"
            fi
            ;;
        "e2e")
            print_step "Running full E2E tests..."
            if [ "$OPEN_CYPRESS" = true ]; then
                npm run cypress:open -- "${CYPRESS_ARGS[@]}"
            else
                npm run cypress:run -- "${CYPRESS_ARGS[@]}"
            fi
            ;;
        "all")
            print_step "Running complete test suite..."
            print_status "Phase 1: Self-tests"
            npm run cypress:selftests -- "${CYPRESS_ARGS[@]}"
            
            print_status "Phase 2: E2E tests"
            if [ "$OPEN_CYPRESS" = true ]; then
                npm run cypress:open -- "${CYPRESS_ARGS[@]}"
            else
                npm run cypress:run -- "${CYPRESS_ARGS[@]}"
            fi
            ;;
    esac
    
    cd "$PROJECT_ROOT"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            MODE="full"
            shift
            ;;
        --quick)
            MODE="quick"
            shift
            ;;
        --build-only)
            MODE="build-only"
            shift
            ;;
        --status)
            MODE="status"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --keep-containers)
            KEEP_CONTAINERS=true
            shift
            ;;
        --restart-containers)
            RESTART_CONTAINERS=true
            shift
            ;;
        --selftests-only)
            TEST_TYPE="selftests"
            shift
            ;;
        --e2e-only)
            TEST_TYPE="e2e"
            shift
            ;;
        --spec)
            SPEC_PATTERN="$2"
            shift 2
            ;;
        --headed)
            HEADED=true
            shift
            ;;
        --open)
            OPEN_CYPRESS=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        --)
            shift
            CYPRESS_ARGS+=("$@")
            break
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Trap cleanup on exit for full mode
if [ "$MODE" = "full" ]; then
    trap cleanup_containers EXIT
fi

# Main execution based on mode
case "$MODE" in
    "status")
        show_environment_status
        exit 0
        ;;
    "build-only")
        print_header "🔨 Build-Only Mode"
        echo "=================="
        check_prerequisites
        run_build
        print_success "Build completed successfully!"
        ;;
    "quick")
        print_header "🧪 Quick Test Mode"
        echo "=================="
        check_nifi_availability || {
            print_error "NiFi not accessible. Start containers first:"
            print_status "  ./e-2-e-cypress/scripts/test-runner.sh --full"
            print_status "  OR: cd integration-testing/src/main/docker && docker compose up -d"
            exit 1
        }
        run_tests
        print_success "Quick tests completed successfully!"
        ;;
    "full")
        print_header "🚀 Full Integration Test Suite"
        echo "==============================="
        check_prerequisites
        run_build
        setup_containers
        run_tests
        print_success "Full integration test suite completed successfully!"
        
        echo ""
        print_header "🎉 Integration Tests Completed"
        echo "==============================="
        print_status "While containers are running, you can:"
        print_status "  • Access NiFi UI: https://localhost:9095/nifi/ or http://localhost:9094/nifi/"
        print_status "  • Access Keycloak: https://localhost:9085/auth/"
        print_status "  • Run manual tests: cd e-2-e-cypress && npm run cypress:open"
        print_status "  • Run quick tests: ./e-2-e-cypress/scripts/test-runner.sh --quick"
        
        if [ "$KEEP_CONTAINERS" = true ]; then
            echo ""
            print_warning "Containers are still running. To stop them:"
            print_status "  cd integration-testing/src/main/docker && docker compose down -v"
        fi
        ;;
esac
