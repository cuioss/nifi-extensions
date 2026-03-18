#!/bin/bash

# Start NiFi HTTPS instance for testing and MCP Playwright
echo "Starting NiFi HTTPS instance on port 9095..."

# Define script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to the script directory to ensure docker-compose finds the yaml file
cd "$SCRIPT_DIR"

# First ensure Keycloak is ready
if ! "${SCRIPT_DIR}/start-keycloak.sh"; then
    echo "Failed to start Keycloak. Aborting NiFi startup."
    exit 1
fi

# Now start NiFi
echo ""
echo "Starting NiFi container..."
docker compose up -d nifi

echo "NiFi will be available at: https://localhost:9095/nifi"
echo "Keycloak HTTPS will be available at: https://localhost:9085"

# Wait for NiFi health + start all processors
if ! "${SCRIPT_DIR}/wait-and-start-processors.sh"; then
    echo "NiFi failed to start"
    echo "=== Container Status ==="
    docker compose ps
    echo "=== NiFi Logs ==="
    docker compose logs --tail=50 nifi
    exit 1
fi

echo ""
echo "Access NiFi at: https://localhost:9095/nifi"
echo "Keycloak HTTPS: https://localhost:9085"
