#!/bin/bash

# Start only the HTTP NiFi instance for MCP Playwright testing
echo "Starting NiFi HTTP instance on port 9094..."

docker compose up -d nifi-http keycloak

echo "Waiting for NiFi HTTP to be ready..."
echo "NiFi HTTP will be available at: http://localhost:9094/nifi"
echo "Keycloak will be available at: http://localhost:9080"

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
    echo "✅ NiFi HTTP is ready!"
    echo "🌐 Access NiFi at: http://localhost:9094/nifi"
else
    echo "❌ NiFi HTTP failed to start within timeout"
    docker compose logs nifi-http
fi
