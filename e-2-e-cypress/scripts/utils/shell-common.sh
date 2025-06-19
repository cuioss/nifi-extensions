#!/bin/bash
#
# Shared shell utilities for e-2-e-cypress scripts
# Provides common functions for logging, error handling, and utility operations
#

# ANSI color codes for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Check if we should use colors (TTY and not in CI)
USE_COLORS=true
if [ ! -t 1 ] || [ "${CI}" = "true" ] || [ "${NO_COLOR}" = "1" ]; then
    USE_COLORS=false
fi

#
# Logging functions with consistent formatting
#

# Print colored message if colors are enabled
print_colored() {
    local color="$1"
    local message="$2"
    
    if [ "$USE_COLORS" = "true" ]; then
        echo -e "${color}${message}${NC}"
    else
        echo "$message"
    fi
}

# Print timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Print formatted log message with timestamp
log_message() {
    local level="$1"
    local color="$2"
    local message="$3"
    local timestamp
    timestamp=$(get_timestamp)
    
    print_colored "$color" "[${timestamp}] [${level}] ${message}"
}

# Log functions
print_status() {
    log_message "INFO" "$CYAN" "🔍 $1"
}

print_success() {
    log_message "SUCCESS" "$GREEN" "✅ $1"
}

print_warning() {
    log_message "WARNING" "$YELLOW" "⚠️  $1"
}

print_error() {
    log_message "ERROR" "$RED" "❌ $1"
}

print_progress() {
    log_message "PROGRESS" "$MAGENTA" "⏳ $1"
}

print_step() {
    log_message "STEP" "$BLUE" "$1"
}

print_debug() {
    if [ "${DEBUG:-}" = "true" ] || [ "${VERBOSE:-}" = "true" ]; then
        log_message "DEBUG" "$DIM" "$1"
    fi
}

#
# Utility functions
#

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if file exists
file_exists() {
    [ -f "$1" ]
}

# Check if directory exists
directory_exists() {
    [ -d "$1" ]
}

# Ensure directory exists
ensure_directory() {
    local dir_path="$1"
    if [ ! -d "$dir_path" ]; then
        mkdir -p "$dir_path"
        print_debug "Created directory: $dir_path"
    fi
}

# Get project root (assumes we're in scripts/ or scripts/utils/)
get_project_root() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # If we're in scripts/utils/, go up two levels
    if [[ "$script_dir" == */scripts/utils ]]; then
        echo "$(cd "$script_dir/../.." && pwd)"
    # If we're in scripts/, go up one level  
    elif [[ "$script_dir" == */scripts ]]; then
        echo "$(cd "$script_dir/.." && pwd)"
    else
        # Fallback: assume current directory
        pwd
    fi
}

# Check if we're in the correct e-2-e-cypress directory
check_project_directory() {
    if [ ! -f "package.json" ] || [ ! -f "cypress.config.js" ]; then
        print_error "Not in e-2-e-cypress directory. Please run from the correct location."
        return 1
    fi
    return 0
}

# Ensure we're in the correct directory or exit
ensure_project_directory() {
    if ! check_project_directory; then
        exit 1
    fi
}

#
# Docker utilities
#

