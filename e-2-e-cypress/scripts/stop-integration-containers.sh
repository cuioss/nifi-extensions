#!/bin/bash
# Stop NiFi Integration Tests Docker containers

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="${PROJECT_DIR}/../integration-testing/src/main/docker"

echo "🛑 Stopping NiFi Integration Tests Docker containers"

cd "${DOCKER_DIR}"

# Stop and remove containers
echo "📦 Stopping Docker containers..."
docker compose down

# Optional: Clean up images and volumes
if [ "$1" = "--clean" ]; then
    echo "🧹 Cleaning up Docker images and volumes..."
    docker compose down --volumes --rmi all
fi

echo "✅ NiFi Integration Tests stopped successfully"

# Show final status
if docker compose ps | grep -q "Up"; then
    echo "⚠️  Some containers are still running:"
    docker compose ps
else
    echo "✅ All containers are stopped"
fi
