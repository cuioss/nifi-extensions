#!/bin/bash# Wait for health check
echo "Checking health status..."
COUNTER=0
MAX_ATTEMPTS=60
while [ $COUNTER -lt $MAX_ATTEMPTS ]; do
    if curl -k -f https://localhost:9095/nifi/ > /dev/null 2>&1; then
        break
    fi
    echo "Waiting... (attempt $((COUNTER + 1))/$MAX_ATTEMPTS)"
    sleep 5
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -lt $MAX_ATTEMPTS ]; then
    echo "✅ NiFi HTTPS is ready!"
    echo "🔒 Access NiFi at: https://localhost:9095/nifi"
    echo "⚠️  You may need to accept the self-signed certificate"
else
    echo "❌ NiFi HTTPS failed to start within timeout"
    docker compose logs nifi-https
fily the HTTPS NiFi instance for production-like testing
echo "Starting NiFi HTTPS instance on port 9095..."

docker compose up -d nifi-https keycloak

echo "Waiting for NiFi HTTPS to be ready..."
echo "NiFi HTTPS will be available at: https://localhost:9095/nifi"
echo "Keycloak will be available at: http://localhost:9080"

# Wait for health check
echo "Checking health status..."
timeout 300 bash -c 'until curl -k -f https://localhost:9095/nifi/ > /dev/null 2>&1; do sleep 5; echo "Waiting..."; done'

if [ $? -eq 0 ]; then
    echo "✅ NiFi HTTPS is ready!"
    echo "🔒 Access NiFi at: https://localhost:9095/nifi"
    echo "⚠️  You may need to accept the self-signed certificate"
else
    echo "❌ NiFi HTTPS failed to start within timeout"
    docker compose logs nifi-https
fi
