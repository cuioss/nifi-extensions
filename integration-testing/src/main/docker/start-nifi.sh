#!/bin/bash

# Start NiFi HTTPS instance for testing and MCP Playwright
echo "Starting NiFi HTTPS instance on port 9095..."

# Define script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to the script directory to ensure docker-compose finds the yaml file
cd "$SCRIPT_DIR"

# First ensure Keycloak is ready
if ! "${SCRIPT_DIR}/start-keycloak.sh"; then
    echo "❌ Failed to start Keycloak. Aborting NiFi startup."
    exit 1
fi

# Now start NiFi
echo ""
echo "🚀 Starting NiFi container..."
docker compose up -d nifi

echo "Waiting for NiFi to be ready..."
echo "NiFi will be available at: https://localhost:9095/nifi"
echo "Keycloak HTTPS will be available at: https://localhost:9085"
echo "Keycloak HTTP admin will be available at: http://localhost:9080"

# Wait for health check with improved fail-fast
echo "Checking health status with 2-minute timeout..."
COUNTER=0
MAX_ATTEMPTS=60  # 2 minutes with 2-second intervals
INTERVAL=2
while [ $COUNTER -lt $MAX_ATTEMPTS ]; do
    if curl -k --fail --max-time 3 --silent https://localhost:9095/nifi/ > /dev/null 2>&1; then
        echo "✅ NiFi is ready! (Started in $((COUNTER * INTERVAL)) seconds)"
        break
    fi
    echo "⏳ Waiting... (attempt $((COUNTER + 1))/$MAX_ATTEMPTS) - $((COUNTER * INTERVAL))s elapsed"
    sleep $INTERVAL
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -lt $MAX_ATTEMPTS ]; then
    echo "✅ NiFi is ready!"
    echo "🌐 Access NiFi at: https://localhost:9095/nifi"
    echo "🔒 Keycloak HTTPS: https://localhost:9085"
    echo "🔑 Keycloak HTTP Admin: http://localhost:9080"
    echo ""
    echo "Perfect for:"
    echo "  ✓ MCP Playwright testing (NiFi HTTP)"
    echo "  ✓ Secure authentication (Keycloak HTTPS)"
    echo "  ✓ Local development"
    echo "  ✓ Integration testing"
else
    echo "❌ NiFi failed to start within $((MAX_ATTEMPTS * INTERVAL)) seconds"
    echo "=== Container Status ==="
    docker compose ps
    echo "=== NiFi Logs ==="
    docker compose logs --tail=50 nifi
    echo "=== System Resources ==="
    docker stats --no-stream || true
    exit 1
fi
