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

# Step 2: Build and copy NAR
echo "Building and deploying NAR files..."
bash "${DOCKER_DIR}/copy-deployment.sh"

# Step 3: Start containers
echo "Starting Docker containers..."
docker compose up -d --build

# Step 4: Wait for readiness
echo "Waiting for containers to become healthy..."
bash "${SCRIPT_DIR}/wait-for-containers.sh"
