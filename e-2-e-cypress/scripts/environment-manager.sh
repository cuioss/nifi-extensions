#!/bin/bash
#
# Comprehensive Environment Manager for e-2-e-cypress
# Provides unified container lifecycle management, health monitoring, and environment control
#
# Usage:
#   scripts/environment-manager.sh [command] [options]
#
# Commands:
#   start     - Start all containers and wait for readiness
#   stop      - Stop all containers cleanly
#   restart   - Restart all containers
#   status    - Show detailed status of all components
#   health    - Run comprehensive health checks
#   logs      - Show container logs
#   cleanup   - Clean up containers, networks, and volumes
#   reset     - Complete reset (stop, cleanup, start)
#
# Options:
#   --force           - Force operations (skip confirmations)
#   --quiet           - Suppress non-essential output
#   --verbose         - Enable detailed logging
#   --timeout <secs>  - Set timeout for operations (default: 300)
#   --no-wait         - Don't wait for services to be ready
#   --follow          - Follow logs (for logs command)
#   --tail <lines>    - Number of log lines to show (default: 100)
#

set -e

# Import shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/utils/shell-common.sh" ]; then
    source "$SCRIPT_DIR/utils/shell-common.sh"
else
    # Fallback if utilities not available
    print_status() { echo "🔍 $1"; }
    print_success() { echo "✅ $1"; }
    print_warning() { echo "⚠️  $1"; }
    print_error() { echo "❌ $1"; }
    print_step() { echo "📋 $1"; }
    print_progress() { echo "⏳ $1"; }
    die() { echo "❌ $1" >&2; exit "${2:-1}"; }
fi

# Configuration
DEFAULT_TIMEOUT=300
DEFAULT_LOG_LINES=100
NIFI_HTTP_URL="http://localhost:9094/nifi"
NIFI_HTTPS_URL="https://localhost:9095/nifi"
KEYCLOAK_URL="https://localhost:9085"
KEYCLOAK_ADMIN_URL="http://localhost:9080"

# Docker paths
DOCKER_DIR="../integration-testing/src/main/docker"
DOCKER_COMPOSE_FILE="docker-compose.yml"

# Global options
FORCE_MODE=false
QUIET_MODE=false
VERBOSE_MODE=false
TIMEOUT=$DEFAULT_TIMEOUT
NO_WAIT=false
FOLLOW_LOGS=false
LOG_LINES=$DEFAULT_LOG_LINES

# Parse command line arguments
parse_arguments() {
    COMMAND=""
    
    while [ $# -gt 0 ]; do
        case $1 in
            start|stop|restart|status|health|logs|cleanup|reset)
                if [ -z "$COMMAND" ]; then
                    COMMAND="$1"
                else
                    die "Multiple commands specified. Use only one command."
                fi
                ;;
            --force)
                FORCE_MODE=true
                ;;
            --quiet)
                QUIET_MODE=true
                ;;
            --verbose)
                VERBOSE_MODE=true
                export VERBOSE=true
                ;;
            --timeout)
                shift
                if [ $# -eq 0 ]; then
                    die "Missing timeout value"
                fi
                TIMEOUT="$1"
                ;;
            --no-wait)
                NO_WAIT=true
                ;;
            --follow)
                FOLLOW_LOGS=true
                ;;
            --tail)
                shift
                if [ $# -eq 0 ]; then
                    die "Missing tail value"
                fi
                LOG_LINES="$1"
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
        shift
    done
    
    if [ -z "$COMMAND" ]; then
        show_help
        exit 1
    fi
}