# Check if Docker is available
is_docker_available() {
    if command_exists docker && command_exists docker-compose; then
        return 0
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Get docker compose command (handling both docker-compose and docker compose)
get_docker_compose_cmd() {
    if command_exists docker-compose; then
        echo "docker-compose"
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    else
        print_error "Neither docker-compose nor 'docker compose' is available"
        return 1
    fi
}

# Check if containers are running
are_containers_running() {
    local docker_cmd
    docker_cmd=$(get_docker_compose_cmd) || return 1
    
    local running_count
    running_count=$($docker_cmd ps -q | wc -l 2>/dev/null) || return 1
    
    [ "$running_count" -gt 0 ]
}

# Check if NiFi is healthy
check_nifi_health() {
    local nifi_url="${1:-https://localhost:9095/nifi}"
    local timeout="${2:-5}"
    
    if command_exists curl; then
        curl -k -s --max-time "$timeout" --fail "$nifi_url" >/dev/null 2>&1
    elif command_exists wget; then
        wget -q --timeout="$timeout" --tries=1 --no-check-certificate "$nifi_url" -O /dev/null >/dev/null 2>&1
    else
        print_warning "Neither curl nor wget available for health check"
        return 1
    fi
}

#
# Test utilities
#

# Parse command line arguments into arrays
parse_args() {
    ARGS_FLAGS=()
    ARGS_OPTIONS=()
    ARGS_POSITIONAL=()
    
    while [ $# -gt 0 ]; do
        case $1 in
            --*=*)
                # Handle --key=value format
                local key="${1#--}"
                key="${key%%=*}"
                local value="${1#*=}"
                ARGS_OPTIONS+=("$key:$value")
                ;;
            --*)
                # Check if next argument is a value (doesn't start with -)
                if [ $# -gt 1 ] && [[ ! "$2" =~ ^- ]]; then
                    ARGS_OPTIONS+=("${1#--}:$2")
                    shift
                else
                    ARGS_FLAGS+=("${1#--}")
                fi
                ;;
            -*)
                ARGS_FLAGS+=("${1#-}")
                ;;
            *)
                ARGS_POSITIONAL+=("$1")
                ;;
        esac
        shift
    done
}

# Check if flag is present
has_flag() {
    local flag="$1"
    local f
    for f in "${ARGS_FLAGS[@]}"; do
        if [ "$f" = "$flag" ]; then
            return 0
        fi
    done
    return 1
}

# Get option value
get_option() {
    local key="$1"
    local default_value="${2:-}"
    local opt
    
    for opt in "${ARGS_OPTIONS[@]}"; do
        if [[ "$opt" =~ ^"$key": ]]; then
            echo "${opt#*:}"
            return 0
        fi
    done
    
    echo "$default_value"
}

#
# Error handling
#

# Exit with error message
die() {
    print_error "$1"
    exit "${2:-1}"
}

# Execute command with error handling
safe_execute() {
    local cmd="$1"
    local error_msg="${2:-Command failed}"
    
    print_debug "Executing: $cmd"
    
    if ! eval "$cmd"; then
        die "$error_msg" $?
    fi
}

# Execute command silently
execute_silent() {
    local cmd="$1"
    eval "$cmd" >/dev/null 2>&1
}

# Cleanup function to be called on script exit
cleanup() {
    print_debug "Performing cleanup..."
}

# Set up trap for cleanup
setup_cleanup() {
    trap cleanup EXIT
}

#
# Version and environment info
#

# Print environment information
print_env_info() {
    print_status "Environment Information:"
    echo "  OS: $(uname -s) $(uname -r)"
    echo "  Shell: ${SHELL:-unknown}"
    echo "  Node: $(command_exists node && node --version || echo 'not found')"
    echo "  NPM: $(command_exists npm && npm --version || echo 'not found')"
    echo "  Docker: $(command_exists docker && docker --version || echo 'not found')"
    echo "  Docker Compose: $(get_docker_compose_cmd >/dev/null && get_docker_compose_cmd --version || echo 'not found')"
    echo "  PWD: $(pwd)"
}

# Export all functions for use in other scripts
export -f print_colored get_timestamp log_message
export -f print_status print_success print_warning print_error print_progress print_step print_debug
export -f command_exists file_exists directory_exists ensure_directory
export -f get_project_root check_project_directory ensure_project_directory
export -f is_docker_available get_docker_compose_cmd are_containers_running check_nifi_health
export -f parse_args has_flag get_option
export -f die safe_execute execute_silent cleanup setup_cleanup
export -f print_env_info

# Export color variables
export RED GREEN YELLOW BLUE MAGENTA CYAN WHITE BOLD DIM NC USE_COLORS

print_debug "Loaded shell-common.sh utilities"
