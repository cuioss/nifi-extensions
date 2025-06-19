#!/bin/bash

# Start NiFi HTTP instance for testing and MCP Playwright
echo "Starting NiFi HTTP instance on port 9094..."

docker compose up -d

echo "Waiting for NiFi to be ready..."
echo "NiFi will be available at: http://localhost:9094/nifi"
echo "Keycloak HTTPS will be available at: https://localhost:9085"
echo "Keycloak HTTP admin will be available at: http://localhost:9080"

# Wait for health check
echo "Checking health status..."
COUNTER=0
MAX_ATTEMPTS=60
while [ $COUNTER -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:9094/nifi/ > /dev/null 2>&1; then
        break
    fi
    echo "Waiting... (attempt $((COUNTER + 1))/$MAX_ATTEMPTS)"
    sleep 5
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -lt $MAX_ATTEMPTS ]; then
    echo "✅ NiFi is ready!"
    echo "🌐 Access NiFi at: http://localhost:9094/nifi"
    echo "🔒 Keycloak HTTPS: https://localhost:9085"
    echo "🔑 Keycloak HTTP Admin: http://localhost:9080"
    echo ""
    echo "Perfect for:"
    echo "  ✓ MCP Playwright testing (NiFi HTTP)"
    echo "  ✓ Secure authentication (Keycloak HTTPS)"
    echo "  ✓ Local development"
    echo "  ✓ Integration testing"
else
    echo "❌ NiFi failed to start within timeout"
    docker compose logs nifi
fi