# Show help
show_help() {
    cat << 'EOF'
Environment Manager for e-2-e-cypress

USAGE:
    scripts/environment-manager.sh <command> [options]

COMMANDS:
    start     Start all containers and wait for readiness
    stop      Stop all containers cleanly
    restart   Restart all containers (stop + start)
    status    Show detailed status of all components
    health    Run comprehensive health checks
    logs      Show container logs
    cleanup   Clean up containers, networks, and volumes
    reset     Complete reset (stop, cleanup, start)

OPTIONS:
    --force           Force operations (skip confirmations)
    --quiet           Suppress non-essential output
    --verbose         Enable detailed logging
    --timeout <secs>  Set timeout for operations (default: 300)
    --no-wait         Don't wait for services to be ready
    --follow          Follow logs (for logs command)
    --tail <lines>    Number of log lines to show (default: 100)
    --help, -h        Show this help message

EXAMPLES:
    # Start environment and wait for readiness
    scripts/environment-manager.sh start

    # Quick restart without waiting
    scripts/environment-manager.sh restart --no-wait

    # Check detailed status
    scripts/environment-manager.sh status --verbose

    # Show last 50 lines of logs
    scripts/environment-manager.sh logs --tail 50

    # Complete reset
    scripts/environment-manager.sh reset --force

SERVICES MANAGED:
    - NiFi HTTP  (http://localhost:9094/nifi)
    - NiFi HTTPS (https://localhost:9095/nifi)
    - Keycloak   (https://localhost:9085)
    - Keycloak Admin (http://localhost:9080)
EOF
}

# Check prerequisites
check_prerequisites() {
    if ! is_docker_available; then
        die "Docker is not available. Please install Docker and Docker Compose."
    fi
    
    if [ ! -f "$DOCKER_DIR/$DOCKER_COMPOSE_FILE" ]; then
        die "Docker compose file not found: $DOCKER_DIR/$DOCKER_COMPOSE_FILE"
    fi
    
    if ! command_exists curl && ! command_exists wget; then
        print_warning "Neither curl nor wget available. Health checks may be limited."
    fi
}

# Get docker compose command
get_compose_cmd() {
    local docker_cmd
    docker_cmd=$(get_docker_compose_cmd) || die "Docker Compose not available"
    echo "$docker_cmd"
}

# Start containers
start_containers() {
    print_step "Starting Docker containers..."
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    # Save current directory and change to docker directory
    local current_dir=$(pwd)
    cd "$DOCKER_DIR" || die "Cannot change to Docker directory: $DOCKER_DIR"
    
    # Start containers
    local exit_code=0
    if $VERBOSE_MODE; then
        $compose_cmd up -d || exit_code=$?
    else
        $compose_cmd up -d >/dev/null 2>&1 || exit_code=$?
    fi
    
    # Return to original directory
    cd "$current_dir"
    
    if [ $exit_code -eq 0 ]; then
        print_success "Containers started successfully"
    else
        die "Failed to start containers"
    fi
    
    # Wait for readiness unless --no-wait
    if [ "$NO_WAIT" = "false" ]; then
        wait_for_services
    fi
}

# Stop containers
stop_containers() {
    print_step "Stopping Docker containers..."
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    # Save current directory and change to docker directory
    local current_dir=$(pwd)
    cd "$DOCKER_DIR" || die "Cannot change to Docker directory: $DOCKER_DIR"
    
    local exit_code=0
    if $VERBOSE_MODE; then
        $compose_cmd down || exit_code=$?
    else
        $compose_cmd down >/dev/null 2>&1 || exit_code=$?
    fi
    
    # Return to original directory
    cd "$current_dir"
    
    if [ $exit_code -eq 0 ]; then
        print_success "Containers stopped successfully"
    else
        print_warning "Some containers may not have stopped cleanly"
    fi
}

# Restart containers
restart_containers() {
    print_step "Restarting containers..."
    stop_containers
    sleep 2
    start_containers
}

# Wait for services to be ready
wait_for_services() {
    print_progress "Waiting for services to be ready (timeout: ${TIMEOUT}s)..."
    
    local start_time
    start_time=$(date +%s)
    
    # Wait for NiFi HTTP
    print_progress "Waiting for NiFi HTTP..."
    while ! check_nifi_health "$NIFI_HTTP_URL" 5; do
        local elapsed
        elapsed=$(($(date +%s) - start_time))
        if [ $elapsed -gt $TIMEOUT ]; then
            die "Timeout waiting for NiFi HTTP to be ready"
        fi
        sleep 5
    done
    print_success "NiFi HTTP is ready"
    
    # Check NiFi HTTPS (optional)
    if check_nifi_health "$NIFI_HTTPS_URL" 5; then
        print_success "NiFi HTTPS is also available"
    else
        print_warning "NiFi HTTPS not responding (may not be configured)"
    fi
    
    # Check Keycloak (optional)
    if check_nifi_health "$KEYCLOAK_URL" 5; then
        print_success "Keycloak HTTPS is ready"
    else
        print_warning "Keycloak HTTPS not responding (may still be starting)"
    fi
    
    print_success "Core services are ready for testing"
}

# Show container status
show_status() {
    print_step "Environment Status Report"
    echo "=========================="
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    # Save current directory and change to docker directory
    local current_dir=$(pwd)
    cd "$DOCKER_DIR" || die "Cannot change to Docker directory: $DOCKER_DIR"
    
    # Container status
    echo "📦 Container Status:"
    if $compose_cmd ps --format table >/dev/null 2>&1; then
        $compose_cmd ps --format table
    else
        $compose_cmd ps
    fi
    echo
    
    # Return to original directory
    cd "$current_dir"
    
    # Service health
    echo "🏥 Service Health:"
    check_service_health "$NIFI_HTTP_URL" "NiFi HTTP"
    check_service_health "$NIFI_HTTPS_URL" "NiFi HTTPS"
    check_service_health "$KEYCLOAK_URL" "Keycloak HTTPS"
    check_service_health "$KEYCLOAK_ADMIN_URL" "Keycloak Admin HTTP"
    echo
    
    if $VERBOSE_MODE; then
        # Network information
        echo "🌐 Network Information:"
        docker network ls --filter name=docker 2>/dev/null || echo "No networks found"
        echo
        
        # Volume information
        echo "💾 Volume Information:"
        docker volume ls --filter name=docker 2>/dev/null || echo "No volumes found"
        echo
    fi
    
    # Resource usage
    echo "📊 Resource Usage:"
    show_resource_usage
}

# Check service health
check_service_health() {
    local url="$1"
    local name="$2"
    
    if check_nifi_health "$url" 3; then
        printf "  ✅ %-20s %s\n" "$name" "Healthy"
    else
        printf "  ❌ %-20s %s\n" "$name" "Not responding"
    fi
}

# Show resource usage
show_resource_usage() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    # Change to docker directory
    local current_dir=$(pwd)
    cd "$DOCKER_DIR" 2>/dev/null || return
    
    # Get container IDs
    local container_ids
    container_ids=$($compose_cmd ps -q 2>/dev/null)
    
    if [ -n "$container_ids" ]; then
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $container_ids 2>/dev/null || echo "  Unable to get resource statistics"
    else
        echo "  No running containers"
    fi
    
    # Return to original directory
    cd "$current_dir"
}

# Run comprehensive health checks
run_health_checks() {
    print_step "Running comprehensive health checks..."
    
    local all_healthy=true
    
    # Check Docker
    print_status "Checking Docker availability..."
    if is_docker_available; then
        print_success "Docker is available"
    else
        print_error "Docker is not available"
        all_healthy=false
    fi
    
    # Check containers
    print_status "Checking container status..."
    if are_containers_running; then
        print_success "Containers are running"
    else
        print_warning "Containers are not running"
        all_healthy=false
    fi
    
    # Check services
    print_status "Checking service endpoints..."
    check_service_health "$NIFI_HTTP_URL" "NiFi HTTP"
    check_service_health "$NIFI_HTTPS_URL" "NiFi HTTPS"
    check_service_health "$KEYCLOAK_URL" "Keycloak HTTPS"
    check_service_health "$KEYCLOAK_ADMIN_URL" "Keycloak Admin HTTP"
    
    # Check project directory
    print_status "Checking project structure..."
    if check_project_directory; then
        print_success "Project directory structure is valid"
    else
        print_error "Project directory structure is invalid"
        all_healthy=false
    fi
    
    echo
    if $all_healthy; then
        print_success "All health checks passed! Environment is ready."
    else
        print_warning "Some health checks failed. Environment may need attention."
        return 1
    fi
}

# Show container logs
show_logs() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    # Save current directory and change to docker directory
    local current_dir=$(pwd)
    cd "$DOCKER_DIR" || die "Cannot change to Docker directory: $DOCKER_DIR"
    
    print_step "Container logs (last $LOG_LINES lines):"
    
    if $FOLLOW_LOGS; then
        print_status "Following logs (press Ctrl+C to stop)..."
        $compose_cmd logs -f --tail "$LOG_LINES"
    else
        $compose_cmd logs --tail "$LOG_LINES"
    fi
    
    # Return to original directory  
    cd "$current_dir"
}

# Clean up environment
cleanup_environment() {
    if [ "$FORCE_MODE" = "false" ]; then
        echo "⚠️  This will remove all containers, networks, and volumes."
        echo -n "Continue? [y/N]: "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            print_status "Cleanup cancelled"
            return 0
        fi
    fi
    
    print_step "Cleaning up environment..."
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    # Save current directory and change to docker directory
    local current_dir=$(pwd)
    cd "$DOCKER_DIR" || die "Cannot change to Docker directory: $DOCKER_DIR"
    
    # Stop and remove everything
    local exit_code=0
    if $VERBOSE_MODE; then
        $compose_cmd down -v --remove-orphans || exit_code=$?
    else
        $compose_cmd down -v --remove-orphans >/dev/null 2>&1 || exit_code=$?
    fi
    
    # Return to original directory
    cd "$current_dir"
    
    # Clean up any dangling resources
    if command_exists docker; then
        docker system prune -f >/dev/null 2>&1 || true
    fi
    
    print_success "Environment cleaned up"
}

# Reset environment
reset_environment() {
    print_step "Resetting environment (stop, cleanup, start)..."
    stop_containers
    cleanup_environment
    start_containers
    print_success "Environment reset completed"
}

# Main function
main() {
    # Check if we're in the right directory
    ensure_project_directory
    
    # Parse arguments
    parse_arguments "$@"
    
    # Set quiet mode for reduced output
    if $QUIET_MODE; then
        export QUIET=true
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Execute command
    case "$COMMAND" in
        start)
            start_containers
            ;;
        stop)
            stop_containers
            ;;
        restart)
            restart_containers
            ;;
        status)
            show_status
            ;;
        health)
            run_health_checks
            ;;
        logs)
            show_logs
            ;;
        cleanup)
            cleanup_environment
            ;;
        reset)
            reset_environment
            ;;
        *)
            die "Unknown command: $COMMAND"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
