#!/bin/bash
# Start NiFi Integration Tests using Docker Compose with fail-fast startup

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="${PROJECT_DIR}/../integration-testing/src/main/docker"

echo "🚀 Starting NiFi Integration Tests with Docker Compose"
echo "Project directory: ${PROJECT_DIR}"
echo "Docker directory: ${DOCKER_DIR}"

cd "${DOCKER_DIR}"

# Ensure we have the latest images
echo "📦 Preparing Docker images..."

# Start with Docker Compose with fail-fast timeout
echo "🐳 Starting Docker containers with 2-minute fail-fast timeout..."
docker compose up -d

# Wait for services to be ready with fail-fast mechanism
echo "⏳ Waiting for services to be ready (max 2 minutes)..."
START_TIME=$(date +%s)
MAX_WAIT=120  # 2 minutes

# Check NiFi
echo "🔍 Checking NiFi service..."
for i in $(seq 1 $MAX_WAIT); do
    if curl -k -s -f "https://localhost:9095/nifi/" > /dev/null 2>&1; then
        NIFI_TIME=$(date +%s)
        NIFI_ELAPSED=$((NIFI_TIME - START_TIME))
        echo "✅ NiFi is ready! (${NIFI_ELAPSED}s)"
        break
    fi
    if [ $i -eq $MAX_WAIT ]; then
        echo "❌ NiFi failed to start within ${MAX_WAIT} seconds"
        echo "📋 Container logs:"
        docker compose logs --tail=50 nifi
        echo "🛑 Stopping containers..."
        docker compose down
        exit 1
    fi
    if [ $((i % 10)) -eq 0 ]; then
        echo "⏳ Still waiting for NiFi... (${i}/${MAX_WAIT}s)"
    fi
    sleep 1
done

# Check Keycloak
echo "🔍 Checking Keycloak service..."
for i in $(seq 1 60); do  # Keycloak should be faster once NiFi is up
    if curl -s -f "http://localhost:9080/realms/oauth_integration_tests" > /dev/null 2>&1; then
        KEYCLOAK_TIME=$(date +%s)
        KEYCLOAK_ELAPSED=$((KEYCLOAK_TIME - START_TIME))
        echo "✅ Keycloak is ready! (${KEYCLOAK_ELAPSED}s)"
        break
    fi
    if [ $i -eq 60 ]; then
        echo "❌ Keycloak failed to start within 60 seconds"
        echo "📋 Container logs:"
        docker compose logs --tail=50 keycloak
        echo "🛑 Stopping containers..."
        docker compose down
        exit 1
    fi
    if [ $((i % 10)) -eq 0 ]; then
        echo "⏳ Still waiting for Keycloak... (${i}/60s)"
    fi
    sleep 1
done

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo ""
echo "🎉 All services are ready!"
echo "📈 Total startup time: ${TOTAL_TIME}s"
echo ""
echo "📱 Service URLs:"
echo "  🌊 NiFi UI:        https://localhost:9095/nifi"
echo "  🔐 Keycloak:       http://localhost:9080/"
echo "  🔍 NiFi API:       https://localhost:9095/nifi-api"
echo ""
echo "🧪 Quick test commands:"
echo "  curl -k -s https://localhost:9095/nifi/"
echo "  curl -s http://localhost:9080/realms/oauth_integration_tests"
echo ""
echo "🛑 To stop: ${SCRIPT_DIR}/stop-integration-containers.sh"
echo "📋 To view logs: cd ${DOCKER_DIR} && docker compose logs -f"
