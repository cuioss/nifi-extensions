#!/bin/bash

# Single entry-point for all pre-integration-test work:
#   1. Create deploy directory
#   2. Build + copy NAR via copy-deployment.sh
#   3. Start containers with docker compose
#   4. Wait for readiness via wait-for-containers.sh
#
# Environment variables:
#   PROJECT_ROOT — root of the multi-module Maven project
#                  (defaults to DOCKER_DIR/../../../../)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/.."
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "${DOCKER_DIR}/../../../.." && pwd)}"

cd "${DOCKER_DIR}"

# Step 1: Create deploy directory
echo "Creating deploy directory..."
mkdir -p "${PROJECT_ROOT}/target/nifi-deploy"

# Step 1b: Stop any existing containers (idempotent — safe if nothing is running)
echo "Stopping any existing containers..."
docker compose down -v 2>/dev/null || true

# Step 2: Build and copy NAR
echo "Building and deploying NAR files..."
bash "${DOCKER_DIR}/copy-deployment.sh" --skip-build

# Step 3: Patch flow.json so NiFi bundle versions match the current build
if [ -n "${PROJECT_VERSION:-}" ]; then
    FLOW_JSON="${DOCKER_DIR}/nifi/conf/flow.json"
    echo "Patching flow.json bundle versions to ${PROJECT_VERSION}..."
    sed -i.bak "s/CUIOSS_PLACEHOLDER_VERSION/${PROJECT_VERSION}/g" "$FLOW_JSON"
    rm -f "${FLOW_JSON}.bak"
    gzip -c "$FLOW_JSON" > "${FLOW_JSON}.gz"
fi

# Step 4: Start containers
echo "Starting Docker containers..."
docker compose up -d --build

# Step 4: Wait for readiness
echo "Waiting for containers to become healthy..."
bash "${SCRIPT_DIR}/wait-for-containers.sh"
