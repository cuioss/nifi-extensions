#!/bin/bash

# Start both NiFi instances (HTTP and HTTPS) simultaneously
echo "Starting both NiFi instances..."
echo "  - HTTP on port 9094"
echo "  - HTTPS on port 9095"

docker compose up -d nifi-http nifi-https keycloak

echo "Waiting for both NiFi instances to be ready..."

# Wait for HTTP instance
echo "Checking HTTP instance..."
HTTP_COUNTER=0
HTTP_MAX_ATTEMPTS=60
while [ $HTTP_COUNTER -lt $HTTP_MAX_ATTEMPTS ]; do
    if curl -f http://localhost:9094/nifi/ > /dev/null 2>&1; then
        break
    fi
    echo "Waiting for HTTP... (attempt $((HTTP_COUNTER + 1))/$HTTP_MAX_ATTEMPTS)"
    sleep 5
    HTTP_COUNTER=$((HTTP_COUNTER + 1))
done

# Wait for HTTPS instance
echo "Checking HTTPS instance..."
HTTPS_COUNTER=0
HTTPS_MAX_ATTEMPTS=60
while [ $HTTPS_COUNTER -lt $HTTPS_MAX_ATTEMPTS ]; do
    if curl -k -f https://localhost:9095/nifi/ > /dev/null 2>&1; then
        break
    fi
    echo "Waiting for HTTPS... (attempt $((HTTPS_COUNTER + 1))/$HTTPS_MAX_ATTEMPTS)"
    sleep 5
    HTTPS_COUNTER=$((HTTPS_COUNTER + 1))
done

echo ""
echo "=== NiFi Instances Status ==="
if [ $HTTP_COUNTER -lt $HTTP_MAX_ATTEMPTS ]; then
    echo "✅ HTTP:  http://localhost:9094/nifi"
else
    echo "❌ HTTP:  Failed to start"
fi

if [ $HTTPS_COUNTER -lt $HTTPS_MAX_ATTEMPTS ]; then
    echo "✅ HTTPS: https://localhost:9095/nifi"
else
    echo "❌ HTTPS: Failed to start"
fi

echo "🔑 Keycloak: http://localhost:9080"
echo ""
echo "Use cases:"
echo "  - MCP Playwright testing: Use HTTP instance"
echo "  - Production-like testing: Use HTTPS instance"
