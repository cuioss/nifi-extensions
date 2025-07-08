#!/bin/bash

# Script to start and wait for Keycloak to be ready
# Based on cui-jwt project's reliable Keycloak startup approach

set -e

# Define script and project directories
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to the script directory to ensure docker-compose finds the yaml file
cd "$SCRIPT_DIR"

# Function to check if Keycloak is healthy
check_keycloak_health() {
    # Check the health/ready endpoint on the management port
    curl -f -s http://localhost:9086/health/ready > /dev/null 2>&1
}

# Function to wait for Keycloak with improved instrumentation
wait_for_keycloak() {
    local max_attempts=60
    local attempt=1
    
    echo "⏳ Waiting for Keycloak to be ready..."
    echo "  Checking: http://localhost:9086/health/ready"
    
    while [ $attempt -le $max_attempts ]; do
        if check_keycloak_health; then
            echo "✅ Keycloak is ready! (took $attempt seconds)"
            return 0
        fi
        
        # Provide feedback every 5 attempts
        if [ $((attempt % 5)) -eq 0 ]; then
            echo "⏳ Still waiting for Keycloak... (attempt $attempt/$max_attempts)"
            
            # Check if container is running
            if ! docker compose ps keycloak | grep -q "Up"; then
                echo "⚠️  Keycloak container is not running!"
                docker compose ps keycloak
                return 1
            fi
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    # Timeout reached
    echo "❌ Keycloak failed to start within $max_attempts seconds"
    echo ""
    echo "=== Container Status ==="
    docker compose ps keycloak
    echo ""
    echo "=== Recent Keycloak Logs ==="
    docker compose logs --tail=50 keycloak
    echo ""
    echo "=== System Resources ==="
    docker stats --no-stream || true
    
    return 1
}

# Main execution
main() {
    echo "🔑 Starting Keycloak..."
    echo "  HTTP Admin: http://localhost:9080"
    echo "  HTTPS: https://localhost:9085"
    echo "  Health: http://localhost:9086/health"
    
    # Check if Keycloak is already running
    if check_keycloak_health; then
        echo "✅ Keycloak is already running and healthy!"
        return 0
    fi
    
    # Start Keycloak if not running
    if ! docker compose ps keycloak 2>/dev/null | grep -q "Up"; then
        echo "🐳 Starting Keycloak container..."
        docker compose up -d keycloak
    else
        echo "ℹ️  Keycloak container is running but not healthy yet"
    fi
    
    # Wait for Keycloak to be ready
    if wait_for_keycloak; then
        echo ""
        echo "🎉 Keycloak is ready for use!"
        echo "  Realm: oauth_integration_tests"
        echo "  Admin: admin/admin"
        echo "  Test user: testUser/drowssap"
        echo "  Test client: test_client/yTKslWLtf4giJcWCaoVJ20H8sy6STexM"
        return 0
    else
        echo ""
        echo "💡 Troubleshooting tips:"
        echo "  1. Check if ports 9080, 9085, 9086 are already in use"
        echo "  2. Ensure sufficient memory is available (Keycloak needs ~512MB)"
        echo "  3. Try: docker compose down keycloak && docker compose up -d keycloak"
        echo "  4. Check full logs: docker compose logs keycloak"
        return 1
    fi
}

# Run main function
main "$@"