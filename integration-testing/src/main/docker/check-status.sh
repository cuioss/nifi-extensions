#!/bin/bash

# Fast-fail Docker health check script for containers and HTTP endpoints
# Checks Docker containers and health URLs with 2-second timeout - fails fast if not ready

set -e

# Define paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NIFI_URL="https://localhost:9095"
KEYCLOAK_URL="http://localhost:9080"
TIMEOUT_SECONDS=2
CHECK_INTERVAL=1

# Usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --timeout SECONDS    Timeout in seconds (default: 2)"
    echo "  -i, --interval SECONDS   Check interval in seconds (default: 1)"
    echo "  -q, --quiet             Minimal output"
    echo "  -v, --verbose           Verbose output"
    echo "  -h, --help              Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  NIFI_URL                NiFi base URL (default: https://localhost:9095)"
    echo "  KEYCLOAK_URL            Keycloak base URL (default: http://localhost:9080)"
    echo ""
    echo "Examples:"
    echo "  $0                      # Basic status check"
    echo "  $0 --timeout 300        # 5 minute timeout"
    echo "  $0 --quiet              # Minimal output"
}

# Parse command line arguments
QUIET=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--timeout)
            TIMEOUT_SECONDS="$2"
            shift 2
            ;;
        -i|--interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Override URLs from environment if set
NIFI_URL="${NIFI_URL:-https://localhost:9095}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:9080}"

# Logging functions
log_info() {
    if [[ "$QUIET" != true ]]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    if [[ "$QUIET" != true ]]; then
        echo -e "${GREEN}[SUCCESS]${NC} $1"
    fi
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Check if Docker is running
check_docker() {
    log_verbose "Checking Docker availability..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker command not found"
        return 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon not running"
        return 1
    fi

    log_verbose "Docker is available"
    return 0
}

# Check Docker Compose
check_docker_compose() {
    log_verbose "Checking Docker Compose availability..."
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose not available"
        return 1
    fi

    log_verbose "Docker Compose is available"
    return 0
}

# Get container status
get_container_status() {
    local service_name="$1"
    docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Health}}" 2>/dev/null | grep "^${service_name}" || echo ""
}

# Check if container is running
is_container_running() {
    local service_name="$1"
    local status=$(get_container_status "$service_name")
    if [[ "$status" == *"Up"* ]]; then
        return 0
    else
        return 1
    fi
}

# Check if container is healthy
is_container_healthy() {
    local service_name="$1"
    local status=$(get_container_status "$service_name")
    if [[ "$status" == *"healthy"* ]]; then
        return 0
    else
        return 1
    fi
}

# HTTP health check with timeout
check_http_endpoint() {
    local url="$1"
    local description="$2"
    local timeout="${3:-2}"

    log_verbose "Checking HTTP endpoint: $url"

    if curl --fail --silent --max-time "$timeout" "$url" > /dev/null 2>&1; then
        log_verbose "$description is responding"
        return 0
    else
        log_verbose "$description is not responding"
        return 1
    fi
}

# NiFi specific health checks
check_nifi_health() {
    local base_url="$1"

    # Check basic accessibility
    if ! check_http_endpoint "${base_url}/nifi/" "NiFi Web UI" 2; then
        return 1
    fi

    # Check NiFi API system diagnostics
    if ! check_http_endpoint "${base_url}/nifi-api/system-diagnostics" "NiFi API" 2; then
        return 1
    fi

    # Check if NiFi is in anonymous mode (common for testing)
    local access_status=$(curl --silent --max-time 2 "${base_url}/nifi-api/access" 2>/dev/null || echo "")
    if [[ "$access_status" == *"anonymous"* ]]; then
        log_verbose "NiFi is running in anonymous access mode"
    fi

    return 0
}

# Keycloak specific health checks
check_keycloak_health() {
    local base_url="$1"

    # Keycloak doesn't have /health endpoint, check admin console
    if check_http_endpoint "${base_url}/admin/" "Keycloak Admin Console" 2; then
        return 0
    fi

    # Fallback to root endpoint check
    if check_http_endpoint "${base_url}/" "Keycloak Root" 2; then
        return 0
    fi

    return 1
}

# Check e-2-e-playwright environment
check_playwright_environment() {
    # Playwright environment check removed - this script only handles Docker and health URLs
    return 0
}

# Main status check function - fail fast
check_status() {
    log_info "Starting fast Docker health check (max ${TIMEOUT_SECONDS}s)..."

    # Initial checks
    if ! check_docker; then
        return 1
    fi

    if ! check_docker_compose; then
        return 1
    fi

    cd "$SCRIPT_DIR"

    # Check if containers are running - fail fast if not
    local nifi_running=false
    local keycloak_running=false

    # Check if containers are running
    if is_container_running "nifi" || is_container_running "nifi-http" || is_container_running "nifi-https"; then
        nifi_running=true
        log_verbose "NiFi container is running"
    else
        log_error "NiFi container is not running"
        docker compose ps 2>/dev/null || echo "Could not get container status"
        return 1
    fi

    if is_container_running "keycloak"; then
        keycloak_running=true
        log_verbose "Keycloak container is running"
    else
        log_error "Keycloak container is not running"
        docker compose ps 2>/dev/null || echo "Could not get container status"
        return 1
    fi

    # Both containers running, check health endpoints quickly
    log_verbose "Containers running, checking health endpoints..."

    # Check service health with fail-fast timeouts
    if ! check_nifi_health "$NIFI_URL"; then
        log_error "NiFi health check failed"
        return 1
    fi

    if ! check_keycloak_health "$KEYCLOAK_URL"; then
        log_error "Keycloak health check failed"
        return 1
    fi

    log_success "All services are healthy and ready!"

    # Print service URLs
    if [[ "$QUIET" != true ]]; then
        echo ""
        log_info "Service URLs:"
        echo "  NiFi:     ${NIFI_URL}/nifi/"
        echo "  Keycloak: ${KEYCLOAK_URL}/"
        echo ""
        log_info "Default test credentials:"
        echo "  NiFi:     admin / adminadminadmin"
        echo "  Keycloak: testUser / drowssap"
    fi

    return 0
}

# Handle script interruption
cleanup() {
    log_info "Status check interrupted"
    exit 130
}

trap cleanup INT TERM

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_status
    exit $?
fi
