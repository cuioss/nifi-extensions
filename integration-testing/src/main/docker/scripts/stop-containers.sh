#!/bin/bash

# Stop Docker containers with optional log collection.
#
# Environment variables:
#   LOG_DIR — directory to write container logs into (defaults to DOCKER_DIR/../../../../target)
#
# Always exits 0 so it is safe for both pre-clean and post-integration-test phases.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/.."
LOG_DIR="${LOG_DIR:-$(cd "${DOCKER_DIR}/../../../.." && pwd)/target}"

cd "${DOCKER_DIR}"

# ---------------------------------------------------------------------------
# Collect container logs (only when containers are still running)
# ---------------------------------------------------------------------------
if docker compose ps --status running 2>/dev/null | grep -q "nifi\|keycloak"; then
    echo "Collecting container logs before shutdown..."
    mkdir -p "${LOG_DIR}"
    docker compose logs nifi     > "${LOG_DIR}/nifi-container.log"     2>&1 || true
    docker compose logs keycloak > "${LOG_DIR}/keycloak-container.log" 2>&1 || true
    echo "Logs written to ${LOG_DIR}/"
else
    echo "No running containers detected — skipping log collection."
fi

# ---------------------------------------------------------------------------
# Tear down containers and volumes
# ---------------------------------------------------------------------------
echo "Stopping containers..."
docker compose down -v 2>/dev/null || true

echo "Containers stopped."
exit 0
